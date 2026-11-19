# Trạng thái thực hiện kế hoạch (orchestrator)

> File này do orchestrator cập nhật, ghi lại vị trí hiện tại trong `docs/agui/PLAN.md`.
> Chi tiết từng agent nằm ở `docs/agui/status/<X>.md` (append-only). Baseline nằm ở `BASELINE.md`.

## Vị trí hiện tại

**✅ HOÀN THÀNH Đợt 0–5** (2026-11-19). Code được push lên nhánh `assistant-ui`

| Đợt | Trạng thái |
| --- | --- |
| 0: chuẩn bị, baseline | ✅ Xong. Nhánh `feat/agui-mvp` tách từ `copilot-kit` @ `ccd5341`. Đã có `BASELINE.md` |
| 1: A · C1 · D · E1 · F | ✅ Cả 5 agent đã FINAL |
| Cổng 1 | ✅ Đạt: build pass; `npm ls` sạch; smoke 101/0 (đầy đủ) và 81/0 (contract-only) với mock; `py_compile` OK; 19 file mới lint 0/0; `src/` 71/12, bằng baseline; `API.md` đủ |
| 2: B · C2 · E2 | ✅ Cả 3 đã FINAL (B: harness jsdom 57/57 với SessionPage thật và mock thật) |
| Cổng 2 | ✅ Build pass (bundle khi bật cờ có toolkit, khi tắt cờ thì đã tree-shake); 28 file mới lint 0 lỗi (1 warning HMR); `src/` 71 lỗi, bằng baseline; smoke 101/0 và 81/0 |
| 3: E2E | ✅ 25/25 với cờ bật (13 mục ở 7.3) và mục 12 khi tắt cờ: Chatbot cũ, console đúng baseline (4 lỗi WS, 0 lỗi khác). Kịch bản và ảnh lưu ở `docs/agui/e2e/` |
| 4: review độc lập | ✅ R: không có lỗi high. Đã sửa 3 lỗi frontend (lịch sử lỗi thì có toast; lỗi giao thức không lộ ra UI; boundary reset theo `argsText`). Chạy lại: build pass, lint 71 lỗi (bằng baseline), smoke 101/0, E2E 26/26 (thêm mục 14), cờ tắt pass |
| 5: báo cáo | ✅ Xem mục "Kết quả cuối" |

## Trạng thái từng agent ở Đợt 1

| Agent | Trạng thái | Đã xong | Còn lại |
| --- | --- | --- | --- |
| A | ✅ FINAL | Deps (ghim chính xác), gỡ CopilotKit, config, đổi URL, `API.md` (438 dòng, 10/10 dòng mục 5, harness jsdom 66/66), provider, history adapter có nạp `state` theo đường chính thức `load() → {…repo, state}` | — |
| C | ✅ FINAL C1 + C2 | C1: 15 component, render thử 5962 tổ hợp. C2: `toolkit.jsx` với 5 tool, mỗi tool bọc boundary; runtime-check jsdom với mock thật 60/60 (stream, quiz, mindmap, follow-up bị disable khi đang chạy hoặc có interrupt, giả lập F5) | Còn 1 warning `react-refresh/only-export-components` ở `toolkit.jsx`, chỉ ảnh hưởng HMR, chấp nhận |
| D | ✅ FINAL | Mock và README; lịch sử trả kèm `state`; 17/17 pass với `HttpAgent` thật; đúng mục 4.6 | — |
| E | ✅ FINAL E1 + E2 | E1: smoke test (101 kiểm tra; đã cập nhật cho preflight 2xx, 400/422, chỉ snapshot, event bổ sung, `*_CHUNK`). E2: `useMentorState` (chuẩn hóa mọi shape), `StudioAgentArtifacts` (thanh tiến độ tự viết), StudioDashboard đã đổi 10 URL và chèn khối mới; render test 40/40; lint bằng baseline (3/0) | Khối Studio đặt trong phần `!collapsed`, orchestrator chấp nhận |
| F | ✅ FINAL | `backend-reference/`: selfcheck 52/52; smoke contract-only 81/0 với uvicorn thật; probe Postgres (interrupt và resume qua 2 app); đã vá 5 hành vi của ag-ui-langgraph 0.0.47 lệch hợp đồng | — |

## Quyết định đã chốt trong quá trình chạy (đã ghi vào PLAN.md)

