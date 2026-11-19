// Minimal CDP driver for headless Chrome (no deps; Node >= 22 global WebSocket). Adapted from session-2 driver.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch({ port = 9333, width = 1440, height = 900 } = {}) {
  const userDir = mkdtempSync(join(process.env.SP || tmpdir(), "chrome-"));
  const proc = spawn("google-chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) for (const l of listeners) l(m); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const logs = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled") logs.push({ level: m.params.type, text: m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ") });
    else if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails; logs.push({ level: "exception", text: d.exception?.description ?? d.text }); }
    else if (m.method === "Log.entryAdded") { const e = m.params.entry; logs.push({ level: `log.${e.level}`, text: `${e.text} ${e.url ?? ""}`.trim() }); }
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const api = { send, logs, sleep,
    async goto(url, waitMs = 1500) { await send("Page.navigate", { url }); await sleep(waitMs); },
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; },
    async waitFor(expr, timeout = 20000, step = 150) { const t0 = Date.now();
      while (Date.now() - t0 < timeout) { try { if (await api.eval(`!!(${expr})`)) return true; } catch {} await sleep(step); }
      throw new Error(`waitFor timeout: ${expr}`); },
    async shot(path) { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); return path; },
    async typeText(text) { await send("Input.insertText", { text }); },
    async key(key, code = key, keyCode = 13, modifiers = 0) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(key === "Enter" ? { text: "\r" } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers }); },
    async clickAt(x, y) { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); },
    async click(elExpr) { const box = await api.eval(`(() => { const el = ${elExpr}; if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
      if (!box) throw new Error(`click: element not found: ${elExpr}`); await api.clickAt(box.x, box.y); return box; },
    async close() { try { ws.close(); } catch {} proc.kill("SIGKILL"); },
  };
  return api;
}
