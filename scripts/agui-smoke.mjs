#!/usr/bin/env node
/**
 * AG-UI contract test — docs/agui/PLAN.md (hợp đồng mục 4, kịch bản mục 6.E).
 *
 * Node thuần (>= 20, dùng fetch có sẵn), không dependency. Viết CHỈ dựa trên hợp đồng,
 * không đọc code của mock, để dùng lại được cho backend thật.
 *
 * Cách chạy:
 *   node scripts/agui-smoke.mjs [AGENT_URL] [--contract-only] [--verbose]
 *   AGENT_URL=http://host:8686/agent node scripts/agui-smoke.mjs --contract-only
 *
 *   AGENT_URL   mặc định http://localhost:8787/agent (mock: node mock-agent/server.mjs).
 *               AGENT_BASE = AGENT_URL bỏ đuôi "/agent" (cho /health và /threads/:id/messages).
 *
 * Chế độ:
 *   (mặc định)       Kiểm protocol/HTTP/schema + kỳ vọng từng kịch bản theo bảng từ khóa mục 6.D.
 *   --contract-only  Cho backend thật (không định tuyến theo từ khóa): mọi luật protocol, HTTP,
 *                    schema tool args, state, history vẫn bắt buộc; riêng kỳ vọng "kịch bản"
 *                    (vốn chỉ mock đảm bảo) chuyển thành SKIP. Tương đương SMOKE_CONTRACT_ONLY=1.
 *   --verbose        In từng event của mỗi run (hoặc SMOKE_VERBOSE=1).
 *   SMOKE_TIMEOUT_MS Timeout mỗi request, mặc định 30000.
 *
 * Exit code: 0 = không có FAIL (WARN/SKIP không tính) · 1 = có FAIL · 2 = không chạy được
 *            (không kết nối được server, hoặc tham số sai).
 */

import { randomUUID } from "node:crypto";

// ───────────────────────────── cấu hình ─────────────────────────────

const DEFAULT_AGENT_URL = "http://localhost:8787/agent";
const ORIGIN = "http://localhost:3001"; // giả lập trình duyệt (CORS middleware thật chỉ thêm header khi có Origin)
const TERMINAL_GRACE_MS = 5000; // sau event kết thúc, server phải đóng stream trong khoảng này
const MAX_REASONS = 12;

const KNOWN_FLAGS = new Set(["--contract-only", "--verbose", "--help", "-h"]);
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("-"));
const positional = argv.filter((a) => !a.startsWith("-"));

function usage() {
  return [
    "Cách dùng: node scripts/agui-smoke.mjs [AGENT_URL] [--contract-only] [--verbose]",
    `  AGENT_URL mặc định: biến môi trường AGENT_URL, hoặc ${DEFAULT_AGENT_URL}`,
    "  --contract-only  bỏ kỳ vọng theo từ khóa của mock (dùng cho backend thật)",
    "  --verbose        in từng event",
    "  SMOKE_TIMEOUT_MS timeout mỗi request (mặc định 30000)",
  ].join("\n");
}

if (flags.includes("--help") || flags.includes("-h")) {
  console.log(usage());
  process.exit(0);
}
const badFlags = flags.filter((f) => !KNOWN_FLAGS.has(f));
if (badFlags.length || positional.length > 1) {
  console.error(`Tham số không hợp lệ: ${[...badFlags, ...positional.slice(1)].join(" ")}\n${usage()}`);
  process.exit(2);
}

const AGENT_URL = positional[0] ?? process.env.AGENT_URL ?? DEFAULT_AGENT_URL;
try {
  const u = new URL(AGENT_URL);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("cần http hoặc https");
} catch (e) {
  console.error(`AGENT_URL không hợp lệ: ${AGENT_URL} (${e.message})\n${usage()}`);
  process.exit(2);
}
const AGENT_BASE = AGENT_URL.replace(/\/agent\/?$/, "").replace(/\/+$/, ""); // giống src/config.js (mục 4.1)
const CONTRACT_ONLY = flags.includes("--contract-only") || process.env.SMOKE_CONTRACT_ONLY === "1";
const VERBOSE = flags.includes("--verbose") || process.env.SMOKE_VERBOSE === "1";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS) > 0 ? Number(process.env.SMOKE_TIMEOUT_MS) : 30000;

// ───────────────────────────── hằng số hợp đồng ─────────────────────────────