1. Base là `copilot-kit` @ `ccd5341` (đã xác nhận qua reflog).
2. Luật 10: lệnh lint chuẩn là `npx eslint --rule 'react/prop-types: off'`. File cũ so với bảng luật 10 trong BASELINE (tổng `src/` là 71 lỗi, 12 cảnh báo).
3. Không dùng `ui/progress`, `ui/collapsible`, `ui/hover-card`, `ui/tooltip` (CONTRACT_ISSUE do C nêu, orchestrator chấp nhận). Mục 4.9, 6.C.6, 6.E2 đã được sửa.
4. `src/index.css` có selector `.markdown-container h1, h2…` làm lỗi heading toàn trang. MVP không sửa; component tự override.

## Quyết định thêm (17:15)

5. Mục 4.6: user message "mới" là message có id chưa từng có trong transcript đã lưu. Resume cancelled không kèm message mới thì trả lời hủy; kèm message mới thì steer away.
6. Mục 4.3: response lịch sử thành `{ messages, state? }` (state tùy chọn). Interrupt không khôi phục được sau F5 là giới hạn đã biết.
7. `highlight_col` đếm từ 0. `requested_tools` ưu tiên ngay sau `resume`, thắng mọi từ khóa.

## Việc orchestrator đã làm

- `src/websocket.js` (file không có chủ): đổi tên CustomEvent chết `copilotkit-interrupt` thành `legacy-ws-interrupt`. Event này không có listener nên hành vi không đổi. Giờ `grep copilotkit src package.json` sạch.

## Quyết định thêm ở Cổng 1

8. Preflight chấp nhận mọi 2xx; body JSON hỏng trả 400 hoặc 422 (theo FastAPI và Starlette).
9. Mục 4.8 cho phép thêm `STEP_*`, `MESSAGES_SNAPSHOT`, `CUSTOM`, `RAW`, `REASONING_*`; backend được phép chỉ phát `STATE_SNAPSHOT`. Interrupt id là chuỗi bất kỳ; `documents` có kiểu `string[]`.
10. Các cách diễn giải của E1 (không gian id, bắt buộc có `TOOL_CALL_RESULT`, luật so khớp lịch sử…) được chấp nhận nguyên trạng.

## Yêu cầu của người dùng (2026-11-19)

- Khi xong Đợt 4 và Đợt 5: commit rồi push lên **nhánh mới `assistant-ui`** trên `origin`. Chỉ commit phạm vi của kế hoạch (src/, mock-agent/, scripts/, backend-reference/, package*.json, docs/agui/), không commit các thư mục untracked có từ trước (.agents/, .claude/, .design*/, .ds-sync/, ds-bundle/, skills-lock.json).

