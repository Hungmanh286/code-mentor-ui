#!/usr/bin/env node
// Mock AG-UI agent server cho frontend Mentor Code (docs/agui/PLAN.md mục 4.3–4.8, 6.D).
// Node thuần, không dependency. Chạy: `node mock-agent/server.mjs` (PORT mặc định 8787).
//
// Routes:
//   POST /agent                    RunAgentInput (camelCase) -> text/event-stream
//   GET  /threads/:id/messages     -> { messages: AgUiMessage[], state }
//   GET  /health                   -> { ok: true }
//   OPTIONS *                      -> 204 (CORS preflight)

import http from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { initialState, planRun } from "./scenarios.mjs";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const HOST = process.env.HOST || undefined;
const MAX_BODY_BYTES = 1_000_000;
const MAX_THREADS = 1_000;
const CHUNK_DELAY_MIN_MS = 20;
const CHUNK_DELAY_MAX_MS = 40;
const TOOL_ARGS_TARGET_CHUNKS = 30;

const CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, accept",
  "Access-Control-Max-Age": "600",
});

const SSE_HEADERS = Object.freeze({
  ...CORS_HEADERS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
});

// JSON Pointer (RFC 6901), cùng regex với @ag-ui/core.
const JSON_POINTER_RE = /^(\/([^/~]|~[01])*)*$/;

// ---------------------------------------------------------------------------
// Lưu trữ theo thread (trong bộ nhớ)
// ---------------------------------------------------------------------------

/** @type {Map<string, { id: string, messages: object[], messageIds: Set<string>, state: object, pendingInterrupt: { id: string, runId: string } | null }>} */
const threads = new Map();

function getOrCreateThread(threadId) {
  let thread = threads.get(threadId);
  if (thread) {
    // LRU đơn giản: thread vừa dùng chuyển xuống cuối Map.
    threads.delete(threadId);
  } else {
    thread = { id: threadId, messages: [], messageIds: new Set(), state: initialState(), pendingInterrupt: null };
  }
  threads.set(threadId, thread);
  while (threads.size > MAX_THREADS) threads.delete(threads.keys().next().value);
  return thread;
}

function appendToTranscript(thread, message) {
  thread.messages.push(message);
  if (typeof message.id === "string") thread.messageIds.add(message.id);
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

const newId = (prefix) => `${prefix}_${randomUUID()}`;
const clone = (value) => structuredClone(value);
const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

class AbortedError extends Error {
  constructor() {
    super("Client đã ngắt kết nối");
    this.name = "AbortError";
  }
}

/** Lỗi do kịch bản vi phạm luật mục 4.8 — bị chặn TRƯỚC khi event được ghi ra. */
class ProtocolGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolGuardError";
  }
}

const isAbortError = (err) => err instanceof AbortedError || err?.name === "AbortError";

function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function log(line) {
  console.log(`[mock-agent] ${new Date().toISOString()} ${line}`);
}

/** Tách text thành delta 2–4 từ (giữ nguyên khoảng trắng), mọi delta đều không rỗng. */
function chunkText(text, { minWords = 2, maxWords = 4 } = {}) {
  const pieces = String(text).normalize("NFC").split(/(?<=\s)(?=\S)/u);
  const out = [];
  for (let i = 0; i < pieces.length; ) {
    const n = randomInt(minWords, maxWords);
    const delta = pieces.slice(i, i + n).join("");
    if (delta.length > 0) out.push(delta);
    i += n;
  }
  return out;
}

/** Tách chuỗi JSON theo code point (không cắt đôi cặp surrogate); ghép lại ra đúng chuỗi gốc. */
function chunkJson(json) {
  const codePoints = Array.from(json);
  const size = Math.max(16, Math.ceil(codePoints.length / TOOL_ARGS_TARGET_CHUNKS));
  const out = [];
  for (let i = 0; i < codePoints.length; i += size) out.push(codePoints.slice(i, i + size).join(""));
  return out;
}

