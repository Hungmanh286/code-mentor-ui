# Mock AG-UI agent

Đây là server giả lập agent AG-UI để phát triển frontend chat của Mentor Code khi chưa có backend thật. Server viết bằng Node thuần (`node:http`), không cần dependency nào, và bám hợp đồng ở `docs/agui/PLAN.md` mục 4.3–4.8.

## Chạy

```bash
node mock-agent/server.mjs            # cổng 8787
PORT=8790 node mock-agent/server.mjs  # đổi cổng
npm run mock:agent                    # nếu package.json đã có script này
```

| Biến môi trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `8787` | Cổng lắng nghe |
| `HOST` | (mọi interface) | Địa chỉ bind |
| `MOCK_SLOW_MS` | `15000` | Thời lượng của kịch bản "chậm", tính bằng ms |

Frontend trỏ vào mock qua `VITE_AGENT_URL=http://localhost:8787/agent` (đây cũng là giá trị mặc định trong `src/config.js`). Muốn tắt server thì bấm Ctrl+C hoặc gửi SIGTERM.

## Endpoint

| Method và path | Kết quả |
| --- | --- |
| `POST /agent` | Body là `RunAgentInput` (camelCase). Response là `text/event-stream`: mỗi event là một dòng `data: <JSON>` kết thúc bằng `\n\n`, hai event cách nhau 20–40 ms |
| `GET /threads/:threadId/messages` | `{ "messages": AgUiMessage[], "state": … }`. `messages` gồm user, assistant (kèm `toolCalls`, `arguments` là JSON string) và `tool` (`toolCallId`, `content`). `state` là state hiện tại của thread theo mục 4.7, luôn có `artifacts.quizzes`, `artifacts.mindmaps` và `jobs`, để frontend khôi phục Studio sau F5. Thread chưa dùng (hay chưa có gì) thì trả `{ "messages": [], "state": { "artifacts": { "quizzes": [], "mindmaps": [] }, "jobs": {} } }`, không trả 404 |
| `GET /health` | `{ "ok": true }` |
| `OPTIONS *` | 204 kèm header CORS (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: content-type, authorization, accept`) |
| Route khác | 404 kèm JSON `{ error, message }` |

Server trả **400** (JSON, trước khi mở stream) khi body không phải JSON, khi thiếu `threadId`/`runId` dạng chuỗi, khi `messages`/`context`/`tools`/`resume` không phải mảng, hoặc khi một phần tử `resume` thiếu `interruptId` hay có `status` khác `"resolved"`/`"cancelled"`. Body lớn hơn 1 MB bị trả 413.

## Kịch bản

Mỗi run có dạng `RUN_STARTED` → `STATE_SNAPSHOT` (state hiện tại của thread) → kịch bản → `RUN_FINISHED` hoặc `RUN_ERROR`. Kịch bản được chọn theo thứ tự ưu tiên từ trên xuống, dựa trên **message user cuối cùng**. `content` của message có thể là string hoặc mảng part `{type:"text", text}`.

| # | Điều kiện | Kịch bản | Chuỗi event chính |
| --- | --- | --- | --- |
| 1 | Body có `resume`, entry `resolved` (kể cả khi kèm user message mới) | Job quiz với `payload.count` câu (mặc định 10, tối đa 50). Nếu `payload.difficulty` là `easy`/`medium`/`hard` thì gán cho mọi câu | `STATE_DELTA` add job (0) → text xen `STATE_DELTA` progress 40, 80 → `STATE_DELTA` done → `show_quiz` → `STATE_DELTA` add `/artifacts/quizzes/-` |
| 1 | Body có `resume`, entry `cancelled`, **không** có user message mới | Text "Đã hủy sinh câu hỏi." | `TEXT_MESSAGE_*` |
| 1 | Body có `resume`, entry `cancelled`, **có** user message mới | **Steer away** (`useAgUiSteerAway`): bỏ interrupt, xử lý message mới như run thường (dòng 2–9, theo nội dung message mới) | Tùy câu mới |
| 2 | Context `requested_tools` có `generate-questions` và/hoặc `mindmap` | Quiz 5 câu và/hoặc mindmap, **bất kể từ khóa**. Chọn cả hai thì quiz chạy trước, rồi mindmap gắn vào cùng message | Như dòng 6 và/hoặc dòng 8 |
| 3 | `lỗi`, `error` | Mở text, stream vài delta rồi `RUN_ERROR {message:"Mô phỏng lỗi từ agent", code:"MOCK_ERROR"}` (message vẫn mở) | `TEXT_MESSAGE_START` → `CONTENT…` → `RUN_ERROR` |
| 4 | `chậm`, `slow` | Text dài khoảng 15 giây, mỗi delta một từ, dùng để thử nút Dừng | `TEXT_MESSAGE_*` |
| 5 | `cấu hình`, `config` | Text ngắn rồi interrupt `quiz_config` | `TEXT_MESSAGE_*` → `RUN_FINISHED {outcome:{type:"interrupt", interrupts:[…]}}` |
| 6 | `quiz`, `câu hỏi`, `kiểm tra` | Như dòng 1 (resolved) với 5 câu | Như dòng 1 |
| 7 | `so sánh`, `khác`, `compare` | Text dẫn nhập rồi `present_ui` gồm `comparison_table`, `callout` (tip), `code_diff`, `steps` | `TEXT_MESSAGE_*` → `TOOL_CALL_*` |
| 8 | `mindmap`, `sơ đồ` | `show_mindmap` (gốc "Lập trình hướng đối tượng", 4 nhánh, mỗi nhánh 2–3 lá), rồi `STATE_DELTA` add `/artifacts/mindmaps/-` | `TEXT_MESSAGE_*` → `TOOL_CALL_*` → `STATE_DELTA` |
| 9 | (mặc định) | Markdown giải thích đa hình (có `$O(1)$` và khối code Java), rồi `cite_sources` (2 nguồn) và `suggest_followups` (3 câu, lần lượt dẫn tới các kịch bản so sánh, quiz, mindmap) | `TEXT_MESSAGE_*` → 2 × `TOOL_CALL_*` |

Một số chi tiết:

- **So khớp từ khóa** không phân biệt hoa thường, chuẩn hóa NFC, và **khớp nguyên từ** theo Unicode. Nhờ vậy "khác" không khớp trong "khách", và "lỗi" không khớp giữa một từ khác.
- **Tool call** luôn có `parentMessageId` là text message mở đầu của run. Thứ tự là `START → ARGS… → END → RESULT {content:"ok", role:"tool"}`; các delta ARGS ghép lại thành đúng `JSON.stringify(args)`.
- **Quiz** có 5 câu gốc với nội dung thật về OOP/Java. Khi `count > 5`, các câu lặp lại nhưng xoay thứ tự đáp án (`answer_index` được tính lại), có thêm hậu tố "(biến thể N)", và id khác nhau (`<quizId>-q1…qN`).
- **Resume** theo mục 4.6 của hợp đồng, xét **entry khớp với interrupt đang chờ** (không có thì lấy entry đầu tiên):
  - `resolved`: luôn theo nhánh resolved;
  - `cancelled` và không có user message mới: trả lời "Đã hủy sinh câu hỏi.";
  - `cancelled` và có user message mới (đây là cách `useAgUiSteerAway` gửi): bỏ interrupt, chọn kịch bản theo message mới nhất trong số các message mới.

  Vì vậy contract test phải **giữ nguyên id** khi gửi lại message cũ, và dùng id mới cho message mới.
- **Interrupt** có dạng `{ id:"int_…", reason:"input_required", message:"Sinh câu hỏi từ tài liệu đang bật?", metadata:{ kind:"quiz_config", defaults:{count:10, difficulty:"medium"}, documents:[] } }`. Mỗi run mới trên thread đều thay thế interrupt đang chờ: run resume thì trả lời nó, run thường thì bỏ qua nó.
- **Id** (`msg_…`, `call_…`, `int_…`, `job_…`, `quiz_…`, `mindmap_…`) dùng `crypto.randomUUID()`, nên duy nhất trên toàn server.

## Transcript và state

- Mọi thứ nằm **trong bộ nhớ**, tách riêng theo `threadId` (tối đa 1000 thread, bỏ thread cũ nhất). Tắt server là mất hết.
- Một user message là **"mới"** khi `id` của nó **chưa từng xuất hiện** trong transcript đã lưu của thread (mục 4.6). Mỗi run chỉ thêm các user message mới vào transcript. Client gửi lại transcript với id giữ nguyên, nên run resume không sinh bản trùng. Assistant và tool message luôn lấy từ chính những gì server đã phát, không lấy từ input.
- Khi client ngắt kết nối giữa chừng, server dừng kịch bản ngay và không ghi gì thêm. Transcript giữ phần text đã stream nhưng bỏ tool call chưa có result. Job do run đó tạo mà còn `running` thì bị xóa khỏi state.
- State có dạng `{ artifacts: { quizzes: [], mindmaps: [] }, jobs: {} }` (mục 4.7). Server là nguồn sự thật nên `state` trong input bị bỏ qua. `STATE_SNAPSHOT` đầu mỗi run giúp client đồng bộ lại, và `GET /threads/:id/messages` cũng trả kèm state này để khôi phục Studio khi tải lại trang.

## Ví dụ curl

```bash
# Kịch bản mặc định
curl -N -X POST http://localhost:8787/agent \
  -H 'content-type: application/json' -H 'accept: text/event-stream' \
  --data '{"threadId":"t1","runId":"r1","messages":[{"id":"u1","role":"user","content":"giải thích đa hình"}],"tools":[],"context":[],"state":{},"forwardedProps":{}}'

# requested_tools (chip Mindmap ở composer)
curl -N -X POST http://localhost:8787/agent -H 'content-type: application/json' \
  --data '{"threadId":"t2","runId":"r1","messages":[{"id":"u1","role":"user","content":"abc"}],"context":[{"description":"requested_tools","value":"[\"mindmap\"]"}]}'

# Interrupt rồi resume: lấy interrupt id từ event RUN_FINISHED cuối cùng
curl -N -X POST http://localhost:8787/agent -H 'content-type: application/json' \
  --data '{"threadId":"t3","runId":"r1","messages":[{"id":"u1","role":"user","content":"cấu hình quiz"}]}'
curl -N -X POST http://localhost:8787/agent -H 'content-type: application/json' \
  --data '{"threadId":"t3","runId":"r2","messages":[{"id":"u1","role":"user","content":"cấu hình quiz"}],"resume":[{"interruptId":"int_…","status":"resolved","payload":{"count":3,"difficulty":"easy"}}]}'
# Hủy (sau một run "cấu hình" khác): gửi lại id cũ u1, không có message mới -> "Đã hủy sinh câu hỏi."
curl -N -X POST http://localhost:8787/agent -H 'content-type: application/json' \
  --data '{"threadId":"t4","runId":"r2","messages":[{"id":"u1","role":"user","content":"cấu hình quiz"}],"resume":[{"interruptId":"int_…","status":"cancelled"}]}'
# Steer away: resume cancelled KÈM message mới u2 -> trả lời u2 (ở đây là kịch bản so sánh)
curl -N -X POST http://localhost:8787/agent -H 'content-type: application/json' \
  --data '{"threadId":"t5","runId":"r2","messages":[{"id":"u1","role":"user","content":"cấu hình quiz"},{"id":"u2","role":"user","content":"so sánh abstract class và interface"}],"resume":[{"interruptId":"int_…","status":"cancelled"}]}'

# Lịch sử, health, preflight
curl http://localhost:8787/threads/t3/messages
curl http://localhost:8787/health
curl -i -X OPTIONS http://localhost:8787/agent
```

Contract test độc lập: `node scripts/agui-smoke.mjs http://localhost:8787/agent`.

## Bảo vệ thứ tự event

Mọi event đều đi qua một "guard" trong `server.mjs` trước khi được ghi ra stream. Guard kiểm đúng các luật ở mục 4.8:

- event đầu tiên là `RUN_STARTED`, và không có gì sau event cuối;
- delta không rỗng;
- message và tool call phải mở rồi mới được nối tiếp hay đóng;
- args phải ghép lại thành JSON hợp lệ;
- `RESULT` chỉ đến sau `END`;
- mọi thứ phải đóng trước `RUN_FINISHED`;
- id không được dùng lại.

Nếu một kịch bản vi phạm, event lỗi **không** được gửi đi. Thay vào đó server phát `RUN_ERROR {code:"MOCK_INTERNAL_ERROR"}` (event này luôn hợp lệ) và ghi stack ra stderr. Mỗi run in một dòng log ra stdout, gồm `threadId`, kịch bản và event cuối (hoặc `ABORTED` khi client ngắt kết nối).

## Giới hạn của mock

- Không có LLM. Câu trả lời là nội dung soạn sẵn, chọn theo từ khóa.
- Không có xác thực. Header `authorization` được CORS cho phép nhưng server bỏ qua.
- Không lưu bền: transcript, state và interrupt mất khi tắt server.
- Interrupt đang chờ **không** được khôi phục sau F5 (giới hạn đã biết của MVP), nên form `quiz_config` không hiện lại. Người dùng chỉ cần gõ câu khác.
- Mỗi run có tối đa một interrupt. Khi body có nhiều entry `resume`, server dùng entry khớp với interrupt đang chờ, nếu không có thì dùng entry đầu tiên.
- Không phát `MESSAGES_SNAPSHOT`, reasoning, `STEP_*`, `CUSTOM` hay activity. Không hỗ trợ frontend tool (mảng `tools` trong input bị bỏ qua).
- Job dài chỉ được mô phỏng bên trong một run. Không có job chạy nền ngoài run, và không nối lại được stream đã đứt.
