import { launch } from "./cdp.mjs";
import { spawn } from "node:child_process";
const SP = process.env.SP, REPO = process.env.REPO, APP = process.env.APP || "http://localhost:3001";
const results = []; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (n, cond, info = "") => { results.push({ n, pass: !!cond, info }); console.log(`${cond ? "PASS" : "FAIL"}  ${n}${info ? " — " + info : ""}`); };
let mock;
const startMock = async () => { mock = spawn("node", ["mock-agent/server.mjs"], { cwd: REPO, env: { ...process.env, PORT: "8787" }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch("http://localhost:8787/health")).ok) return; } catch {} await sleep(150); } throw new Error("mock not up"); };
const stopMock = async () => { mock?.kill("SIGTERM"); await sleep(500); };
const b = await launch();
const $ = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const btnByText = (t, scope = "document") => `[...${scope}.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(t)} && !x.disabled)`;
const count = (sel) => b.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const body = () => b.eval(`document.body.innerText`);
const idle = async (t = 30000) => { await sleep(400); await b.waitFor(`!document.querySelector('[aria-label="Dừng"]')`, t); await sleep(300); };
const send = async (text) => { await b.click($('[aria-label="Nội dung tin nhắn"]')); await b.typeText(text); await b.key("Enter"); };
const shot = (name) => b.shot(`${SP}/shots/${name}.png`);
const THREAD = `e2e-${Date.now()}`;
try {
  await startMock();
  await b.goto(`${APP}/login`, 2000);
  await b.eval(`localStorage.setItem('user', JSON.stringify({user_id: 1, user_name: 'tester'})); true`);
  await b.goto(`${APP}/session/${THREAD}`, 3000);
  await b.waitFor($('[aria-label="Nội dung tin nhắn"]'));
  ok("0 trang /session render Thread AG-UI", (await body()).includes("Chào tester"));
  await shot("00-empty");

  // 1
  let a0 = await count('[aria-label="Trợ lý"]');
  await send("giải thích đa hình"); await idle();
  ok("1a text + KaTeX + code", await count(".katex") > 0 && await count("pre") > 0);
  ok("1b chip trích dẫn (2)", await count('[role="tooltip"]') >= 2, `tooltip=${await count('[role="tooltip"]')}`);
  const fu = await b.eval(`(() => { const l=[...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='Hỏi tiếp' && e.children.length===0).pop(); return l ? l.parentElement.querySelectorAll('button').length : 0 })()`);
  ok("1c 3 follow-up", fu === 3, `n=${fu}`);
  await shot("01-default");
  a0 = await count('[aria-label="Trợ lý"]');
  await b.click(`(() => { const l=[...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='Hỏi tiếp' && e.children.length===0).pop(); return [...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='Hỏi tiếp' && e.children.length===0).pop().parentElement.querySelector('button:not([disabled])') })()`);
  await idle();
  ok("1d bấm follow-up gửi được", await count('[aria-label="Trợ lý"]') === a0 + 1);

  // 2
  await send("tạo quiz"); await idle();
  const quizGroups = await count('[role="group"][aria-label^="Bài kiểm tra"]');
  ok("2a QuizCard hiện", quizGroups >= 1, `groups=${quizGroups}`);
  await b.click(`[...document.querySelectorAll('[role="group"][aria-label^="Bài kiểm tra"]')].pop().querySelector('button[aria-pressed]')`);
  await sleep(400);
  ok("2b chọn đáp án → khóa + giải thích", await b.eval(`[...document.querySelectorAll('[role="group"][aria-label^="Bài kiểm tra"]')].pop().querySelectorAll('button[aria-disabled="true"]').length > 0`));
  const studio = await body();
  ok("2c Studio có 'Từ trợ lý' + quiz", studio.toLowerCase().includes("từ trợ lý"));
  await shot("02-quiz");

  // 3
  await send("so sánh abstract class và interface"); await idle();
  const blocks = await b.eval(`(() => { const r=[...document.querySelectorAll('[aria-busy], section, div')].length; return { table: document.querySelectorAll('table').length, note: document.querySelectorAll('[role="note"]').length, unsupported: document.body.innerText.includes('Không hỗ trợ khối này') } })()`);
  ok("3 present_ui: bảng + callout + không có block lạ", blocks.table >= 1 && blocks.note >= 1 && !blocks.unsupported, JSON.stringify(blocks));
  await shot("03-compare");

  // 4
  const mmBefore = await count('button[aria-expanded]');
  await send("vẽ mindmap"); await idle();
  const mmAfter = await count('button[aria-expanded]');
  ok("4a mindmap có nút mở/thu nhánh", mmAfter > mmBefore, `${mmBefore}→${mmAfter}`);
  await b.click(btnByText("Thu gọn")); await sleep(300);
  const collapsed = await b.eval(`[...document.querySelectorAll('button[aria-expanded="true"]')].length`);
  await b.click(btnByText("Mở hết")); await sleep(300);
  const expanded = await b.eval(`[...document.querySelectorAll('button[aria-expanded="true"]')].length`);
  ok("4b Thu gọn / Mở hết", expanded > collapsed, `expanded-true ${collapsed}→${expanded}`);
  await shot("04-mindmap");

  // 5
  await send("cấu hình quiz"); await idle();
  await b.waitFor($('[aria-label="Cấu hình sinh câu hỏi"]'));
  await shot("05a-config");
  await b.click(btnByText("10", $('[aria-label="Cấu hình sinh câu hỏi"]')));
  await b.click(btnByText("Khó", $('[aria-label="Cấu hình sinh câu hỏi"]')));
  const qBefore = await count('[role="group"][aria-label^="Bài kiểm tra"]');
  await b.click(btnByText("Sinh câu hỏi")); await idle();
  const lastQuizText = await b.eval(`[...document.querySelectorAll('[role="group"][aria-label^="Bài kiểm tra"]')].pop()?.innerText || ''`);
  ok("5a resolved 10 câu, form đóng", (await count('[role="group"][aria-label^="Bài kiểm tra"]')) === qBefore + 1 && /10/.test(lastQuizText) && !(await b.eval(`!!${$('[aria-label="Cấu hình sinh câu hỏi"]')}`)), lastQuizText.slice(0, 80).replace(/\n/g, " | "));
  await send("cấu hình quiz"); await idle();
  await b.waitFor($('[aria-label="Cấu hình sinh câu hỏi"]'));
  await b.click(btnByText("Hủy", $('[aria-label="Cấu hình sinh câu hỏi"]'))); await idle();
  ok("5b Hủy → 'Đã hủy sinh câu hỏi.'", (await body()).includes("Đã hủy sinh câu hỏi."));

  // 6
  await send("cấu hình quiz"); await idle();
  await b.waitFor($('[aria-label="Cấu hình sinh câu hỏi"]'));
  const mm6 = await count('[aria-label^="Mở"], [aria-label^="Thu gọn nhánh"]');
  await send("vẽ mindmap"); await idle();
  ok("6 steer away: form đóng + câu mới được trả lời", !(await b.eval(`!!${$('[aria-label="Cấu hình sinh câu hỏi"]')}`)) && (await count('[aria-label^="Mở"], [aria-label^="Thu gọn nhánh"]')) > mm6);
  await shot("06-steer");

  // 7
  await send("chậm"); await sleep(2000);
  ok("7a đang chạy: có nút Dừng", await b.eval(`!!${$('[aria-label="Dừng"]')}`));
  await b.click($('[aria-label="Dừng"]')); await idle(5000);
  ok("7b Dừng → 'Đã dừng.'", (await body()).includes("Đã dừng."));
  a0 = await count('[aria-label="Trợ lý"]');
  await send("giải thích đa hình"); await idle();
  ok("7c gửi tiếp được sau khi dừng", await count('[aria-label="Trợ lý"]') === a0 + 1);

  // 8
  await send("lỗi"); await idle();
  await sleep(500);
  const toast8 = await count('[data-sonner-toast]');
  ok("8 lỗi: khối lỗi trong message + toast", (await count('.border-error-red\\/30')) >= 1 && toast8 >= 1, `toast=${toast8}`);
  await shot("08-error");

  // 9
  await b.click($('[aria-label="Chọn công cụ"]')); await sleep(300);
  await b.click(`[...document.querySelectorAll('[aria-label="Công cụ"] button')].find(x => x.textContent.includes('Mindmap'))`); await sleep(300);
  const mm9 = await count('[aria-label^="Mở"], [aria-label^="Thu gọn nhánh"]');
  await send("abc"); await idle();
  ok("9 chip Mindmap + 'abc' → mindmap", (await count('[aria-label^="Mở"], [aria-label^="Thu gọn nhánh"]')) > mm9);
  await b.click($('[aria-label^="Bỏ chọn"]')).catch(() => {});

  // 10
  const before10 = { asst: await count('[aria-label="Trợ lý"]'), quiz: await count('[role="group"][aria-label^="Bài kiểm tra"]'), mm: await count('button[aria-expanded]') };
  await b.goto(`${APP}/session/${THREAD}`, 3500);
  await b.waitFor(`document.querySelectorAll('[aria-label="Trợ lý"]').length > 0`, 15000);
  const after10 = { asst: await count('[aria-label="Trợ lý"]'), quiz: await count('[role="group"][aria-label^="Bài kiểm tra"]'), mm: await count('button[aria-expanded]') };
  ok("10 F5 khôi phục lịch sử + QuizCard + mindmap", after10.quiz === before10.quiz && after10.mm > 0 && after10.asst >= before10.asst - 1, `before=${JSON.stringify(before10)} after=${JSON.stringify(after10)}`);
  ok("10b Studio khôi phục sau F5", (await body()).toLowerCase().includes("từ trợ lý"));
  await shot("10-reload");

  // 11
  await stopMock();
  const logsBefore11 = b.logs.length;
  await send("giải thích đa hình"); await sleep(3000);
  const t11 = await body();
  ok("11a tắt mock: báo lỗi, không trắng trang", t11.length > 200 && ((await count('[data-sonner-toast]')) >= 1 || t11.includes("Không kết nối")), `toast=${await count('[data-sonner-toast]')}`);
  await startMock();
  a0 = await count('[aria-label="Trợ lý"]');
  await send("giải thích đa hình"); await idle();
  ok("11b bật lại mock: gửi được", await count('[aria-label="Trợ lý"]') > a0);
  await shot("11-recover");

  // 14 history load failure → toast (review R #1)
  await stopMock();
  await b.goto(`${APP}/session/${THREAD}`, 3500);
  await b.waitFor(`document.body.innerText.includes("Không tải được lịch sử")`, 15000).catch(() => {});
  ok("14 lịch sử lỗi → toast 'Không tải được lịch sử'", (await body()).includes("Không tải được lịch sử"));
  await shot("14-history-error");
  await startMock();

  // 13 console
  const bad = b.logs.filter(l => /error|exception|warn/i.test(l.level));
  const classify = (t) => /8686|chat\/pedagogical|ERR_CONNECTION_REFUSED|Failed to load resource|\[SSE\]/.test(t) ? "legacy-backend-down" : /Agent execution failed|Failed to fetch|8787/.test(t) ? "mock-down(#11)" : "OTHER";
  const groups = {}; for (const l of bad) { const c = classify(l.text); (groups[c] ||= []).push(`[${l.level}] ${l.text.slice(0, 160)}`); }
  ok("13 không có lỗi console loại OTHER", !(groups.OTHER?.length), Object.entries(groups).map(([k, v]) => `${k}=${v.length}`).join(", "));
  if (groups.OTHER) for (const t of groups.OTHER.slice(0, 15)) console.log("   ", t);
  const reactWarn = b.logs.filter(l => /Warning:|unique "key"|Rules of Hooks|Cannot update a component/.test(l.text));
  ok("13b không có cảnh báo React key/hook", reactWarn.length === 0, reactWarn.slice(0, 3).map(l => l.text.slice(0, 120)).join(" | "));
} catch (e) { ok("EXCEPTION", false, e.message); try { await shot("zz-exception"); } catch {} }
finally { await b.close(); await stopMock(); }
const f = results.filter(r => !r.pass).length; console.log(`\nSUMMARY: ${results.length - f}/${results.length} PASS`); process.exit(f ? 1 : 0);