/** Áp RFC 6902 (add/replace/remove) lên `doc` (bị sửa tại chỗ). Ném lỗi nếu path không hợp lệ. */
function applyJsonPatch(doc, ops) {
  for (const op of ops) {
    if (!isPlainObject(op) || typeof op.path !== "string" || !op.path.startsWith("/") || !JSON_POINTER_RE.test(op.path)) {
      throw new Error(`op không hợp lệ: ${JSON.stringify(op)}`);
    }
    const tokens = op.path
      .slice(1)
      .split("/")
      .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
    const key = tokens.pop();
    let parent = doc;
    for (const token of tokens) {
      parent = Array.isArray(parent) ? parent[Number(token)] : parent?.[token];
      if (typeof parent !== "object" || parent === null) throw new Error(`path không tồn tại: ${op.path}`);
    }
    if (Array.isArray(parent)) {
      const index = key === "-" ? parent.length : Number(key);
      const inRange = Number.isInteger(index) && index >= 0 && index <= parent.length;
      if (op.op === "add" && inRange) parent.splice(index, 0, clone(op.value));
      else if (op.op === "replace" && inRange && index < parent.length) parent[index] = clone(op.value);
      else if (op.op === "remove" && inRange && index < parent.length) parent.splice(index, 1);
      else throw new Error(`không áp được ${op.op} tại ${op.path}`);
    } else if (op.op === "add") {
      parent[key] = clone(op.value);
    } else if ((op.op === "replace" || op.op === "remove") && Object.hasOwn(parent, key)) {
      if (op.op === "replace") parent[key] = clone(op.value);
      else delete parent[key];
    } else {
      throw new Error(`không áp được ${op.op} tại ${op.path}`);
    }
  }
}

function normalizedState(state) {
  const s = isPlainObject(state) ? state : {};
  const artifacts = isPlainObject(s.artifacts) ? s.artifacts : {};
  return {
    ...s,
    artifacts: {
      ...artifacts,
      quizzes: Array.isArray(artifacts.quizzes) ? artifacts.quizzes : [],
      mindmaps: Array.isArray(artifacts.mindmaps) ? artifacts.mindmaps : [],
    },
    jobs: isPlainObject(s.jobs) ? s.jobs : {},
  };
}

// ---------------------------------------------------------------------------
// Luồng SSE kèm "guard" tự kiểm luật mục 4.8 trước khi ghi từng event
// ---------------------------------------------------------------------------

class RunStream {
  constructor({ res, signal, threadId, runId }) {
    this.res = res;
    this.signal = signal;
    this.threadId = threadId;
    this.runId = runId;
    this.eventTypes = [];
    this.terminal = null; // "RUN_FINISHED" | "RUN_ERROR"
    this.terminalEvent = null;
    this.openTexts = new Set();
    this.openTools = new Map(); // toolCallId -> args đã ghép
    this.endedTools = new Set();
    this.resultedTools = new Set();
    this.usedIds = new Set();
  }

  throwIfAborted() {
    if (this.signal.aborted || this.res.destroyed || this.res.writableEnded) throw new AbortedError();
  }

  async emit(event) {
    this.throwIfAborted();
    if (this.eventTypes.length > 0) {
      await sleep(randomInt(CHUNK_DELAY_MIN_MS, CHUNK_DELAY_MAX_MS), undefined, { signal: this.signal });
    }
    this.guard(event);
    this.throwIfAborted();
    const flushed = this.res.write(`data: ${JSON.stringify(event)}\n\n`);
    this.eventTypes.push(event.type);
    if (!flushed) await once(this.res, "drain", { signal: this.signal });
  }

  claimId(id, label) {
    if (typeof id !== "string" || id.length === 0) throw new ProtocolGuardError(`${label} phải là chuỗi không rỗng`);
    if (this.usedIds.has(id)) throw new ProtocolGuardError(`${label} '${id}' bị dùng lại`);
    this.usedIds.add(id);
  }

