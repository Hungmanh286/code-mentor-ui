import { launch } from "./cdp.mjs";
const SP = process.env.SP; const b = await launch({ port: 9334 });
const reqs = []; b.send("Network.enable"); 
try {
  await b.goto("http://localhost:3002/login", 2500);
  await b.eval(`localStorage.setItem('user', JSON.stringify({user_id: 1, user_name: 'tester'})); true`);
  await b.goto("http://localhost:3002/session", 6000);
  await b.shot(`${SP}/shots/12-flag-off.png`);
  const txt = await b.eval(`document.body.innerText`);
  const legacy = /Ask me anything about programming|Welcome/i.test(txt);
  const agui = await b.eval(`!!document.querySelector('[aria-label="Nội dung tin nhắn"]')`);
  console.log(`${legacy && !agui ? "PASS" : "FAIL"}  12 flag tắt → Chatbot cũ (legacy=${legacy}, agui=${agui})`);
  const bad = b.logs.filter(l => /error|exception|warn/i.test(l.level));
  const ws = bad.filter(l => /chat\/pedagogical/.test(l.text)).length;
  const other = bad.filter(l => !/chat\/pedagogical/.test(l.text));
  console.log(`console: ws-errors=${ws} other=${other.length} (baseline: 4 ws errors, 0 other)`);
  for (const l of other) console.log("   ", `[${l.level}] ${l.text.slice(0, 200)}`);
  console.log(`${other.length === 0 && !bad.some(l => l.level === "exception") ? "PASS" : "FAIL"}  12b/M6 console flag-off không thêm lỗi mới so với baseline`);
} finally { await b.close(); }