- Người dùng yêu cầu commit được tối ưu và rà soát những gì nên đưa vào `.gitignore`. Đã thêm vào `.gitignore`: `__pycache__/`, `*.py[cod]`, `.venv/`, `venv/`; `.design/`, `.design-sync/`, `.ds-sync/` (41 MB, có node_modules), `ds-bundle/`; `.agents/`, `.claude/skills/` (symlink skill, cài lại được từ `skills-lock.json`, file này sẽ được commit); `docs/agui/e2e/shots/` (sinh lại bằng e2e.mjs).
- Kế hoạch commit (thực hiện sau Đợt 4):
  1. `chore: gitignore` (.gitignore, skills-lock.json)
  2. `chore(deps)`: thay CopilotKit bằng assistant-ui và AG-UI, gom URL (package*.json, .env.sample, src/config.js, main.jsx, AuthContext, Chatbot, SourcePanel, các page trừ SessionPage, websocket.js)
  3. `feat(agent)`: runtime, tool UI, thread, state Studio sau cờ (src/agent/**, AgentChat, SessionPage, StudioDashboard)
  4. `feat(mock)`: mock server và contract test (mock-agent/, scripts/)
  5. `docs(backend)`: backend tham chiếu (backend-reference/)
  6. `docs(agui)`: kế hoạch, status, kịch bản E2E (docs/)

## Quyết định ở Đợt 2 và Đợt 3

11. Khi cờ bật, SourcePanel và Studio nhận `sessionUUID = threadId` (đề xuất của B, chấp nhận). Hệ quả: khi backend REST tắt, console có lỗi REST/SSE của panel cũ; những lỗi này được xếp vào nhóm "backend cũ không chạy" khi so M6.
12. Interrupt khác `quiz_config`: nút Đồng ý gửi payload `{approved:true}`, ghi nhận là quy ước của MVP.
13. E2E: các lần fail đầu tiên đều do lỗi kịch bản (selector, `innerText` chữ hoa vì CSS uppercase), không phải lỗi app. Đã sửa kịch bản rồi chạy lại.

## Ghi chú (đã xử lý ở Cổng 1)

- A: lockfile ở `ccd5341` bị lỗi thời (thiếu nhiều gói root), nên npm đã resolve lại trong phạm vi semver, khiến diff lockfile lớn. Cần nêu khi báo cáo.
- D: `steerAway()` gửi run gồm `resume=[{status:"cancelled"}]` **kèm** một user message mới. Khi đó mock phải trả lời message mới. Cần kiểm hợp đồng mục 4.6 và 6.D có cần bổ sung không.
- Cổng 1 phải kiểm: `API.md` đủ ✅/❌; `npm ls` sạch; `npx vite build`; smoke pass với mock; `py_compile` của F; mọi `CONTRACT_ISSUE` đã được giải quyết.

## Cách tiếp tục nếu phiên orchestrator bị mất

1. Đọc file này, `PLAN.md`, và `status/*.md`.
2. Với agent chưa có dòng `FINAL`: khởi chạy agent mới bằng prompt ở mục 9 của PLAN, kèm câu: "Bạn đang tiếp tục việc dở của Agent X; đọc docs/agui/status/X.md và các file hiện có trong phạm vi sở hữu, kiểm lại những gì đã làm rồi làm tiếp phần còn thiếu."
3. Không chạy lại `npm install` nếu `npm ls` đã sạch.


## Kết quả cuối (Definition of Done)

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| M1 | Build | ✅ `npx vite build` pass |
| M2 | Lint | ✅ File mới 0 lỗi (1 warning HMR ở toolkit.jsx); `src/` 71 lỗi, bằng baseline luật 10 |
| M3 | Contract test | ✅ 101/0 (đầy đủ), 81/0 (contract-only) với mock; backend tham chiếu 81/0 |
| M4 | E2E | ✅ 26/26 (`docs/agui/e2e/e2e.mjs`; ảnh chụp sinh lại vào thư mục `shots/`, đã gitignore) |
| M5 | Không hồi quy khi tắt cờ | ✅ Chatbot cũ; khi tắt cờ, phần AG-UI bị loại khỏi bundle |
| M6 | Console | ✅ Khi tắt cờ: đúng baseline (4 lỗi WS). Khi bật cờ: chỉ có lỗi do backend cũ hoặc mock bị tắt chủ động |
| M7 | Backend tham chiếu | ✅ `py_compile` OK, selfcheck 52/52, probe Postgres |
| M8 | Review độc lập | ✅ Không có lỗi high; đã sửa mọi lỗi frontend đã xác nhận có ảnh hưởng tới người dùng |

## Việc còn mở (mức thấp, từ review R; phase sau)

1. FollowUps khóa vĩnh viễn sau một lần bấm. Đây là chủ ý, nhưng nếu runtime lặng lẽ từ chối lệnh gửi thì chip không mở lại (R #4, plausible).
2. Backend tham chiếu chỉ xử lý chip đầu tiên khi chọn cả "Sinh câu hỏi" lẫn "Mindmap", trong khi mock xử lý cả hai. Hợp đồng chưa định nghĩa trường hợp nhiều giá trị (R #5).
3. Job đã `done` không bao giờ bị xóa khỏi `state.jobs` (cả mock lẫn backend), khiến payload snapshot và lịch sử lớn dần (R #6).
4. Backend tham chiếu: node quiz/mindmap chỉ bắt `ValidationError`/`ValueError`; lỗi khác có thể để job hiện "running" tới run kế tiếp (R #7).
5. `MessageBoundary` trong Thread chưa có cơ chế reset (R #3, chỉ là rủi ro tiềm ẩn).
6. Interrupt đang chờ không được khôi phục sau F5; `/session` mới không đổi URL sang `/session/:id`, nên F5 tạo phiên mới.
7. Diff `package-lock.json` lớn vì lockfile ở `ccd5341` đã lỗi thời (thiếu nhiều gói root).