  /** Kiểm và cập nhật trạng thái luồng; ném ProtocolGuardError nếu event vi phạm mục 4.8. */
  guard(ev) {
    const fail = (msg) => {
      throw new ProtocolGuardError(`${ev.type}: ${msg}`);
    };
    if (this.terminal) fail(`không được phát sau ${this.terminal}`);
    if (this.eventTypes.length === 0 && ev.type !== "RUN_STARTED" && ev.type !== "RUN_ERROR") {
      fail("event đầu tiên phải là RUN_STARTED");
    }
    switch (ev.type) {
      case "RUN_STARTED":
        if (this.eventTypes.length > 0) fail("chỉ được phát một lần, ở đầu run");
        if (ev.threadId !== this.threadId || ev.runId !== this.runId) fail("threadId/runId phải khớp input");
        break;
      case "TEXT_MESSAGE_START":
        this.claimId(ev.messageId, "messageId");
        if (ev.role !== "assistant") fail("role phải là assistant");
        this.openTexts.add(ev.messageId);
        break;
      case "TEXT_MESSAGE_CONTENT":
        if (!this.openTexts.has(ev.messageId)) fail(`message '${ev.messageId}' chưa mở`);
        if (typeof ev.delta !== "string" || ev.delta.length === 0) fail("delta phải là chuỗi không rỗng");
        break;
      case "TEXT_MESSAGE_END":
        if (!this.openTexts.delete(ev.messageId)) fail(`message '${ev.messageId}' chưa mở`);
        break;
      case "TOOL_CALL_START":
        this.claimId(ev.toolCallId, "toolCallId");
        if (typeof ev.toolCallName !== "string" || !ev.toolCallName) fail("thiếu toolCallName");
        if (typeof ev.parentMessageId !== "string" || !this.usedIds.has(ev.parentMessageId)) {
          fail("parentMessageId phải là message đã phát trong run");
        }
        this.openTools.set(ev.toolCallId, "");
        break;
      case "TOOL_CALL_ARGS":
        if (!this.openTools.has(ev.toolCallId)) fail(`tool call '${ev.toolCallId}' chưa mở`);
        if (typeof ev.delta !== "string" || ev.delta.length === 0) fail("delta phải là chuỗi không rỗng");
        this.openTools.set(ev.toolCallId, this.openTools.get(ev.toolCallId) + ev.delta);
        break;
      case "TOOL_CALL_END": {
        if (!this.openTools.has(ev.toolCallId)) fail(`tool call '${ev.toolCallId}' chưa mở`);
        try {
          JSON.parse(this.openTools.get(ev.toolCallId));
        } catch {
          fail("các delta ghép lại không phải JSON hợp lệ");
        }
        this.openTools.delete(ev.toolCallId);
        this.endedTools.add(ev.toolCallId);
        break;
      }
      case "TOOL_CALL_RESULT":
        if (!this.endedTools.has(ev.toolCallId) || this.resultedTools.has(ev.toolCallId)) {
          fail(`tool call '${ev.toolCallId}' chưa END hoặc đã có result`);
        }
        this.claimId(ev.messageId, "messageId");
        if (ev.role !== "tool" || typeof ev.content !== "string") fail("cần role 'tool' và content chuỗi");
        this.resultedTools.add(ev.toolCallId);
        break;
      case "STATE_SNAPSHOT":
        if (!isPlainObject(ev.snapshot) || !isPlainObject(ev.snapshot.artifacts) || !isPlainObject(ev.snapshot.jobs)) {
          fail("snapshot phải có đủ artifacts và jobs");
        }
        break;
      case "STATE_DELTA":
        if (!Array.isArray(ev.delta)) fail("delta phải là mảng");
        for (const op of ev.delta) {
          if (!["add", "replace", "remove"].includes(op?.op) || typeof op.path !== "string" || !op.path.startsWith("/")) {
            fail(`op không hợp lệ: ${JSON.stringify(op)}`);
          }
        }
        break;
      case "RUN_FINISHED":
        if (ev.threadId !== this.threadId || ev.runId !== this.runId) fail("threadId/runId phải khớp input");
        if (this.openTexts.size > 0 || this.openTools.size > 0) fail("còn message/tool call chưa đóng");
        if (ev.outcome !== undefined) {
          const ok =
            ev.outcome?.type === "interrupt" &&
            Array.isArray(ev.outcome.interrupts) &&
            ev.outcome.interrupts.length > 0 &&
            ev.outcome.interrupts.every((i) => typeof i?.id === "string" && typeof i?.reason === "string");
          if (!ok) fail("outcome interrupt không hợp lệ");
        }
        this.terminal = ev.type;
        this.terminalEvent = ev;
        break;
      case "RUN_ERROR":
        if (typeof ev.message !== "string") fail("thiếu message");
        this.terminal = ev.type;
        this.terminalEvent = ev;
        break;
      default:
        fail("loại event mock không dùng tới");
    }
  }
}