const CONTRACT_EVENT_TYPES = new Set([
  "RUN_STARTED", "RUN_FINISHED", "RUN_ERROR",
  "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END",
  "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END", "TOOL_CALL_RESULT",
  "STATE_SNAPSHOT", "STATE_DELTA",
]);
// Event AG-UI hợp lệ (@ag-ui/core 1.0.5) nhưng nằm ngoài hợp đồng 4.8: chỉ WARN, không kiểm sâu.
const OTHER_AGUI_EVENT_TYPES = new Set([
  "TEXT_MESSAGE_CHUNK", "TOOL_CALL_CHUNK", "MESSAGES_SNAPSHOT", "ACTIVITY_SNAPSHOT", "ACTIVITY_DELTA",
  "RAW", "CUSTOM", "STEP_STARTED", "STEP_FINISHED",
  "REASONING_START", "REASONING_MESSAGE_START", "REASONING_MESSAGE_CONTENT", "REASONING_MESSAGE_END",
  "REASONING_MESSAGE_CHUNK", "REASONING_END", "REASONING_ENCRYPTED_VALUE",
  "SUBAGENT_STARTED", "SUBAGENT_FINISHED", "SUBAGENT_ERROR",
]);
const PATCH_OPS = new Set(["add", "remove", "replace", "move", "copy", "test"]);
const JSON_POINTER_RE = /^(\/([^/~]|~[01])*)*$/; // cùng pattern với schema @ag-ui/core
const MESSAGE_ROLES = new Set(["developer", "system", "assistant", "user", "tool", "activity", "reasoning"]);
const JOB_STATUSES = new Set(["running", "done", "error"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const CALLOUT_TONES = new Set(["info", "tip", "warning"]);
const KNOWN_TOOLS = new Set(["show_quiz", "show_mindmap", "cite_sources", "suggest_followups", "present_ui"]);

// ───────────────────────────── tiện ích ─────────────────────────────

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNonEmptyStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isInteger(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const snippet = (s, n = 100) => {
  const t = String(s).replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const fmt = (v) => (v === undefined ? "undefined" : snippet(JSON.stringify(v), 80));
const short = (id) => (isStr(id) ? id.slice(0, 8) : String(id));
const norm = (s) => String(s ?? "").normalize("NFC").trim();
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const deepEqual = (a, b) => stableStringify(a) === stableStringify(b);
const textOfContent = (c) =>
  isStr(c) ? c : Array.isArray(c) ? c.filter((p) => p?.type === "text" && isStr(p.text)).map((p) => p.text).join("\n") : "";

// ───────────────────────────── báo cáo ─────────────────────────────

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const tally = { pass: 0, fail: 0, warn: 0, skip: 0 };
const failedLabels = [];

function printReasons(reasons) {
  for (const r of reasons.slice(0, MAX_REASONS)) console.log(`        - ${r}`);
  if (reasons.length > MAX_REASONS) console.log(`        - … và ${reasons.length - MAX_REASONS} mục khác (chạy --verbose để xem từng event)`);
}
function pass(label, detail) {
  tally.pass++;
  console.log(`${paint("32", "PASS")}  ${label}${detail ? paint("2", ` — ${detail}`) : ""}`);
}
function fail(label, reasons) {
  tally.fail++;
  failedLabels.push(label);
  console.log(`${paint("31;1", "FAIL")}  ${label}`);
  printReasons([].concat(reasons));
}
function warn(label, reasons) {
  tally.warn++;
  console.log(`${paint("33", "WARN")}  ${label}`);
  printReasons([].concat(reasons));
}
function skip(label, why) {
  tally.skip++;
  console.log(`${paint("36", "SKIP")}  ${label} — ${why}`);
}
function check(label, problems, okDetail) {
  if (problems.length) fail(label, problems);
  else pass(label, okDetail);
  return problems.length === 0;
}
function section(title) {
  console.log(`\n${paint("1", `== ${title}`)}`);
}

// ───────────────────────────── mạng ─────────────────────────────

let serverDown = null; // lý do, khi server ngừng phản hồi giữa chừng

function describeFetchError(e) {
  if (e?.name === "TimeoutError") return `timeout sau ${TIMEOUT_MS} ms`;
  if (e?.name === "AbortError") return "request bị hủy";
  const c = e?.cause;
  if (c?.code) return `${c.code}${c.message ? ` (${c.message})` : ""}`;
  return e?.message ?? String(e);
}
function isConnectionError(e) {
  const code = e?.cause?.code;
  return ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "ECONNRESET", "UND_ERR_SOCKET"].includes(code);
}
function noteNetworkError(e) {
  if (isConnectionError(e) && !serverDown) serverDown = describeFetchError(e);
}

// ───────────────────────────── đăng ký id toàn cục (mục 4.8 luật 4) ─────────────────────────────

// Ba không gian id: message (text + tool result + id message user mình gửi), toolCall, interrupt.
const registry = { message: new Map(), toolCall: new Map(), interrupt: new Map() };

function registerId(ns, id, ctx) {
  const prev = registry[ns].get(id);
  if (prev) {
    if (ns === "message" && prev.parentOnly && prev.threadId === ctx.threadId) {
      registry[ns].set(id, ctx); // parentMessageId được khai báo trước rồi mới START: chấp nhận
      return null;
    }
    return `id ${fmt(id)} trùng với id đã dùng ở run "${prev.label}" (thread ${short(prev.threadId)}) — mục 4.8 luật 4: mọi id duy nhất trên toàn server`;
  }
  registry[ns].set(id, ctx);
  return null;
}
function checkParentId(id, ctx) {
  const prev = registry.message.get(id);
  if (!prev) {
    registry.message.set(id, { ...ctx, parentOnly: true });
    return null;
  }
  if (prev.threadId !== ctx.threadId) {
    return `parentMessageId ${fmt(id)} là id của thread khác (run "${prev.label}", thread ${short(prev.threadId)})`;
  }
  return null;
}

// ───────────────────────────── SSE ─────────────────────────────

/** POST một RunAgentInput, đọc SSE giống parser của @ag-ui/client (tách theo "\n\n", gom các dòng data:). */
async function postRun(input) {
  const out = {
    input, events: [], httpProblems: [], framing: [], framingWarn: [],
    transportError: null, closedAfterTerminal: null, startedAt: Date.now(), endedAt: null,
  };
  const graceCtl = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), graceCtl.signal]);
  let res;
  try {
    res = await fetch(AGENT_URL, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (e) {
    noteNetworkError(e);
    out.transportError = `không gửi được POST ${AGENT_URL}: ${describeFetchError(e)}`;
    out.endedAt = Date.now();
    return out;
  }
  const ct = res.headers.get("content-type") ?? "";
  const acao = res.headers.get("access-control-allow-origin");
  if (res.status !== 200) out.httpProblems.push(`HTTP ${res.status} (cần 200)`);
  if (!ct.toLowerCase().startsWith("text/event-stream")) out.httpProblems.push(`Content-Type ${fmt(ct)} (cần text/event-stream — mục 4.3)`);
  if (acao !== "*") out.httpProblems.push(`Access-Control-Allow-Origin ${acao === null ? "(thiếu)" : fmt(acao)} trên response POST (cần "*" — mục 4.3)`);
  if (res.status !== 200 || !res.body) {
    const body = await res.text().catch(() => "");
    out.transportError = res.status !== 200 ? `HTTP ${res.status}: ${snippet(body, 200)}` : "response không có body";
    out.endedAt = Date.now();
    return out;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  let sawCR = false;
  let block = 0;
  let terminalSeen = false;
  let graceTimer = null;

  const handleBlock = (raw) => {
    const data = [];
    for (const line of raw.split("\n")) if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    if (data.length === 0) return; // comment / keep-alive
    const b = block++;
    if (data.length > 1) out.framingWarn.push(`block SSE #${b} có ${data.length} dòng data: (mục 4.3: mỗi dòng data: chứa đúng một event JSON)`);
    let ev;
    try {
      ev = JSON.parse(data.join("\n"));
    } catch (e) {
      out.framing.push(`block SSE #${b}: JSON không hợp lệ (${e.message}) — @ag-ui/client sẽ dừng stream tại đây; dữ liệu: ${snippet(data.join("\\n"), 120)}`);
      return;
    }
    out.events.push(ev);
    if (!terminalSeen && (ev?.type === "RUN_FINISHED" || ev?.type === "RUN_ERROR")) {
      terminalSeen = true;
      graceTimer = setTimeout(() => graceCtl.abort(), TERMINAL_GRACE_MS);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk.includes("\r")) sawCR = true;
      buf += chunk;
      const parts = buf.split(/\n\n/);
      buf = parts.pop() ?? "";
      for (const p of parts) handleBlock(p);
    }
    buf += decoder.decode();
    if (terminalSeen) out.closedAfterTerminal = true;
  } catch (e) {
    if (graceCtl.signal.aborted) out.closedAfterTerminal = false;
    else {
      noteNetworkError(e);
      out.transportError = `lỗi khi đọc stream: ${describeFetchError(e)} (đã nhận ${out.events.length} event${terminalSeen ? "" : ", chưa có event kết thúc"})`;
    }
  } finally {
    clearTimeout(graceTimer);
  }
  if (buf.trim().length) {
    out.framing.push(`stream kết thúc với dữ liệu không có "\\n\\n" ở cuối (mục 4.3): ${snippet(buf, 120)}`);
    handleBlock(buf); // @ag-ui/client vẫn parse phần dư — phân tích tiếp như client
  }
  if (sawCR) out.framing.push('stream có ký tự "\\r" (CRLF) — parser của @ag-ui/client chỉ tách event theo "\\n\\n"');
  out.endedAt = Date.now();
  return out;
}

// ───────────────────────────── JSON Patch (RFC 6902) ─────────────────────────────

const ARRAY_INDEX_RE = /^(0|[1-9]\d*)$/;
function decodePointer(path) {
  if (path === "") return [];
  return path.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function childOf(cur, tok) {
  if (Array.isArray(cur)) return ARRAY_INDEX_RE.test(tok) ? cur[Number(tok)] : undefined;
  if (isObj(cur)) return Object.prototype.hasOwnProperty.call(cur, tok) ? cur[tok] : undefined;
  return undefined;
}
function getAt(root, path) {
  let cur = root;
  for (const t of decodePointer(path)) {
    cur = childOf(cur, t);
    if (cur === undefined) throw new Error(`"${path}" không tồn tại`);
  }
  return cur;
}
function parentOf(root, path) {
  const tokens = decodePointer(path);
  const parent = getAt(root, tokens.length > 1 ? `/${tokens.slice(0, -1).map((t) => t.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}` : "");
  return [parent, tokens.at(-1)];
}
function addAt(root, path, value) {
  if (path === "") return value;
  const [parent, key] = parentOf(root, path);
  if (Array.isArray(parent)) {
    if (key === "-") parent.push(value);
    else if (ARRAY_INDEX_RE.test(key) && Number(key) <= parent.length) parent.splice(Number(key), 0, value);
    else throw new Error(`index mảng "${key}" không hợp lệ tại "${path}"`);
  } else if (isObj(parent)) parent[key] = value;
  else throw new Error(`cha của "${path}" không phải object/mảng`);
  return root;
}
function removeAt(root, path) {
  if (path === "") throw new Error("không được remove gốc");
  const [parent, key] = parentOf(root, path);
  if (Array.isArray(parent) && ARRAY_INDEX_RE.test(key) && Number(key) < parent.length) parent.splice(Number(key), 1);
  else if (isObj(parent) && Object.prototype.hasOwnProperty.call(parent, key)) delete parent[key];
  else throw new Error(`"${path}" không tồn tại để remove`);
  return root;
}
function applyPatch(doc, ops) {
  let root = clone(doc);
  ops.forEach((op, k) => {
    try {
      switch (op.op) {
        case "add": root = addAt(root, op.path, clone(op.value)); break;
        case "remove": root = removeAt(root, op.path); break;
        case "replace":
          getAt(root, op.path);
          root = op.path === "" ? clone(op.value) : addAt(removeAt(root, op.path), op.path, clone(op.value));
          break;
        case "move": {
          if (op.path.startsWith(`${op.from}/`)) throw new Error("không được move vào chính con của nó");
          const v = getAt(root, op.from);
          root = addAt(removeAt(root, op.from), op.path, v);
          break;
        }
        case "copy": root = addAt(root, op.path, clone(getAt(root, op.from))); break;
        case "test":
          if (!deepEqual(getAt(root, op.path), op.value)) throw new Error(`test thất bại tại "${op.path}"`);
          break;
        default: throw new Error(`op ${fmt(op.op)} không hỗ trợ`);
      }
    } catch (e) {
      throw new Error(`delta[${k}] (${op.op} ${op.path}): ${e.message}`);
    }
  });
  return root;
}
function validatePatchOp(op) {
  if (!isObj(op)) return [`không phải object (nhận ${kindOf(op)})`];
  const p = [];
  if (!PATCH_OPS.has(op.op)) p.push(`op ${fmt(op.op)} không thuộc RFC 6902 (add|remove|replace|move|copy|test)`);
  if (!isStr(op.path) || !op.path.startsWith("/")) p.push(`path ${fmt(op.path)} phải là string bắt đầu bằng "/"`);
  else if (!JSON_POINTER_RE.test(op.path)) p.push(`path ${fmt(op.path)} không phải JSON Pointer hợp lệ (~ phải viết ~0/~1)`);
  if (["add", "replace", "test"].includes(op.op) && !("value" in op)) p.push(`op "${op.op}" thiếu "value"`);
  if (["move", "copy"].includes(op.op) && (!isStr(op.from) || !op.from.startsWith("/") || !JSON_POINTER_RE.test(op.from))) {
    p.push(`from ${fmt(op.from)} phải là JSON Pointer bắt đầu bằng "/"`);
  }
  return p;
}

// ───────────────────────────── state (mục 4.7) ─────────────────────────────

function validateState(s) {
  if (!isObj(s)) return [`state phải là object (nhận ${kindOf(s)})`];
  const p = [];
  const a = s.artifacts;
  if (!isObj(a)) p.push(`state.artifacts phải là object (nhận ${kindOf(a)})`);
  else {
    if (!Array.isArray(a.quizzes)) p.push(`state.artifacts.quizzes phải là mảng (nhận ${kindOf(a.quizzes)})`);
    else a.quizzes.forEach((q, k) => {
      const at = `state.artifacts.quizzes[${k}]`;
      if (!isObj(q)) return p.push(`${at} phải là object`);
      if (!isNonEmptyStr(q.id)) p.push(`${at}.id phải là string không rỗng`);
      if (!isStr(q.title)) p.push(`${at}.title phải là string`);
      if (!isInt(q.count) || q.count < 0) p.push(`${at}.count phải là số nguyên ≥ 0 (nhận ${fmt(q.count)})`);
    });
    if (!Array.isArray(a.mindmaps)) p.push(`state.artifacts.mindmaps phải là mảng (nhận ${kindOf(a.mindmaps)})`);
    else a.mindmaps.forEach((m, k) => {
      const at = `state.artifacts.mindmaps[${k}]`;
      if (!isObj(m)) return p.push(`${at} phải là object`);
      if (!isNonEmptyStr(m.id)) p.push(`${at}.id phải là string không rỗng`);
      if (!isStr(m.title)) p.push(`${at}.title phải là string`);
    });
  }
  const j = s.jobs;
  if (!isObj(j)) p.push(`state.jobs phải là object map jobId → job (nhận ${kindOf(j)})`);
  else for (const [id, job] of Object.entries(j)) {
    const at = `state.jobs.${id}`;
    if (!isObj(job)) { p.push(`${at} phải là object`); continue; }
    if (!isStr(job.kind)) p.push(`${at}.kind phải là string`);
    if (!isStr(job.label)) p.push(`${at}.label phải là string`);
    if (!isInt(job.progress) || job.progress < 0 || job.progress > 100) p.push(`${at}.progress phải là số nguyên 0..100 (nhận ${fmt(job.progress)})`);
    if (!JOB_STATUSES.has(job.status)) p.push(`${at}.status ${fmt(job.status)} không thuộc running|done|error`);
  }
  return p;
}
function stateWarnings(s) {
  const w = [];
  const size = JSON.stringify(s ?? null).length;
  if (size > 64 * 1024) w.push(`state nặng ${size} byte (mục 4.7: không đặt dữ liệu lớn vào state)`);
  const longStr = (v) => (isStr(v) ? v.length > 10000 : Array.isArray(v) ? v.some(longStr) : isObj(v) ? Object.values(v).some(longStr) : false);
  if (longStr(s)) w.push("state có string > 10000 ký tự (nghi base64/dữ liệu lớn — mục 4.7)");
  for (const kind of ["quizzes", "mindmaps"]) {
    const ids = arr(s?.artifacts?.[kind]).map((x) => x?.id).filter(isStr);
    if (new Set(ids).size !== ids.length) w.push(`state.artifacts.${kind} có id trùng (React key)`);
  }
  return w;
}

// ───────────────────────────── tool args (mục 4.5) ─────────────────────────────

function reqStr(o, key, at, p) {
  if (!isStr(o?.[key])) p.push(`${at ? `${at}.` : ""}${key} phải là string (nhận ${kindOf(o?.[key])})`);
}
function optStr(o, key, at, p) {
  const v = o?.[key];
  if (v !== undefined && !isStr(v)) p.push(`${at ? `${at}.` : ""}${key} phải là string hoặc bỏ hẳn (nhận ${kindOf(v)})`);
}

const BLOCK_VALIDATORS = {
  callout(b, at, p) {
    if (!CALLOUT_TONES.has(b.tone)) p.push(`${at}.tone ${fmt(b.tone)} không thuộc info|tip|warning`);
    reqStr(b, "title", at, p);
    reqStr(b, "body_md", at, p);
  },
  steps(b, at, p) {
    if (!Array.isArray(b.items)) return p.push(`${at}.items phải là mảng`);
    b.items.forEach((it, k) => {
      if (!isObj(it)) return p.push(`${at}.items[${k}] phải là object`);
      reqStr(it, "title", `${at}.items[${k}]`, p);
      reqStr(it, "body_md", `${at}.items[${k}]`, p);
    });
  },
  comparison_table(b, at, p, w) {
    const colsOk = Array.isArray(b.columns) && b.columns.every(isStr);
    if (!colsOk) p.push(`${at}.columns phải là string[]`);
    if (!Array.isArray(b.rows)) p.push(`${at}.rows phải là string[][]`);
    else b.rows.forEach((r, k) => {
      if (!Array.isArray(r) || !r.every(isStr)) p.push(`${at}.rows[${k}] phải là string[]`);
      else if (colsOk && r.length !== b.columns.length) w.push(`${at}.rows[${k}] có ${r.length} ô, columns có ${b.columns.length}`);
    });
    if (b.highlight_col !== undefined) {
      if (!isInt(b.highlight_col)) p.push(`${at}.highlight_col phải là số nguyên hoặc bỏ hẳn (nhận ${fmt(b.highlight_col)})`);
      else if (colsOk && (b.highlight_col < 0 || b.highlight_col >= b.columns.length)) {
        p.push(`${at}.highlight_col=${b.highlight_col} ngoài [0, ${b.columns.length}) — mục 4.5: đếm từ 0 theo columns`);
      }
    }
  },
  code_diff(b, at, p) {
    for (const k of ["language", "before", "after", "explanation_md"]) reqStr(b, k, at, p);
  },
  concept_card(b, at, p) {
    reqStr(b, "term", at, p);
    reqStr(b, "definition_md", at, p);
    optStr(b, "example_code", at, p);
    optStr(b, "language", at, p);
  },
};

const TOOL_VALIDATORS = {
  show_quiz(a, p, w) {
    reqStr(a, "title", "", p);
    if (!Array.isArray(a.questions)) return p.push(`questions phải là mảng (nhận ${kindOf(a.questions)})`);
    if (a.questions.length === 0) w.push("questions rỗng");
    const ids = new Set();
    a.questions.forEach((q, k) => {
      const at = `questions[${k}]`;
      if (!isObj(q)) return p.push(`${at} phải là object`);
      reqStr(q, "id", at, p);
      reqStr(q, "question", at, p);
      reqStr(q, "explanation", at, p);
      const optsOk = Array.isArray(q.options) && q.options.every(isStr);
      if (!optsOk) p.push(`${at}.options phải là string[]`);
      else if (q.options.length < 2) w.push(`${at}.options chỉ có ${q.options.length} lựa chọn`);
      if (!isInt(q.answer_index)) p.push(`${at}.answer_index phải là số nguyên (nhận ${fmt(q.answer_index)})`);
      else if (optsOk && (q.answer_index < 0 || q.answer_index >= q.options.length)) {
        p.push(`${at}.answer_index=${q.answer_index} ngoài phạm vi options (0..${q.options.length - 1})`);
      }
      if (!DIFFICULTIES.has(q.difficulty)) p.push(`${at}.difficulty ${fmt(q.difficulty)} không thuộc easy|medium|hard`);
      if (isStr(q.id)) {
        if (ids.has(q.id)) w.push(`${at}.id ${fmt(q.id)} trùng (React key)`);
        ids.add(q.id);
      }
    });
  },
  show_mindmap(a, p, w) {
    reqStr(a, "title", "", p);
    if (!isObj(a.root)) return p.push(`root phải là object Node (nhận ${kindOf(a.root)})`);
    const ids = new Set();
    let count = 0;
    const walk = (n, at, depth) => {
      count++;
      if (depth > 50) return p.push(`${at}: sâu quá 50 cấp`);
      reqStr(n, "id", at, p);
      reqStr(n, "label", at, p);
      if (isStr(n.id)) {
        if (ids.has(n.id)) w.push(`${at}.id ${fmt(n.id)} trùng (React key)`);
        ids.add(n.id);
      }
      if (n.children === undefined) return;
      if (!Array.isArray(n.children)) return p.push(`${at}.children phải là mảng Node hoặc bỏ hẳn (nhận ${kindOf(n.children)})`);
      n.children.forEach((c, k) => (isObj(c) ? walk(c, `${at}.children[${k}]`, depth + 1) : p.push(`${at}.children[${k}] phải là object Node`)));
    };
    walk(a.root, "root", 0);
    if (count > 500) w.push(`mindmap có ${count} node`);
  },
  cite_sources(a, p, w) {
    if (!Array.isArray(a.sources)) return p.push(`sources phải là mảng (nhận ${kindOf(a.sources)})`);
    if (a.sources.length === 0) w.push("sources rỗng");
    a.sources.forEach((s, k) => {
      const at = `sources[${k}]`;
      if (!isObj(s)) return p.push(`${at} phải là object`);
      reqStr(s, "file_id", at, p);
      reqStr(s, "file_name", at, p);
      reqStr(s, "quote", at, p);
      if (s.page !== undefined) {
        if (typeof s.page !== "number" || !Number.isFinite(s.page)) p.push(`${at}.page phải là number hoặc bỏ hẳn (nhận ${kindOf(s.page)})`);
        else if (!isInt(s.page) || s.page < 1) w.push(`${at}.page=${s.page} không phải số trang nguyên ≥ 1`);
      }
    });
  },
  suggest_followups(a, p, w) {
    if (!Array.isArray(a.questions) || !a.questions.every(isStr)) return p.push("questions phải là string[]");
    if (a.questions.length === 0) w.push("questions rỗng");
  },
  present_ui(a, p, w) {
    optStr(a, "title", "", p);
    if (!Array.isArray(a.blocks)) return p.push(`blocks phải là mảng (nhận ${kindOf(a.blocks)})`);
    a.blocks.forEach((b, k) => {
      const at = `blocks[${k}]`;
      if (!isObj(b)) return p.push(`${at} phải là object`);
      if (!isStr(b.type)) return p.push(`${at}.type phải là string`);
      const v = BLOCK_VALIDATORS[b.type];
      if (!v) return w.push(`${at}.type ${fmt(b.type)} lạ — frontend hiện "Không hỗ trợ khối này" (hợp lệ theo mục 4.5)`);
      v(b, at, p, w);
    });
  },
};

function validateInterrupt(it) {
  const p = [];
  const w = [];
  if (!isObj(it)) return { p: [`không phải object (nhận ${kindOf(it)})`], w };
  if (!isNonEmptyStr(it.id)) p.push(".id phải là string không rỗng");
  if (!isNonEmptyStr(it.reason)) p.push(".reason phải là string không rỗng");
  if (it.message !== undefined && !isStr(it.message)) p.push(".message phải là string hoặc bỏ hẳn");
  if (it.metadata !== undefined && !isObj(it.metadata)) p.push(".metadata phải là object hoặc bỏ hẳn");
  if (isObj(it.metadata) && it.metadata.kind === "quiz_config") {
    const m = it.metadata;
    if (!isNonEmptyStr(it.message)) w.push(".message trống — mục 4.6 có message cho quiz_config");
    if (!isObj(m.defaults)) p.push(".metadata.defaults phải là object {count, difficulty} (mục 4.6)");
    else {
      if (!isInt(m.defaults.count) || m.defaults.count < 1) p.push(`.metadata.defaults.count phải là số nguyên ≥ 1 (nhận ${fmt(m.defaults.count)})`);
      if (!DIFFICULTIES.has(m.defaults.difficulty)) p.push(`.metadata.defaults.difficulty ${fmt(m.defaults.difficulty)} không thuộc easy|medium|hard`);
    }
    if (!Array.isArray(m.documents)) p.push(`.metadata.documents phải là mảng (nhận ${kindOf(m.documents)})`);
  }
  return { p, w };
}

// ───────────────────────────── phân tích một run ─────────────────────────────

// Event không đóng chuỗi *_CHUNK đang mở (theo @ag-ui/client 1.0.5); mọi event khác đều đóng.
const NON_CLOSING_TYPES = new Set(["RAW", "ACTIVITY_SNAPSHOT", "ACTIVITY_DELTA", "REASONING_ENCRYPTED_VALUE", "SUBAGENT_STARTED"]);

/**
 * Mục 4.8 điểm 6: TEXT_MESSAGE_CHUNK / TOOL_CALL_CHUNK hợp lệ. Mở rộng chúng thành START/CONTENT|ARGS/END
 * giống client (chunk đầu mở, chunk cùng id nối tiếp, event thường kế tiếp tự đóng), rồi mới kiểm 4.8.
 * Trả về [{ ev, i }] với i = vị trí event gốc trong stream.
 */
function expandChunks(events, P, chunkCount) {
  const out = [];
  let pending = null; // { kind: "text" | "tool", id }
  const close = (i) => {
    if (!pending) return;
    out.push({ i, ev: pending.kind === "text" ? { type: "TEXT_MESSAGE_END", messageId: pending.id } : { type: "TOOL_CALL_END", toolCallId: pending.id } });
    pending = null;
  };
  events.forEach((ev, i) => {
    const t = isObj(ev) ? ev.type : undefined;
    if (t === "TEXT_MESSAGE_CHUNK" || t === "TOOL_CALL_CHUNK") {
      chunkCount.set(t, (chunkCount.get(t) ?? 0) + 1);
      const text = t === "TEXT_MESSAGE_CHUNK";
      const id = text ? ev.messageId : ev.toolCallId;
      const kind = text ? "text" : "tool";
      if (!(pending?.kind === kind && (id === undefined || id === pending.id))) {
        close(i);
        if (!isNonEmptyStr(id)) { P.push(`event #${i} ${t}: chunk đầu tiên phải có ${text ? "messageId" : "toolCallId"} (client @ag-ui ném lỗi)`); return; }
        if (!text && !isNonEmptyStr(ev.toolCallName)) { P.push(`event #${i} ${t}: chunk đầu tiên phải có toolCallName (client @ag-ui ném lỗi)`); return; }
        pending = { kind, id };
        out.push({ i, ev: text
          ? { type: "TEXT_MESSAGE_START", messageId: id, role: ev.role ?? "assistant" }
          : { type: "TOOL_CALL_START", toolCallId: id, toolCallName: ev.toolCallName, ...(ev.parentMessageId !== undefined ? { parentMessageId: ev.parentMessageId } : {}) } });
      }
      if (ev.delta !== undefined) {
        out.push({ i, ev: text ? { type: "TEXT_MESSAGE_CONTENT", messageId: pending.id, delta: ev.delta } : { type: "TOOL_CALL_ARGS", toolCallId: pending.id, delta: ev.delta } });
      }
      return;
    }
    if (t !== undefined && !NON_CLOSING_TYPES.has(t)) close(i);
    out.push({ ev, i });
  });
  return out;
}

/**
 * Kiểm toàn bộ luật 4.8 trên chuỗi event, đồng thời mô phỏng client: dựng lại danh sách message
 * (giống cách @ag-ui/client áp event) và state (áp STATE_SNAPSHOT/STATE_DELTA) cho run tiếp theo.
 */
function analyzeRun(run, thread, runLabel) {
  const { input, events } = run;
  const ctx = { threadId: input.threadId, label: runLabel };
  const P = []; // protocol (4.8)
  const W = [];
  const T = []; // tool args (4.5)
  const TW = [];
  const S = []; // state (4.7 + RFC 6902)
  const SW = [];
  const texts = [];
  const textById = new Map();
  const calls = [];
  const callById = new Map();
  const interrupts = [];
  const otherTypes = new Map();
  const nullFields = new Set();
  let sim = clone(input.messages);
  const chunkCount = new Map();
  let state = clone(isObj(input.state) ? input.state : {});
  let stateBroken = false;
  // mốc so sánh artifact = state client gửi lên (không phụ thuộc server có phát snapshot đầu run hay không)
  const baseline = clone(isObj(input.state) ? input.state : {});
  let snapshots = 0;
  let deltas = 0;
  const jobTimeline = new Map();
  const seenStateIssues = new Set();
  let terminal = null;
  const at = (i, ev, msg) => `event #${i} ${isStr(ev?.type) ? ev.type : "?"}: ${msg}`;

  const recordState = (i, ev) => {
    for (const issue of validateState(state)) {
      if (!seenStateIssues.has(issue)) {
        seenStateIssues.add(issue);
        S.push(at(i, ev, issue));
      }
    }
    for (const w of stateWarnings(state)) if (!SW.includes(w)) SW.push(w);
    if (isObj(state?.jobs)) {
      for (const [jid, job] of Object.entries(state.jobs)) {
        if (!isObj(job)) continue;
        const tl = jobTimeline.get(jid) ?? [];
        const last = tl.at(-1);
        if (!last || last.progress !== job.progress || last.status !== job.status) {
          tl.push({ index: i, kind: job.kind, progress: job.progress, status: job.status });
        }
        jobTimeline.set(jid, tl);
      }
    }
  };

  expandChunks(events, P, chunkCount).forEach(({ ev, i }) => {
    if (!isObj(ev) || !isStr(ev.type)) {
      P.push(`event #${i}: không phải JSON object có field "type" kiểu string`);
      return;
    }
    for (const [k, v] of Object.entries(ev)) {
      if (v === null && k !== "rawEvent" && !nullFields.has(`${ev.type}.${k}`)) {
        nullFields.add(`${ev.type}.${k}`);
        W.push(at(i, ev, `field "${k}" = null — field optional nên bỏ hẳn (schema @ag-ui/core 1.0.5 từ chối null)`));
      }
    }
    if (i === 0 && ev.type !== "RUN_STARTED") P.push(at(i, ev, "event đầu tiên phải là RUN_STARTED (luật 1)"));
    if (terminal) {
      P.push(at(i, ev, `phát sau event kết thúc #${terminal.index} ${terminal.event.type} (luật 1)`));
      return;
    }
    switch (ev.type) {
      case "RUN_STARTED":
        if (i !== 0) P.push(at(i, ev, "RUN_STARTED chỉ được là event đầu tiên — một run mỗi stream (luật 1)"));
        if (ev.threadId !== input.threadId) P.push(at(i, ev, `threadId ${fmt(ev.threadId)} ≠ input ${fmt(input.threadId)}`));
        if (ev.runId !== input.runId) P.push(at(i, ev, `runId ${fmt(ev.runId)} ≠ input ${fmt(input.runId)}`));
        break;

      case "RUN_FINISHED": {
        terminal = { index: i, event: ev };
        if (ev.threadId !== input.threadId) P.push(at(i, ev, `threadId ${fmt(ev.threadId)} ≠ input ${fmt(input.threadId)}`));
        if (ev.runId !== input.runId) P.push(at(i, ev, `runId ${fmt(ev.runId)} ≠ input ${fmt(input.runId)}`));
        for (const t of texts) if (t.open) P.push(at(i, ev, `text message ${fmt(t.id)} chưa TEXT_MESSAGE_END (luật 4)`));
        for (const c of calls) {
          if (!c.ended) P.push(at(i, ev, `tool call ${fmt(c.id)} (${c.name}) chưa TOOL_CALL_END (luật 4)`));
          else if (!c.result) P.push(at(i, ev, `tool call ${fmt(c.id)} (${c.name}) thiếu TOOL_CALL_RESULT (luật 3)`));
        }
        if (ev.outcome !== undefined && ev.outcome !== null) {
          const o = ev.outcome;
          if (!isObj(o) || !isStr(o.type)) P.push(at(i, ev, "outcome phải là object có field type"));
          else if (o.type === "interrupt") {
            if (!Array.isArray(o.interrupts) || o.interrupts.length === 0) P.push(at(i, ev, "outcome.interrupts phải là mảng ≥ 1 phần tử (mục 4.6)"));
            else o.interrupts.forEach((it, k) => {
              const v = validateInterrupt(it);
              v.p.forEach((m) => P.push(at(i, ev, `outcome.interrupts[${k}]${m}`)));
              v.w.forEach((m) => W.push(at(i, ev, `outcome.interrupts[${k}]${m}`)));
              if (isNonEmptyStr(it?.id)) {
                const dup = registerId("interrupt", it.id, ctx);
                if (dup) P.push(at(i, ev, dup));
              }
              interrupts.push(it);
            });
            if (!texts.some((t) => !t.open && t.text.length > 0)) {
              P.push(at(i, ev, "interrupt nhưng run không có assistant text message (đã đóng, có nội dung) nào trước đó — mục 4.6"));
            }
          } else if (o.type !== "success" && o.type !== "cancelled") {
            P.push(at(i, ev, `outcome.type ${fmt(o.type)} không thuộc success|interrupt|cancelled`));
          }
        }
        break;
      }

      case "RUN_ERROR":
        terminal = { index: i, event: ev };
        if (!isStr(ev.message)) P.push(at(i, ev, `message phải là string (nhận ${kindOf(ev.message)})`));
        else if (!ev.message.trim()) W.push(at(i, ev, "message rỗng"));
        if (ev.code !== undefined && ev.code !== null && !isStr(ev.code)) P.push(at(i, ev, `code phải là string (nhận ${kindOf(ev.code)})`));
        break;

      case "TEXT_MESSAGE_START": {
        if (!isNonEmptyStr(ev.messageId)) { P.push(at(i, ev, "thiếu messageId (string không rỗng)")); break; }
        if (ev.role !== "assistant") P.push(at(i, ev, `role ${fmt(ev.role)} (cần "assistant" — luật 2)`));
        if (textById.has(ev.messageId)) { P.push(at(i, ev, `messageId ${fmt(ev.messageId)} đã START trong run này`)); break; }
        const dup = registerId("message", ev.messageId, ctx);
        if (dup) P.push(at(i, ev, dup));
        const t = { id: ev.messageId, text: "", open: true, contentCount: 0, index: i };
        texts.push(t);
        textById.set(t.id, t);
        sim.push({ id: t.id, role: "assistant", content: "" });
        break;
      }

      case "TEXT_MESSAGE_CONTENT": {
        const t = textById.get(ev.messageId);
        if (!t) { P.push(at(i, ev, `messageId ${fmt(ev.messageId)} chưa có TEXT_MESSAGE_START (luật 2)`)); break; }
        if (!t.open) { P.push(at(i, ev, `messageId ${fmt(ev.messageId)} đã TEXT_MESSAGE_END (luật 2)`)); break; }
        if (!isStr(ev.delta) || ev.delta.length === 0) {
          P.push(at(i, ev, `delta phải là string không rỗng (nhận ${fmt(ev.delta)}) — luật 2`));
          if (!isStr(ev.delta)) break;
        }
        t.text += ev.delta;
        t.contentCount++;
        const m = sim.find((x) => x.id === t.id && x.role === "assistant");
        if (m) m.content += ev.delta;
        break;
      }

      case "TEXT_MESSAGE_END": {
        const t = textById.get(ev.messageId);
        if (!t) P.push(at(i, ev, `messageId ${fmt(ev.messageId)} chưa có TEXT_MESSAGE_START (luật 2)`));
        else if (!t.open) P.push(at(i, ev, `messageId ${fmt(ev.messageId)} END hai lần`));
        else {
          t.open = false;
          if (t.contentCount === 0) W.push(at(i, ev, `text message ${fmt(t.id)} không có TEXT_MESSAGE_CONTENT nào (bubble rỗng)`));
        }
        break;
      }

      case "TOOL_CALL_START": {
        if (!isNonEmptyStr(ev.toolCallId)) { P.push(at(i, ev, "thiếu toolCallId (string không rỗng)")); break; }
        if (!isNonEmptyStr(ev.toolCallName)) P.push(at(i, ev, "thiếu toolCallName (string không rỗng)"));
        if (callById.has(ev.toolCallId)) { P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} đã START trong run này`)); break; }
        const dup = registerId("toolCall", ev.toolCallId, ctx);
        if (dup) P.push(at(i, ev, dup));
        if (!isNonEmptyStr(ev.parentMessageId)) P.push(at(i, ev, `thiếu parentMessageId (luật 3; nhận ${fmt(ev.parentMessageId)})`));
        else {
          const bad = checkParentId(ev.parentMessageId, ctx);
          if (bad) P.push(at(i, ev, bad));
        }
        const c = {
          id: ev.toolCallId, name: ev.toolCallName, parentMessageId: ev.parentMessageId,
          argsText: "", ended: false, args: undefined, result: null, index: i, simRef: null,
        };
        calls.push(c);
        callById.set(c.id, c);
        // mô phỏng @ag-ui/client: gắn vào assistant message có id = parentMessageId, nếu không có thì tạo mới
        const tc = { id: c.id, type: "function", function: { name: String(c.name ?? ""), arguments: "" } };
        let owner = isNonEmptyStr(c.parentMessageId) ? sim.find((m) => m.id === c.parentMessageId) : undefined;
        let newId = isNonEmptyStr(c.parentMessageId) ? c.parentMessageId : c.id;
        if (owner && owner.role !== "assistant") {
          W.push(at(i, ev, `parentMessageId ${fmt(c.parentMessageId)} trỏ tới message role "${owner.role}" — client sẽ tạo assistant message mới`));
          owner = undefined;
          newId = c.id;
        }
        if (!owner) {
          owner = { id: newId, role: "assistant", toolCalls: [] };
          sim.push(owner);
        }
        (owner.toolCalls ??= []).push(tc);
        c.simRef = tc;
        break;
      }

      case "TOOL_CALL_ARGS": {
        const c = callById.get(ev.toolCallId);
        if (!c) P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} chưa có TOOL_CALL_START (luật 3)`));
        else if (c.ended) P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} đã TOOL_CALL_END (luật 3)`));
        else if (!isStr(ev.delta)) P.push(at(i, ev, `delta phải là string (nhận ${kindOf(ev.delta)})`));
        else {
          c.argsText += ev.delta;
          c.simRef.function.arguments += ev.delta;
        }
        break;
      }

      case "TOOL_CALL_END": {
        const c = callById.get(ev.toolCallId);
        if (!c) { P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} chưa có TOOL_CALL_START (luật 3)`)); break; }
        if (c.ended) { P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} END hai lần`)); break; }
        c.ended = true;
        try {
          const a = JSON.parse(c.argsText);
          if (!isObj(a)) P.push(at(i, ev, `args của ${c.name} phải là JSON object (nhận ${kindOf(a)})`));
          else c.args = a;
        } catch (e) {
          P.push(at(i, ev, `ghép các TOOL_CALL_ARGS.delta của ${fmt(c.id)} (${c.name}) không ra JSON hợp lệ: ${e.message}; argsText="${snippet(c.argsText, 80)}" (luật 3)`));
        }
        break;
      }

      case "TOOL_CALL_RESULT": {
        const c = callById.get(ev.toolCallId);
        if (!c) P.push(at(i, ev, `toolCallId ${fmt(ev.toolCallId)} không thuộc tool call nào của run này`));
        else if (!c.ended) P.push(at(i, ev, `RESULT đến trước TOOL_CALL_END của ${fmt(c.id)} (luật 3)`));
        else if (c.result) P.push(at(i, ev, `tool call ${fmt(c.id)} có RESULT lần hai`));
        if (!isNonEmptyStr(ev.messageId)) P.push(at(i, ev, "thiếu messageId (string không rỗng) — luật 3"));
        else {
          const dup = registerId("message", ev.messageId, ctx);
          if (dup) P.push(at(i, ev, dup));
        }
        if (ev.role !== "tool") P.push(at(i, ev, `role ${fmt(ev.role)} (cần "tool" — luật 3)`));
        if (!isStr(ev.content)) {
          if (Array.isArray(ev.content)) W.push(at(i, ev, "content là mảng ContentPart; hợp đồng dùng string"));
          else P.push(at(i, ev, `content phải là string (nhận ${kindOf(ev.content)})`));
        } else if (c && KNOWN_TOOLS.has(c.name) && ev.content !== "ok") {
          W.push(at(i, ev, `content ${fmt(ev.content)} — mục 4.5 ghi "ok" (frontend không phụ thuộc)`));
        }
        if (c && c.ended && !c.result) c.result = { messageId: ev.messageId, content: ev.content, index: i };
        if (isNonEmptyStr(ev.messageId)) sim.push({ id: ev.messageId, role: "tool", toolCallId: ev.toolCallId, content: ev.content });
        break;
      }

      case "STATE_SNAPSHOT": {
        snapshots++;
        if (!isObj(ev.snapshot)) { S.push(at(i, ev, `snapshot phải là JSON object (nhận ${kindOf(ev.snapshot)})`)); break; }
        for (const k of ["artifacts", "jobs"]) if (!(k in ev.snapshot)) S.push(at(i, ev, `snapshot thiếu khóa "${k}" (mục 4.7)`));
        state = clone(ev.snapshot);
        stateBroken = false;
        recordState(i, ev);
        break;
      }

      case "STATE_DELTA": {
        deltas++;
        if (!Array.isArray(ev.delta)) { S.push(at(i, ev, `delta phải là mảng JSON Patch (nhận ${kindOf(ev.delta)})`)); stateBroken = true; break; }
        if (ev.delta.length === 0) SW.push(at(i, ev, "delta rỗng"));
        let opsOk = true;
        ev.delta.forEach((op, k) => validatePatchOp(op).forEach((m) => { S.push(at(i, ev, `delta[${k}]: ${m}`)); opsOk = false; }));
        if (!opsOk) { stateBroken = true; break; }
        if (stateBroken) { SW.push(at(i, ev, "không áp patch vì state trước đó đã lỗi")); break; }
        try {
          state = applyPatch(state, ev.delta);
          recordState(i, ev);
        } catch (e) {
          S.push(at(i, ev, `áp patch lên state hiện tại của client thất bại: ${e.message}`));
          stateBroken = true;
        }
        break;
      }

      case "MESSAGES_SNAPSHOT":
        otherTypes.set(ev.type, (otherTypes.get(ev.type) ?? 0) + 1);
        if (!Array.isArray(ev.messages)) P.push(at(i, ev, `messages phải là mảng (nhận ${kindOf(ev.messages)})`));
        else sim = clone(ev.messages); // @ag-ui/client thay transcript bằng snapshot → run sau gửi đúng các id này
        break;

      default:
        if (OTHER_AGUI_EVENT_TYPES.has(ev.type)) otherTypes.set(ev.type, (otherTypes.get(ev.type) ?? 0) + 1);
        else P.push(at(i, ev, `type ${fmt(ev.type)} không phải event AG-UI`));
    }
  });

  if (events.length === 0) P.push("không nhận được event nào");
  else if (!terminal) P.push(`không có event kết thúc RUN_FINISHED/RUN_ERROR; event cuối là #${events.length - 1} ${events.at(-1)?.type} (luật 1)`);
  if (run.closedAfterTerminal === false) P.push(`server không đóng stream trong ${TERMINAL_GRACE_MS} ms sau event kết thúc (client sẽ treo ở trạng thái đang chạy)`);

  for (const c of calls) {
    if (c.args === undefined) continue; // lỗi JSON đã báo ở protocol
    const v = TOOL_VALIDATORS[c.name];
    if (!v) { TW.push(`tool ${fmt(c.name)} (${c.id}) ngoài 5 tool của mục 4.5 — frontend sẽ hiện ToolFallback`); continue; }
    const p = [];
    const w = [];
    v(c.args, p, w);
    p.forEach((m) => T.push(`${c.name} ${short(c.id)}: ${m}`));
    w.forEach((m) => TW.push(`${c.name} ${short(c.id)}: ${m}`));
  }

  // cam kết trạng thái client cho run tiếp theo của thread
  thread.messages = sim;
  thread.state = state;

  return {
    P, W, T, TW, S, SW, texts, calls, interrupts, terminal, snapshots, deltas, jobTimeline,
    terminalType: terminal?.event.type ?? null,
    outcome: terminal?.event.type === "RUN_FINISHED" && isObj(terminal.event.outcome) ? terminal.event.outcome : undefined,
    allText: texts.map((t) => t.text).join("\n"),
    baseline,
    extraEvents: [...[...chunkCount].map(([t, n]) => `${t}×${n}`), ...[...otherTypes].map(([t, n]) => `${t}×${n}`)],
    finalState: state,
  };
}

// ───────────────────────────── chạy một lượt ─────────────────────────────

const threads = [];

function newThread(label) {
  const t = { label, threadId: randomUUID(), messages: [], state: {}, runs: [] };
  threads.push(t);
  return t;
}

function buildContext(requestedTools = []) {
  // mục 4.4: value luôn là string (JSON)
  return [
    { description: "user", value: JSON.stringify({ user_id: "smoke-user", user_name: "Smoke Test" }) },
    { description: "requested_tools", value: JSON.stringify(requestedTools) },
    { description: "active_document_ids", value: JSON.stringify([]) },
  ];
}

function describeCalls(s) {
  return s.calls.map((c) => {
    const a = c.args;
    if (!a) return `${c.name}(args lỗi)`;
    if (c.name === "show_quiz") return `show_quiz(${arr(a.questions).length} câu)`;
    if (c.name === "cite_sources") return `cite_sources(${arr(a.sources).length} nguồn)`;
    if (c.name === "suggest_followups") return `suggest_followups(${arr(a.questions).length} câu)`;
    if (c.name === "present_ui") return `present_ui(${arr(a.blocks).map((b) => b?.type).join("+")})`;
    if (c.name === "show_mindmap") return `show_mindmap(${arr(a.root?.children).length} nhánh)`;
    return c.name;
  }).join(", ");
}
function observe(s) {
  return `kết thúc=${s.terminalType ?? "(không có)"}${s.outcome?.type ? `/${s.outcome.type}` : ""}, tools=[${describeCalls(s)}], text=${s.allText.length} ký tự`;
}

/**
 * Gửi một run trên thread (giống HttpAgent: messages = toàn bộ transcript phía client, state = state hiện tại)
 * và in các kiểm tra chung. Trả về summary hoặc null nếu không chạy được.
 */
async function runTurn(thread, { label, text, content, resume, requestedTools = [] }) {
  const L = `[${label}]`;
  if (serverDown) {
    skip(`${L} run`, `server không còn phản hồi (${serverDown})`);
    thread.runs.push({ label, userText: undefined, summary: null });
    return null;
  }
  const userText = content !== undefined ? textOfContent(content) : text;
  const userMsg = userText !== undefined ? { id: `smoke-user-${randomUUID()}`, role: "user", content: content ?? text } : null;
  if (userMsg) registerId("message", userMsg.id, { threadId: thread.threadId, label: `${label} (user, do test gửi)` });
  const input = {
    threadId: thread.threadId,
    runId: `smoke-run-${randomUUID()}`,
    state: clone(thread.state),
    messages: [...clone(thread.messages), ...(userMsg ? [userMsg] : [])],
    tools: [],
    context: buildContext(requestedTools),
    forwardedProps: {},
    protocolVersion: "1.0", // client thật gửi field này (API.md mục 5); server phải chấp nhận field thừa
    ...(resume ? { resume } : {}),
  };
  const run = await postRun(input);
  const record = { label, userText, run, summary: null };
  thread.runs.push(record);

  if (VERBOSE) {
    console.log(paint("2", `  ↳ ${label}: threadId=${input.threadId} runId=${input.runId}${resume ? ` resume=${JSON.stringify(resume)}` : ""}`));
    run.events.forEach((e, i) => {
      const { type, ...rest } = isObj(e) ? e : { type: "?" };
      console.log(paint("2", `    #${i} ${type} ${snippet(JSON.stringify(rest), 180)}`));
    });
  }

  const head = [...run.httpProblems, ...run.framing];
  if (run.transportError && run.events.length === 0) {
    fail(`${L} stream & protocol (mục 4.3, 4.8)`, [...head, run.transportError]);
    return null;
  }
  const s = analyzeRun(run, thread, label);
  record.summary = s;
  const protoProblems = [...head, ...(run.transportError ? [run.transportError] : []), ...s.P];
  check(`${L} stream & protocol (mục 4.3, 4.8)`, protoProblems,
    `${run.events.length} event, ${run.endedAt - run.startedAt} ms, kết thúc ${s.terminalType}${s.outcome?.type ? `/${s.outcome.type}` : ""}${s.extraEvents.length ? `; event bổ sung hợp lệ (4.8 điểm 6): ${s.extraEvents.join(", ")}` : ""}`);
  if (run.framingWarn.length || s.W.length) warn(`${L} stream & protocol`, [...run.framingWarn, ...s.W]);
  check(`${L} tool args (mục 4.5)`, s.T, s.calls.length ? describeCalls(s) : "không có tool call");
  if (s.TW.length) warn(`${L} tool args`, s.TW);
  check(`${L} state (mục 4.7, RFC 6902)`, s.S, s.snapshots + s.deltas ? `${s.snapshots} snapshot, ${s.deltas} delta` : "không có event state");
  if (s.SW.length) warn(`${L} state`, s.SW);
  return s;
}

/** Kỳ vọng theo kịch bản (bảng 6.D). Bị SKIP khi --contract-only. */
function scenarioCheck(label, s, fn, { warnOnly = false } = {}) {
  const L = `[${label}] kịch bản`;
  if (!s) {
    if (CONTRACT_ONLY) return skip(L, "--contract-only; run không chạy được");
    return fail(L, ["run không chạy được (xem lỗi phía trên)"]);
  }
  if (CONTRACT_ONLY) return skip(L, `--contract-only (quan sát: ${observe(s)})`);
  const p = [];
  const w = [];
  fn(s, p, w);
  if (warnOnly) {
    if (p.length) warn(`${L} (kiểm tra bổ sung, không tính FAIL)`, [...p, `quan sát: ${observe(s)}`]);
    else pass(`${L} (kiểm tra bổ sung)`, observe(s));
  } else check(L, p, observe(s));
  if (w.length) warn(L, w);
}

// ───────────────────────────── kỳ vọng kịch bản (bảng 6.D) ─────────────────────────────

const completedCalls = (s, name) => s.calls.filter((c) => c.name === name && c.args !== undefined);
function expectSingle(s, name, p) {
  const cs = completedCalls(s, name);
  if (cs.length === 0) { p.push(`không có tool call ${name} hoàn chỉnh (START → ARGS → END, args là JSON object)`); return null; }
  if (cs.length > 1) p.push(`có ${cs.length} tool call ${name} (cần 1)`);
  return cs[0];
}
function expectFinished(s, p) {
  if (s.terminalType !== "RUN_FINISHED") p.push(`kết thúc bằng ${s.terminalType ?? "(không có)"} (cần RUN_FINISHED)`);
  else if (s.outcome?.type === "interrupt") p.push("RUN_FINISHED mang outcome interrupt ngoài dự kiến");
}
function extraTools(s, allowed, w) {
  const extra = [...new Set(s.calls.map((c) => c.name).filter((n) => !allowed.includes(n)))];
  if (extra.length) w.push(`có tool ngoài bảng 6.D cho kịch bản này: ${extra.join(", ")}`);
}
function expectUniqueQuestionIds(call, p) {
  const ids = arr(call.args.questions).map((q) => q?.id);
  if (new Set(ids).size !== ids.length) p.push(`show_quiz có id câu hỏi trùng (bảng 6.D: lặp lại phải đánh số khác nhau): ${ids.join(", ")}`);
}
function expectArtifactAdded(s, kind, p, checkNew) {
  const before = arr(s.baseline?.artifacts?.[kind]).length;
  const after = arr(s.finalState?.artifacts?.[kind]);
  if (after.length !== before + 1) p.push(`state.artifacts.${kind}: ${before} → ${after.length} phần tử (cần thêm đúng 1, qua STATE_SNAPSHOT hoặc STATE_DELTA)`);
  else checkNew?.(after.at(-1));
}
function expectQuizJob(s, p, w) {
  // Không phụ thuộc STATE_DELTA (mục 4.8 điểm 7): backend chỉ phát snapshot có thể chỉ cho thấy trạng thái cuối.
  const quizJobs = [...s.jobTimeline.entries()].filter(([, tl]) => tl.some((x) => x.kind === "quiz"));
  if (quizJobs.length === 0) { p.push('không thấy job kind "quiz" nào trong state.jobs (bảng 6.D: progress 0 → 40 → 80 → done)'); return; }
  const done = quizJobs.find(([, tl]) => tl.at(-1)?.status === "done" || tl.some((x) => x.status === "done"));
  if (!done) {
    p.push(`job quiz không tới "done": ${quizJobs.map(([id, tl]) => `${id}: ${tl.map((x) => `${x.status}/${x.progress}`).join(" → ")}`).join("; ")}`);
    return;
  }
  const [id, tl] = done;
  if (!tl.some((x) => x.status === "running")) w.push(`job ${id} chỉ thấy trạng thái "done" (không quan sát được "running" — backend chỉ phát snapshot cuối?)`);
  const prog = tl.map((x) => x.progress).filter(Number.isFinite);
  if (prog.some((v, k) => k > 0 && v < prog[k - 1])) p.push(`progress của job ${id} bị giảm: ${prog.join(" → ")}`);
}

const EXPECT = {
  default(s, p, w) {
    expectFinished(s, p);
    if (!s.allText.trim()) p.push("không có assistant text");
    else {
      if (!s.allText.includes("$O(1)$")) p.push('text thiếu công thức "$O(1)$" (bảng 6.D)');
      if (!/```\s*java/i.test(s.allText)) p.push("text thiếu khối code ```java (bảng 6.D)");
    }
    const cite = expectSingle(s, "cite_sources", p);
    if (cite && arr(cite.args.sources).length !== 2) p.push(`cite_sources có ${arr(cite.args.sources).length} nguồn (bảng 6.D: 2)`);
    const fu = expectSingle(s, "suggest_followups", p);
    if (fu && arr(fu.args.questions).length !== 3) p.push(`suggest_followups có ${arr(fu.args.questions).length} câu (bảng 6.D: 3)`);
    const firstText = s.texts.find((t) => t.text.trim());
    if (firstText && cite && firstText.index > cite.index) p.push("thứ tự: text giải thích phải đến trước cite_sources");
    if (cite && fu && cite.index > fu.index) p.push("thứ tự: cite_sources phải đến trước suggest_followups");
    extraTools(s, ["cite_sources", "suggest_followups"], w);
  },
  quiz(s, p, w) {
    expectFinished(s, p);
    const q = expectSingle(s, "show_quiz", p);
    if (q) {
      const n = arr(q.args.questions).length;
      if (n !== 5) p.push(`show_quiz có ${n} câu (bảng 6.D: 5)`);
      expectUniqueQuestionIds(q, p);
    }
    expectQuizJob(s, p, w);
    expectArtifactAdded(s, "quizzes", p, (it) => { if (it?.count !== 5) p.push(`artifact quiz mới có count=${fmt(it?.count)} (cần 5)`); });
    extraTools(s, ["show_quiz"], w);
  },
  compare(s, p, w) {
    expectFinished(s, p);
    const firstText = s.texts.find((t) => t.text.trim());
    if (!firstText) p.push("thiếu text dẫn nhập");
    const ui = expectSingle(s, "present_ui", p);
    if (ui) {
      const blocks = arr(ui.args.blocks);
      const types = blocks.map((b) => b?.type);
      for (const t of ["comparison_table", "callout", "code_diff", "steps"]) if (!types.includes(t)) p.push(`present_ui thiếu block "${t}" (bảng 6.D)`);
      if (types.includes("callout") && !blocks.some((b) => b?.type === "callout" && b.tone === "tip")) p.push('block callout phải có tone "tip" (bảng 6.D)');
      if (firstText && firstText.index > ui.index) p.push("thứ tự: text dẫn nhập phải đến trước present_ui");
    }
    extraTools(s, ["present_ui"], w);
  },
  mindmap(s, p, w) {
    expectFinished(s, p);
    const m = expectSingle(s, "show_mindmap", p);
    if (m) {
      const root = m.args.root;
      if (norm(root?.label).toLowerCase() !== "lập trình hướng đối tượng") p.push(`root.label ${fmt(root?.label)} (bảng 6.D: "Lập trình hướng đối tượng")`);
      const ch = arr(root?.children);
      if (ch.length !== 4) p.push(`gốc có ${ch.length} nhánh (bảng 6.D: 4)`);
      ch.forEach((c, k) => {
        const n = arr(c?.children).length;
        if (n < 2 || n > 3) p.push(`nhánh ${k} ${fmt(c?.label)} có ${n} lá (bảng 6.D: 2–3)`);
      });
    }
    expectArtifactAdded(s, "mindmaps", p);
    extraTools(s, ["show_mindmap"], w);
  },
  error(s, p) {
    if (s.terminalType !== "RUN_ERROR") p.push(`kết thúc bằng ${s.terminalType ?? "(không có)"} (bắt buộc RUN_ERROR)`);
    else if (s.terminal.event.code !== "MOCK_ERROR") p.push(`code ${fmt(s.terminal.event.code)} (bảng 6.D: "MOCK_ERROR")`);
    if (!s.texts.some((t) => t.contentCount > 0)) p.push("cần mở text và stream vài TEXT_MESSAGE_CONTENT trước RUN_ERROR (bảng 6.D)");
  },
  afterError(s, p) {
    expectFinished(s, p);
    if (!s.allText.trim()) p.push("thread sau lỗi không trả lời được (không có assistant text)");
  },
  config(s, p, w) {
    if (s.terminalType !== "RUN_FINISHED" || s.outcome?.type !== "interrupt") {
      p.push(`cần RUN_FINISHED với outcome.type "interrupt" (nhận ${s.terminalType ?? "(không có)"}${s.outcome?.type ? `/${s.outcome.type}` : ""})`);
      return;
    }
    if (s.interrupts.length !== 1) p.push(`có ${s.interrupts.length} interrupt (bảng 6.D: 1 interrupt quiz_config)`);
    const it = s.interrupts.find((x) => x?.metadata?.kind === "quiz_config");
    if (!it) { p.push('không có interrupt metadata.kind "quiz_config"'); return; }
    if (it.reason !== "input_required") p.push(`reason ${fmt(it.reason)} (mục 4.6: "input_required")`);
    if (!isNonEmptyStr(it.message)) p.push("interrupt quiz_config thiếu message (mục 4.6)");
    const d = it.metadata.defaults;
    if (isObj(d) && (d.count !== 10 || d.difficulty !== "medium")) w.push(`defaults ${fmt(d)} khác ví dụ mục 4.6 {count:10, difficulty:"medium"}`);
    if (s.calls.length) w.push(`run interrupt có tool call: ${describeCalls(s)}`);
  },
  resumeResolved: (n) => (s, p, w) => {
    expectFinished(s, p);
    const q = expectSingle(s, "show_quiz", p);
    if (q) {
      const got = arr(q.args.questions).length;
      if (got !== n) p.push(`show_quiz có ${got} câu (bắt buộc đúng payload.count = ${n})`);
      expectUniqueQuestionIds(q, p);
    }
    expectQuizJob(s, p, w);
    expectArtifactAdded(s, "quizzes", p, (it) => { if (it?.count !== n) p.push(`artifact quiz mới có count=${fmt(it?.count)} (cần ${n})`); });
    extraTools(s, ["show_quiz"], w);
  },
  requestedMindmap(s, p, w) {
    EXPECT.mindmap(s, p, w);
    if (s.calls.some((c) => c.name === "show_quiz")) p.push('có show_quiz: từ khóa "quiz" thắng requested_tools ["mindmap"] (mục 6.D: requested_tools phải thắng)');
    if ([...s.jobTimeline.values()].some((tl) => tl.some((x) => x.kind === "quiz"))) p.push("có job quiz dù requested_tools là mindmap");
  },
  // mục 4.6: resume cancelled, transcript gửi lại giữ nguyên id, KHÔNG có user message mới → chỉ text hủy
  resumeCancelled(s, p) {
    expectFinished(s, p);
    if (s.calls.length) p.push(`có tool call (${describeCalls(s)}) — mục 4.6: hủy không kèm message mới chỉ trả text "Đã hủy sinh câu hỏi."`);
    if (!/h(ủy|uỷ)/i.test(s.allText.normalize("NFC"))) p.push(`text cần báo đã hủy (mục 4.6: "Đã hủy sinh câu hỏi."), nhận "${snippet(s.allText, 60)}"`);
    const b = arr(s.baseline?.artifacts?.quizzes).length;
    const a = arr(s.finalState?.artifacts?.quizzes).length;
    if (a !== b) p.push(`state.artifacts.quizzes đổi ${b} → ${a} dù đã hủy`);
  },
  // mục 4.6: resume cancelled + user message mới (id mới) "vẽ mindmap" → bỏ interrupt, chạy như run thường
  steerAway(s, p, w) {
    EXPECT.mindmap(s, p, w);
    if (s.calls.some((c) => c.name === "show_quiz")) p.push("có show_quiz dù đã steer away (resume cancelled)");
    if (/h(ủy|uỷ) sinh câu hỏi/i.test(s.allText.normalize("NFC"))) w.push('steer away vẫn trả text "Đã hủy sinh câu hỏi." (mục 4.6: xử lý message mới như run thường)');
  },
};

// ───────────────────────────── history (mục 4.3) ─────────────────────────────

async function fetchHistory(threadId) {
  const url = `${AGENT_BASE}/threads/${encodeURIComponent(threadId)}/messages`;
  let res;
  let text;
  try {
    res = await fetch(url, { headers: { Origin: ORIGIN, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await res.text();
  } catch (e) {
    noteNetworkError(e);
    return { problems: [`GET ${url}: ${describeFetchError(e)}`], messages: null };
  }
  const problems = [];
  if (res.status !== 200) problems.push(`HTTP ${res.status} (cần 200; thread chưa có gì vẫn phải 200 {"messages": []}, không 404)`);
  const acao = res.headers.get("access-control-allow-origin");
  if (acao !== "*") problems.push(`Access-Control-Allow-Origin ${acao === null ? "(thiếu)" : fmt(acao)} (cần "*")`);
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    problems.push(`body không phải JSON (${e.message}): ${snippet(text, 80)}`);
    return { problems, messages: null };
  }
  if (!isObj(body) || !Array.isArray(body.messages)) {
    problems.push(`body phải là {"messages": AgUiMessage[]} (nhận ${snippet(JSON.stringify(body), 80)})`);
    return { problems, messages: null };
  }
  return { problems, messages: body.messages, hasState: body.state !== undefined, state: body.state };
}

function validateHistoryShape(msgs) {
  const p = [];
  const ids = new Map();
  msgs.forEach((m, k) => {
    const at = `messages[${k}]`;
    if (!isObj(m)) return p.push(`${at} không phải object`);
    if (!isNonEmptyStr(m.id)) p.push(`${at}.id phải là string không rỗng`);
    else if (ids.has(m.id)) p.push(`${at}.id ${fmt(m.id)} trùng với messages[${ids.get(m.id)}] (message bị lưu lặp?)`);
    else ids.set(m.id, k);
    if (!MESSAGE_ROLES.has(m.role)) p.push(`${at}.role ${fmt(m.role)} không hợp lệ`);
    if (m.role === "user" && !isStr(m.content) && !Array.isArray(m.content)) p.push(`${at}.content (user) phải là string hoặc mảng part`);
    if (m.role === "assistant") {
      if (m.content !== undefined && m.content !== null && !isStr(m.content)) p.push(`${at}.content (assistant) phải là string (nhận ${kindOf(m.content)})`);
      if (m.toolCalls !== undefined) {
        if (!Array.isArray(m.toolCalls)) p.push(`${at}.toolCalls phải là mảng`);
        else m.toolCalls.forEach((tc, j) => {
          const a = `${at}.toolCalls[${j}]`;
          if (!isObj(tc)) return p.push(`${a} phải là object`);
          if (!isNonEmptyStr(tc.id)) p.push(`${a}.id phải là string không rỗng`);
          if (tc.type !== "function") p.push(`${a}.type ${fmt(tc.type)} (cần "function")`);
          if (!isObj(tc.function)) return p.push(`${a}.function phải là object {name, arguments}`);
          if (!isNonEmptyStr(tc.function.name)) p.push(`${a}.function.name phải là string không rỗng`);
          if (!isStr(tc.function.arguments)) p.push(`${a}.function.arguments phải là JSON string (nhận ${kindOf(tc.function.arguments)})`);
          else {
            try { JSON.parse(tc.function.arguments); } catch (e) { p.push(`${a}.function.arguments không phải JSON hợp lệ: ${e.message}`); }
          }
        });
      }
    }
    if (m.role === "tool") {
      if (!isNonEmptyStr(m.toolCallId)) p.push(`${at}.toolCallId phải là string không rỗng`);
      if (!isStr(m.content)) p.push(`${at}.content (tool) phải là string (nhận ${kindOf(m.content)})`);
    }
  });
  return p;
}

/** So history của server với transcript client dựng từ stream của chính các run trên thread. */
function compareHistory(thread, msgs) {
  const p = [];
  const userIdx = (text) => msgs.flatMap((m, k) => (m?.role === "user" && norm(textOfContent(m.content)) === norm(text) ? [k] : []));
  const callLoc = new Map();
  msgs.forEach((m, k) => {
    if (m?.role === "assistant" && Array.isArray(m.toolCalls)) {
      for (const tc of m.toolCalls) if (isObj(tc) && isStr(tc.id) && !callLoc.has(tc.id)) callLoc.set(tc.id, { k, tc });
    }
  });
  const toolMsgs = new Map();
  msgs.forEach((m, k) => {
    if (m?.role === "tool" && isStr(m.toolCallId)) toolMsgs.set(m.toolCallId, [...(toolMsgs.get(m.toolCallId) ?? []), k]);
  });
  for (const [id, ks] of toolMsgs) {
    const loc = callLoc.get(id);
    if (!loc) p.push(`messages[${ks[0]}] role "tool" trỏ tới toolCallId ${fmt(id)} không có trong assistant toolCalls nào`);
    else if (ks[0] < loc.k) p.push(`messages[${ks[0]}] role "tool" đứng trước assistant chứa tool call ${fmt(id)} (messages[${loc.k}])`);
    if (ks.length > 1) p.push(`toolCallId ${fmt(id)} có ${ks.length} message "tool" (lưu lặp?)`);
  }

  const markers = [];
  for (const r of thread.runs) {
    const finished = r.summary?.terminalType === "RUN_FINISHED";
    if (r.userText !== undefined) {
      const ks = userIdx(r.userText);
      if (finished && ks.length !== 1) p.push(`user message "${snippet(r.userText, 40)}" (run "${r.label}") xuất hiện ${ks.length} lần (cần đúng 1)`);
      else if (!finished && ks.length > 1) p.push(`user message "${snippet(r.userText, 40)}" (run "${r.label}") xuất hiện ${ks.length} lần (tối đa 1)`);
      if (ks.length) markers.push({ k: ks[0], what: `user "${snippet(r.userText, 30)}"`, strict: true });
    }
    if (!finished) continue;
    for (const c of r.summary.calls) {
      if (c.args === undefined) continue;
      const loc = callLoc.get(c.id);
      if (!loc) { p.push(`thiếu assistant toolCalls cho ${c.name} ${fmt(c.id)} (run "${r.label}")`); continue; }
      if (loc.tc.function?.name !== c.name) p.push(`toolCalls ${fmt(c.id)}: function.name ${fmt(loc.tc.function?.name)} ≠ ${fmt(c.name)} trong stream`);
      let hargs;
      try { hargs = JSON.parse(loc.tc.function?.arguments); } catch { /* đã báo ở kiểm tra shape */ }
      if (hargs !== undefined && !deepEqual(hargs, c.args)) p.push(`toolCalls ${fmt(c.id)} (${c.name}): arguments khác args đã stream`);
      if (c.result && !toolMsgs.has(c.id)) p.push(`thiếu message role "tool" cho ${c.name} ${fmt(c.id)} (run "${r.label}")`);
      markers.push({ k: loc.k, what: `${c.name} ${short(c.id)}`, strict: false });
    }
    for (const t of r.summary.texts) {
      if (t.open || !t.text.trim()) continue;
      const found = msgs.some((m) => m?.role === "assistant" && isStr(m.content) && norm(m.content).includes(norm(t.text)));
      if (!found) p.push(`thiếu assistant message chứa text đã stream (messageId ${fmt(t.id)}: "${snippet(t.text, 40)}", run "${r.label}")`);
    }
  }
  for (let n = 1; n < markers.length; n++) {
    const a = markers[n - 1];
    const b = markers[n];
    if (b.strict ? b.k <= a.k : b.k < a.k) p.push(`thứ tự sai: ${b.what} (messages[${b.k}]) không đứng sau ${a.what} (messages[${a.k}])`);
  }
  return p;
}

let historyStateMissingWarned = false;

/**
 * Mục 4.3: field "state" của history là tùy chọn. Có → phải đúng shape 4.7 và giữ được mọi artifact client đã
 * thấy qua stream (để F5 khôi phục Studio). Thiếu → chỉ WARN (backend cũ vẫn pass).
 */
function checkHistoryState(thread, h, label) {
  if (!h.hasState) {
    if (!historyStateMissingWarned) {
      historyStateMissingWarned = true;
      warn(label, ['history không có field "state" (tùy chọn theo mục 4.3 — Studio sẽ trống sau F5). Chỉ báo một lần.']);
    }
    return [];
  }
  const p = validateState(h.state).map((m) => `history.${m}`);
  if (p.length) return p;
  for (const kind of ["quizzes", "mindmaps"]) {
    const seen = arr(thread.state?.artifacts?.[kind]);
    const stored = arr(h.state.artifacts[kind]);
    const storedIds = new Set(stored.map((x) => x?.id));
    const missing = seen.filter((x) => !storedIds.has(x?.id)).map((x) => x?.id);
    if (missing.length) p.push(`history.state.artifacts.${kind} thiếu ${missing.length}/${seen.length} artifact client đã nhận qua stream (id ${missing.map(fmt).join(", ")}) — F5 sẽ mất`);
  }
  return p;
}

async function checkHistory(thread) {
  const label = `[${thread.label}] history GET /threads/:id/messages (mục 4.3)`;
  if (serverDown) { skip(label, `server không còn phản hồi (${serverDown})`); return null; }
  const h = await fetchHistory(thread.threadId);
  const p = [...h.problems];
  if (h.messages) {
    p.push(...validateHistoryShape(h.messages));
    p.push(...compareHistory(thread, h.messages));
    p.push(...checkHistoryState(thread, h, label));
  }
  const nCalls = h.messages ? h.messages.reduce((n, m) => n + arr(m?.toolCalls).length, 0) : 0;
  const stateNote = !h.messages ? "" : h.hasState
    ? `, state: ${arr(h.state?.artifacts?.quizzes).length} quiz/${arr(h.state?.artifacts?.mindmaps).length} mindmap`
    : ", không có state";
  check(label, p, h.messages ? `${h.messages.length} message (${nCalls} toolCalls) khớp transcript phía client${stateNote}` : undefined);
  return h.messages ? h : null;
}

// ───────────────────────────── kiểm tra HTTP ─────────────────────────────

async function probeHealth() {
  const url = `${AGENT_BASE}/health`;
  let res;
  let text;
  try {
    res = await fetch(url, { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(Math.min(TIMEOUT_MS, 10000)) });
    text = await res.text();
  } catch (e) {
    return { connected: false, reason: describeFetchError(e) };
  }
  const p = [];
  if (res.status !== 200) p.push(`HTTP ${res.status} (cần 200)`);
  let body;
  try { body = JSON.parse(text); } catch { p.push(`body không phải JSON: ${snippet(text, 80)}`); }
  if (body !== undefined && !(isObj(body) && body.ok === true)) p.push(`body ${snippet(JSON.stringify(body), 80)} (cần {"ok": true})`);
  return { connected: true, problems: p };
}

async function checkPreflight(label, url, method) {
  let res;
  try {
    res = await fetch(url, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "content-type,authorization,accept" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.arrayBuffer();
  } catch (e) {
    noteNetworkError(e);
    return fail(label, [describeFetchError(e)]);
  }
  const p = [];
  if (res.status < 200 || res.status > 299) p.push(`HTTP ${res.status} (mục 4.3: preflight trả 2xx)`);
  const acao = res.headers.get("access-control-allow-origin");
  if (acao !== "*") p.push(`Access-Control-Allow-Origin ${acao === null ? "(thiếu)" : fmt(acao)} (cần "*")`);
  const rawAcah = res.headers.get("access-control-allow-headers");
  const acah = (rawAcah ?? "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  for (const h of ["content-type", "authorization", "accept"]) {
    const covered = acah.includes(h) || (acah.includes("*") && h !== "authorization");
    if (!covered) p.push(`Access-Control-Allow-Headers ${fmt(rawAcah)} thiếu "${h}"${h === "authorization" && acah.includes("*") ? ' ("*" không bao phủ authorization theo chuẩn Fetch)' : ""}`);
  }
  check(label, p, `HTTP ${res.status}, ACAO "*", Allow-Headers: ${rawAcah}`);
  const acam = res.headers.get("access-control-allow-methods");
  if (acam && !acam.toUpperCase().split(",").map((x) => x.trim()).some((m) => m === method || m === "*")) {
    warn(label, [`Access-Control-Allow-Methods ${fmt(acam)} không có ${method} (${method} là method CORS-safelisted nên trình duyệt vẫn cho qua)`]);
  }
}

async function checkBadBody() {
  const label = "[http] POST body JSON lỗi → 400/422 trước khi mở stream";
  let res;
  let ct = "";
  try {
    res = await fetch(AGENT_URL, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: '{"threadId": "smoke-bad-json", "messages": [',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    ct = res.headers.get("content-type") ?? "";
    if (ct.toLowerCase().startsWith("text/event-stream")) await res.body?.cancel();
    else await res.arrayBuffer();
  } catch (e) {
    noteNetworkError(e);
    return fail(label, [describeFetchError(e)]);
  }
  const p = [];
  if (res.status !== 400 && res.status !== 422) p.push(`HTTP ${res.status} (mục 4.3: cần 400 hoặc 422)`);
  if (ct.toLowerCase().startsWith("text/event-stream")) p.push("response là text/event-stream — phải từ chối trước khi mở stream");
  check(label, p, `HTTP ${res.status}, Content-Type ${fmt(ct)}`);
  if (res.headers.get("access-control-allow-origin") !== "*") warn(label, ['response lỗi thiếu Access-Control-Allow-Origin "*" — trình duyệt sẽ không đọc được nội dung lỗi']);
}

async function checkEmptyThread() {
  const label = "[http] GET /threads/<thread mới>/messages → 200 {messages: []}";
  const h = await fetchHistory(randomUUID());
  const p = [...h.problems];
  if (h.messages && h.messages.length !== 0) p.push(`thread mới phải trả {"messages": []} (nhận ${h.messages.length} message)`);
  check(label, p, '200 {"messages": []}');
}

// ───────────────────────────── kịch bản ─────────────────────────────

async function simpleScenario(label, turn, expectFn) {
  const th = newThread(label);
  const s = await runTurn(th, { label, ...turn });
  scenarioCheck(label, s, expectFn);
  await checkHistory(th);
  return { th, s };
}

/** Run "cấu hình" (interrupt quiz_config), rồi một run resume trên cùng thread. */
async function interruptScenario(label, { makeResume, resumeText, expectResume }) {
  const th = newThread(label);
  const cfgLabel = `${label}: cấu hình`;
  const s = await runTurn(th, { label: cfgLabel, text: "cấu hình quiz" });
  scenarioCheck(cfgLabel, s, EXPECT.config);
  const valid = s?.interrupts?.filter((it) => isNonEmptyStr(it?.id)) ?? [];
  const target = valid.find((it) => it?.metadata?.kind === "quiz_config") ?? valid[0];
  const resumeLabel = resumeText ? `${label}: resume cancelled + user message mới "${resumeText}"` : `${label}: resume`;
  if (!target || s?.outcome?.type !== "interrupt") {
    const why = "run cấu hình không trả interrupt hợp lệ nên không thể resume";
    if (CONTRACT_ONLY) skip(`[${resumeLabel}]`, why);
    else fail(`[${resumeLabel}]`, [why]);
    await checkHistory(th);
    return;
  }
  // entries phải phủ hết các interrupt đang mở (mục 4.6). Transcript gửi lại = thread.messages, giữ nguyên id
  // (user message do test tạo + id assistant/tool lấy từ stream); message mới (steer away) có id mới.
  const resume = valid.map((it) => (it === target ? makeResume(it.id) : { interruptId: it.id, status: "cancelled" }));
  const r = await runTurn(th, { label: resumeLabel, resume, ...(resumeText ? { text: resumeText } : {}) });
  scenarioCheck(resumeLabel, r, expectResume);
  await checkHistory(th);
}

async function main() {
  console.log(paint("1", "AG-UI contract test (docs/agui/PLAN.md mục 4, 6.E)"));
  console.log(`AGENT_URL  = ${AGENT_URL}`);
  console.log(`AGENT_BASE = ${AGENT_BASE}${/\/agent\/?$/.test(AGENT_URL) ? "" : "  (AGENT_URL không kết thúc bằng /agent — dùng nguyên URL làm base)"}`);
  console.log(`Chế độ     = ${CONTRACT_ONLY ? "--contract-only (bỏ kỳ vọng theo từ khóa của mock)" : "đầy đủ (kỳ vọng kịch bản theo bảng 6.D)"} · timeout ${TIMEOUT_MS} ms/request`);

  section("Kết nối & HTTP (mục 4.3)");
  const health = await probeHealth();
  if (!health.connected) {
    console.error(`\n${paint("31;1", "KHÔNG KẾT NỐI ĐƯỢC")} tới ${AGENT_BASE}/health: ${health.reason}`);
    console.error([
      "",
      "Hãy chạy mock agent trước (terminal khác):",
      "  node mock-agent/server.mjs          # hoặc: npm run mock:agent — cổng 8787, đổi bằng PORT=...",
      "rồi chạy lại:",
      "  node scripts/agui-smoke.mjs [AGENT_URL]",
      "Server khác:  node scripts/agui-smoke.mjs http://host:port/agent   hoặc   AGENT_URL=... node scripts/agui-smoke.mjs",
      "Backend thật: thêm --contract-only",
    ].join("\n"));
    process.exit(2);
  }
  check("[http] GET /health → 200 {ok: true}", health.problems, '200 {"ok": true}');
  await checkPreflight("[http] preflight OPTIONS {AGENT_URL}", AGENT_URL, "POST");
  await checkPreflight("[http] preflight OPTIONS /threads/:id/messages", `${AGENT_BASE}/threads/${randomUUID()}/messages`, "GET");
  await checkBadBody();
  await checkEmptyThread();

  section("Kịch bản cơ bản");
  await simpleScenario("mặc định", { text: "giải thích đa hình" }, EXPECT.default);
  await simpleScenario("quiz", { text: "Tạo Quiz về OOP" }, EXPECT.quiz);
  await simpleScenario("so sánh", { text: "so sánh abstract class và interface" }, EXPECT.compare);
  await simpleScenario("mindmap", { text: "vẽ mindmap" }, EXPECT.mindmap);
  await simpleScenario("mindmap, content dạng mảng part", { content: [{ type: "text", text: "vẽ sơ đồ tư duy về OOP" }] }, EXPECT.mindmap);
  // mục 6.D: requested_tools ưu tiên ngay sau resume, thắng mọi từ khóa → gửi câu có từ khóa quiz để chứng minh
  await simpleScenario('context requested_tools ["mindmap"] + câu "tạo quiz"', { text: "tạo quiz", requestedTools: ["mindmap"] }, EXPECT.requestedMindmap);

  section("Lỗi (RUN_ERROR) rồi chạy tiếp cùng thread");
  {
    const th = newThread("lỗi");
    const s = await runTurn(th, { label: "lỗi", text: "mô phỏng lỗi" });
    scenarioCheck("lỗi", s, EXPECT.error);
    const s2 = await runTurn(th, { label: "lỗi → chạy tiếp", text: "giải thích tính đóng gói" });
    scenarioCheck("lỗi → chạy tiếp", s2, EXPECT.afterError);
    await checkHistory(th);
  }

  section("Interrupt quiz_config & resume (mục 4.6)");
  await interruptScenario("resume resolved {count:3}", {
    makeResume: (id) => ({ interruptId: id, status: "resolved", payload: { count: 3, difficulty: "easy" } }),
    expectResume: EXPECT.resumeResolved(3),
  });
  await interruptScenario("resume cancelled", {
    makeResume: (id) => ({ interruptId: id, status: "cancelled" }),
    expectResume: EXPECT.resumeCancelled,
  });
  await interruptScenario("resume resolved {count:10}", {
    makeResume: (id) => ({ interruptId: id, status: "resolved", payload: { count: 10, difficulty: "hard" } }),
    expectResume: EXPECT.resumeResolved(10),
  });
  // useAgUiSteerAway gửi resume [{status:"cancelled"}] KÈM user message mới (id mới) trong cùng một run
  // (@assistant-ui/react-ag-ui AgUiThreadController.steerAway) — mục 4.6, phần "Phân biệt hủy và steer away".
  await interruptScenario("steer away", {
    makeResume: (id) => ({ interruptId: id, status: "cancelled" }),
    resumeText: "vẽ mindmap",
    expectResume: EXPECT.steerAway,
  });

  section("Tải lại trang (transcript lấy từ history) rồi gửi tiếp");
  {
    // Sau F5, client dựng transcript từ GET /threads/:id/messages (id do server trả) rồi gửi kèm message mới.
    // Mục 4.6: server chỉ coi là "mới" message có id chưa từng có → không được lưu lặp.
    const th = newThread("tải lại rồi gửi tiếp");
    const s = await runTurn(th, { label: "tải lại: lượt 1", text: "giải thích đa hình" });
    scenarioCheck("tải lại: lượt 1", s, EXPECT.default);
    const h1 = await checkHistory(th);
    if (h1) {
      th.messages = clone(h1.messages);
      th.state = h1.hasState ? clone(h1.state) : {}; // frontend khôi phục state từ history (nếu có), không thì rỗng
      const s2 = await runTurn(th, { label: "tải lại: lượt 2 (transcript từ history)", text: "vẽ mindmap" });
      scenarioCheck("tải lại: lượt 2 (transcript từ history)", s2, EXPECT.mindmap);
      await checkHistory(th);
    } else skip("[tải lại: lượt 2]", "không đọc được history của lượt 1");
  }

  section("Hai thread chạy song song");
  if (serverDown) skip("[song song]", `server không còn phản hồi (${serverDown})`);
  else {
    const A = newThread("song song A");
    const B = newThread("song song B");
    const [sa, sb] = await Promise.all([
      runTurn(A, { label: "song song A", text: "giải thích đa hình (luồng song song A)" }),
      runTurn(B, { label: "song song B", text: "vẽ mindmap (luồng song song B)" }),
    ]);
    scenarioCheck("song song A", sa, EXPECT.default);
    scenarioCheck("song song B", sb, EXPECT.mindmap);
    const ha = (await checkHistory(A))?.messages;
    const hb = (await checkHistory(B))?.messages;
    const ra = A.runs[0]?.run;
    const rb = B.runs[0]?.run;
    if (ra?.endedAt && rb?.endedAt && !(ra.startedAt < rb.endedAt && rb.startedAt < ra.endedAt)) {
      warn("[song song] cách ly transcript", ["hai stream không chồng lên nhau về thời gian — kiểm tra song song yếu"]);
    }
    if (ha && hb) {
      const isolation = (msgs, own, other) => {
        const p = [];
        for (const r of other.runs) {
          if (r.userText !== undefined && msgs.some((m) => m?.role === "user" && norm(textOfContent(m.content)) === norm(r.userText))) {
            p.push(`history ${own.label} chứa user message của ${other.label}`);
          }
          for (const c of r.summary?.calls ?? []) {
            if (msgs.some((m) => arr(m?.toolCalls).some((tc) => tc?.id === c.id) || m?.toolCallId === c.id)) p.push(`history ${own.label} chứa tool call ${c.name} ${short(c.id)} của ${other.label}`);
          }
          for (const t of r.summary?.texts ?? []) {
            if (msgs.some((m) => m?.id === t.id)) p.push(`history ${own.label} chứa message ${short(t.id)} của ${other.label}`);
          }
        }
        return p;
      };
      check("[song song] cách ly transcript giữa 2 thread", [...isolation(ha, A, B), ...isolation(hb, B, A)], "không lẫn message/tool call");
    } else skip("[song song] cách ly transcript giữa 2 thread", "không đọc được history");
  }

  section("Tổng kết");
  if (serverDown) console.log(paint("31", `Server ngừng phản hồi giữa chừng: ${serverDown}`));
  console.log(`PASS ${tally.pass} · FAIL ${tally.fail} · WARN ${tally.warn} · SKIP ${tally.skip}`);
  if (failedLabels.length) {
    console.log("Các kiểm tra FAIL:");
    for (const l of failedLabels) console.log(`  - ${l}`);
  }
  process.exit(tally.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\nLỖI CỦA SCRIPT (không phải của server): ${e?.stack ?? e}`);
  process.exit(1);
});