// ---------------------------------------------------------------------------
// Một run: RUN_STARTED → STATE_SNAPSHOT → kịch bản → RUN_FINISHED | RUN_ERROR
// ---------------------------------------------------------------------------

async function handleRun(req, res, input) {
  const startedAt = Date.now();
  const { threadId, runId } = input;
  const thread = getOrCreateThread(threadId);
  const plan = planRun(input, {
    pendingInterruptId: thread.pendingInterrupt?.id ?? null,
    hasMessage: (id) => thread.messageIds.has(id),
  });

  // Mọi run mới đều thay thế interrupt đang chờ (resume trả lời nó; run thường bỏ qua nó).
  thread.pendingInterrupt = null;
  for (const m of plan.newUserMessages) {
    appendToTranscript(thread, {
      id: typeof m.id === "string" && m.id ? m.id : newId("msg"),
      role: "user",
      content: m.content ?? "",
    });
  }

  const abortController = new AbortController();
  // `req` 'close' đã phát ngay khi body đọc xong; ngắt kết nối thật được nhận ra qua `res`.
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });
  res.on("error", () => abortController.abort());

  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  const stream = new RunStream({ res, signal: abortController.signal, threadId, runId });
  const runMessages = []; // assistant (kèm calls) và tool message của run này, theo thứ tự
  const jobsStarted = new Set();
  let interrupt = null;
  let endLabel = "?";

  const ctx = {
    threadId,
    runId,
    input,
    newId,
    async startText() {
      const id = newId("msg");
      await stream.emit({ type: "TEXT_MESSAGE_START", messageId: id, role: "assistant" });
      const record = { role: "assistant", id, content: "", calls: [] };
      runMessages.push(record);
      return {
        id,
        async write(text, opts) {
          for (const delta of chunkText(text, opts)) {
            await stream.emit({ type: "TEXT_MESSAGE_CONTENT", messageId: id, delta });
            record.content += delta;
          }
        },
        async end() {
          await stream.emit({ type: "TEXT_MESSAGE_END", messageId: id });
        },
      };
    },
    async text(content, opts) {
      const msg = await ctx.startText();
      await msg.write(content, opts);
      await msg.end();
      return msg.id;
    },
    async toolCall(toolCallName, args, parentMessageId) {
      const parent = runMessages.find((m) => m.role === "assistant" && m.id === parentMessageId);
      if (!parent) throw new ProtocolGuardError(`toolCall '${toolCallName}': parentMessageId không thuộc run này`);
      const toolCallId = newId("call");
      const argsText = JSON.stringify(args);
      await stream.emit({ type: "TOOL_CALL_START", toolCallId, toolCallName, parentMessageId });
      const call = {
        record: { id: toolCallId, type: "function", function: { name: toolCallName, arguments: argsText } },
        hasResult: false,
      };
      parent.calls.push(call);
      for (const delta of chunkJson(argsText)) await stream.emit({ type: "TOOL_CALL_ARGS", toolCallId, delta });
      await stream.emit({ type: "TOOL_CALL_END", toolCallId });
      const resultMessageId = newId("msg");
      await stream.emit({ type: "TOOL_CALL_RESULT", messageId: resultMessageId, toolCallId, content: "ok", role: "tool" });
      call.hasResult = true;
      runMessages.push({ role: "tool", record: { id: resultMessageId, role: "tool", toolCallId, content: "ok" } });
      return toolCallId;
    },
    async stateDelta(ops) {
      // Kiểm trước trên bản sao: patch hỏng là lỗi kịch bản, không được lọt ra client.
      try {
        applyJsonPatch(clone(thread.state), ops);
      } catch (err) {
        throw new ProtocolGuardError(`STATE_DELTA không áp được lên state hiện tại: ${err.message}`);
      }
      await stream.emit({ type: "STATE_DELTA", delta: ops });
      const next = clone(thread.state);
      try {
        applyJsonPatch(next, ops);
        thread.state = next;
      } catch (err) {
        log(`WARN thread=${threadId} STATE_DELTA lệch do run song song: ${err.message}`);
      }
      for (const op of ops) {
        const m = /^\/jobs\/([^/]+)$/.exec(op.path);
        if (m && op.op === "add") jobsStarted.add(m[1].replace(/~1/g, "/").replace(/~0/g, "~"));
      }
    },
    setInterrupt(value) {
      interrupt = value;
    },
    async fail(message, code) {
      await stream.emit({ type: "RUN_ERROR", message, ...(code ? { code } : {}) });
    },
  };

  try {
    await stream.emit({ type: "RUN_STARTED", threadId, runId });
    await stream.emit({ type: "STATE_SNAPSHOT", snapshot: normalizedState(clone(thread.state)) });
    await plan.run(ctx);
    if (!stream.terminal) {
      const outcome = interrupt ? { outcome: { type: "interrupt", interrupts: [interrupt] } } : {};
      await stream.emit({ type: "RUN_FINISHED", threadId, runId, ...outcome });
      if (interrupt) thread.pendingInterrupt = { id: interrupt.id, runId };
    }
    const t = stream.terminalEvent;
    endLabel = t?.type === "RUN_ERROR" ? `RUN_ERROR(${t.code ?? ""})` : t?.outcome ? "RUN_FINISHED(interrupt)" : t?.type;
  } catch (err) {
    if (isAbortError(err) || abortController.signal.aborted) {
      endLabel = "ABORTED(client ngắt kết nối)";
    } else {
      console.error(`[mock-agent] lỗi nội bộ thread=${threadId} run=${runId}:`, err);
      endLabel = "RUN_ERROR(MOCK_INTERNAL_ERROR)";
      if (!stream.terminal) {
        try {
          await stream.emit({ type: "RUN_ERROR", message: "Mock agent gặp lỗi nội bộ", code: "MOCK_INTERNAL_ERROR" });
        } catch {
          // client đã đi; không còn gì để báo
        }
      }
    }
  } finally {
    commitRun(thread, runMessages);
    cleanupJobs(thread, jobsStarted, stream.terminal === "RUN_FINISHED" ? "finished" : stream.terminal ? "error" : "aborted");
    if (!res.writableEnded && !res.destroyed) res.end();
    log(
      `run thread=${threadId} run=${runId} scenario=${plan.name} end=${endLabel} ` +
        `events=${stream.eventTypes.length} ${Date.now() - startedAt}ms`,
    );
  }
}

/** Ghi assistant/tool message của run vào transcript. Tool call dở dang (chưa có result) bị bỏ. */
function commitRun(thread, runMessages) {
  for (const m of runMessages) {
    if (m.role === "tool") {
      appendToTranscript(thread, m.record);
      continue;
    }
    const toolCalls = m.calls.filter((c) => c.hasResult).map((c) => c.record);
    if (!m.content && toolCalls.length === 0) continue;
    const message = { id: m.id, role: "assistant" };
    if (m.content) message.content = m.content;
    if (toolCalls.length > 0) message.toolCalls = toolCalls;
    appendToTranscript(thread, message);
  }
}

/** Job do run tạo ra mà còn "running" khi run không xong: client dừng -> xóa; lỗi -> status "error". */
function cleanupJobs(thread, jobIds, how) {
  if (how === "finished" || jobIds.size === 0) return;
  for (const id of jobIds) {
    const job = thread.state?.jobs?.[id];
    if (!isPlainObject(job) || job.status !== "running") continue;
    if (how === "aborted") delete thread.state.jobs[id];
    else thread.state.jobs[id] = { ...job, status: "error", label: "Sinh câu hỏi thất bại" };
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("end", () => resolve({ tooLarge, text: tooLarge ? "" : Buffer.concat(chunks).toString("utf8") }));
    req.on("error", reject);
    req.on("close", () => {
      if (!req.complete) reject(new AbortedError());
    });
  });
}

/** Trả về chuỗi mô tả lỗi, hoặc null nếu body dùng được. */
function validateRunInput(body) {
  if (!isPlainObject(body)) return "Body phải là một object JSON (RunAgentInput)";
  if (typeof body.threadId !== "string" || body.threadId.length === 0) return "threadId phải là chuỗi không rỗng";
  if (typeof body.runId !== "string" || body.runId.length === 0) return "runId phải là chuỗi không rỗng";
  for (const key of ["messages", "context", "tools"]) {
    if (body[key] !== undefined && !Array.isArray(body[key])) return `${key} phải là mảng`;
  }
  if (body.resume !== undefined && body.resume !== null) {
    if (!Array.isArray(body.resume)) return "resume phải là mảng";
    for (const entry of body.resume) {
      if (
        !isPlainObject(entry) ||
        typeof entry.interruptId !== "string" ||
        (entry.status !== "resolved" && entry.status !== "cancelled")
      ) {
        return 'Mỗi phần tử resume cần interruptId (chuỗi) và status là "resolved" hoặc "cancelled"';
      }
    }
  }
  return null;
}

async function handleAgentPost(req, res) {
  let body;
  try {
    const { tooLarge, text } = await readBody(req);
    if (tooLarge) return sendJson(res, 413, { error: "payload_too_large", message: `Body vượt ${MAX_BODY_BYTES} byte` });
    body = JSON.parse(text);
  } catch (err) {
    if (isAbortError(err)) return undefined;
    return sendJson(res, 400, { error: "invalid_json", message: "Body không phải JSON hợp lệ" });
  }
  const problem = validateRunInput(body);
  if (problem) return sendJson(res, 400, { error: "invalid_input", message: problem });
  return handleRun(req, res, body);
}

function handleThreadMessages(res, rawId) {
  let threadId;
  try {
    threadId = decodeURIComponent(rawId);
  } catch {
    return sendJson(res, 400, { error: "invalid_thread_id", message: "threadId trên URL không hợp lệ" });
  }
  // Không tạo thread khi chỉ đọc. `state` (mục 4.3/4.7) để frontend khôi phục Studio sau F5.
  const thread = threads.get(threadId);
  return sendJson(res, 200, {
    messages: thread ? clone(thread.messages) : [],
    state: thread ? normalizedState(clone(thread.state)) : initialState(),
  });
}

async function handleRequest(req, res) {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }
  if (req.method === "POST" && path === "/agent") return handleAgentPost(req, res);
  if (req.method === "GET" && path === "/health") return sendJson(res, 200, { ok: true });
  const threadMatch = req.method === "GET" ? /^\/threads\/([^/]+)\/messages$/.exec(path) : null;
  if (threadMatch) return handleThreadMessages(res, threadMatch[1]);
  return sendJson(res, 404, { error: "not_found", message: `Không có route ${req.method} ${path}` });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("[mock-agent] lỗi không mong đợi:", err);
    if (!res.headersSent) sendJson(res, 500, { error: "internal_error", message: "Lỗi nội bộ của mock" });
    else if (!res.writableEnded) res.end();
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`[mock-agent] cổng ${PORT} đang bận. Chạy với PORT=<cổng khác>.`);
  else console.error("[mock-agent] lỗi server:", err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  log(`đang chạy tại http://${HOST ?? "localhost"}:${PORT} (POST /agent, GET /threads/:id/messages, GET /health)`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(`nhận ${signal}, dừng server`);
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
