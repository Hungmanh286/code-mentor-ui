# backend-reference: agent AG-UI cho Mentor Code (LangGraph + FastAPI)

Bộ khung tham chiếu để port sang backend FastAPI thật (cổng 8686). Bộ khung này bám đúng hợp đồng ở `docs/agui/PLAN.md` mục 4, giống như `mock-agent/`, nhưng dùng stack thật: `ag-ui-langgraph` → `LangGraphAgent` → graph LangGraph → checkpointer Postgres.

Mọi khẳng định về thư viện trong tài liệu này đều đã được kiểm trên **ag-ui-langgraph 0.0.47, ag-ui-protocol 1.0.0, langgraph 1.2.22** (đọc source và chạy thật, xem mục 10). Chỗ nào chưa kiểm được thì ghi ở mục 9.

```text
backend-reference/
├── README.md            tài liệu này
├── requirements.txt     phiên bản tối thiểu (= phiên bản đã kiểm)
├── selfcheck.py         tự kiểm offline: 52 kiểm tra hợp đồng, không cần mạng/DB/API key
└── agent/
    ├── ui_catalog.py    Pydantic v2 cho 5 UI tool (mục 4.5), validate_present_ui()
    ├── state.py         MentorState (mục 4.7 + requested_tools, active_document_ids, user), MentorInput
    ├── tools.py         5 @tool, ScriptedMessageModel, stream_ui_tool_calls()
    ├── graph.py         router + qa_rag / summarize / mindmap / quiz_intro → quiz / code_mentor / ui_tools
    ├── history.py       checkpoint → AG-UI messages (+ state) cho /threads/{id}/messages
    └── server.py        MentorLangGraphAgent (các điều chỉnh), FastAPI app, CORS, Postgres
```

---

## 1. Chạy thử nhanh (khoảng 2 phút)

```bash
cd backend-reference
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

python selfcheck.py                     # mong đợi: "52/52 checks passed", exit 0
uvicorn agent.server:app --port 8686    # in-memory checkpointer (chỉ dùng khi dev)

# ở terminal khác, tại gốc repo frontend:
AGENT_URL=http://localhost:8686/agent node scripts/agui-smoke.mjs --contract-only
```

Frontend: đặt `VITE_AGENT_URL=http://localhost:8686/agent` và `VITE_USE_AGUI=true`.

Khi chưa nối LLM, các hàm `# TODO(LLM)` trả về dữ liệu giữ chỗ cố định (OOP/Java), nhờ vậy graph chạy được trọn vẹn. Dữ liệu này **chỉ dùng để thử**, không dùng cho production.

---

## 2. Port từng bước vào backend FastAPI hiện có

### 2.1 Cài đặt

```bash
pip install "ag-ui-langgraph[fastapi]>=0.0.47" "ag-ui-protocol>=1.0.0" \
            "langgraph>=1.2.22" "langgraph-checkpoint-postgres>=3.2.1" "psycopg[binary]" psycopg-pool
```

`server.py` ghi đè một số method protected hoặc chưa được tài liệu hóa của `LangGraphAgent` (mục 8). Vì vậy **mỗi lần nâng ag-ui-langgraph phải chạy lại `python selfcheck.py`**. Nếu muốn chắc chắn tuyệt đối, ghim `ag-ui-langgraph==0.0.47`.

### 2.2 Chép package và mount route

1. Chép thư mục `agent/` vào backend, ví dụ thành `app/mentor_agent/`. Mọi import bên trong đều là import tương đối.
2. Trong app FastAPI hiện có, gộp `lifespan` của `server.py` vào lifespan sẵn có. Route `/agent` được đăng ký **bên trong lifespan** vì `AsyncPostgresSaver(...)` gọi `asyncio.get_running_loop()` ngay trong `__init__`, nên phải tạo khi event loop đã chạy (đã kiểm source `langgraph/checkpoint/postgres/aio.py`).

   ```python
   from app.mentor_agent.server import checkpointer_from_env, make_agent, Preflight204
   from app.mentor_agent.graph import build_graph
   from app.mentor_agent.history import get_thread_messages
   from ag_ui_langgraph import add_langgraph_fastapi_endpoint

   @asynccontextmanager
   async def lifespan(app):
       async with checkpointer_from_env() as checkpointer:   # Postgres nếu có MENTOR_CHECKPOINT_DB_URL
           graph = build_graph(checkpointer=checkpointer)
           app.state.graph = graph
           add_langgraph_fastapi_endpoint(app=app, agent=make_agent(graph), path="/agent")
           yield
   ```

3. Thêm `GET /threads/{thread_id}/messages` và `GET /health` (trả `{"ok": true}`) như trong `create_app()`. Nếu backend đã có `/health` thì chỉ cần đảm bảo body có `"ok": true`. Lưu ý `add_langgraph_fastapi_endpoint` còn tự thêm `GET /agent/health`.
4. CORS: hợp đồng yêu cầu preflight trả **204**, trong khi `CORSMiddleware` của Starlette trả **200** (đã kiểm source `starlette/middleware/cors.py`). Hãy thêm `Preflight204` làm middleware **ngoài cùng** (gọi `add_middleware` sau cùng), hoặc thống nhất lại hợp đồng chấp nhận mọi mã 2xx (trình duyệt chấp nhận cả 200 lẫn 204).
5. Body `/agent` sai định dạng: FastAPI mặc định trả 422, còn hợp đồng yêu cầu 400. `create_app()` có handler chỉ đổi mã lỗi cho đúng path `/agent`, các route cũ vẫn giữ 422.
6. Bảo vệ `/agent` và `/threads/*` bằng cơ chế auth sẵn có (JWT nằm ngoài phạm vi MVP), đồng thời kiểm tra session thuộc về user. Context `user` do client gửi lên **không được dùng để phân quyền**.

### 2.3 Checkpointer và thread

- `MENTOR_CHECKPOINT_DB_URL=postgresql://user:pass@host:5432/db`. `checkpointer_from_env()` tạo `AsyncConnectionPool` với `autocommit=True, prepare_threshold=0, row_factory=dict_row` (đúng các tham số mà `AsyncPostgresSaver.from_conn_string` dùng), rồi gọi `await saver.setup()`. Lệnh này idempotent: lần đầu tạo 4 bảng `checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`.
- `thread_id` = `session_uuid` = `threadId` mà frontend gửi lên (là `sessionId` trên URL). `LangGraphAgent` tự đặt `config["configurable"]["thread_id"] = input.thread_id`.
- Nên dùng một database hoặc schema riêng cho checkpoint.

### 2.4 Nối LLM và RAG (các điểm `# TODO` trong `graph.py`)

| Hàm | Input | Output | Ghi chú |
| --- | --- | --- | --- |
| `set_chat_model_factory(f)` | factory trả về `BaseChatModel` hỗ trợ streaming | — | Gọi lúc khởi động. Khi đã có model, `llm_stream_answer` và `code_mentor` (pattern A) dùng model thật |
| `llm_classify_intent` | câu hỏi mới nhất, lịch sử | `"ask" \| "summarize" \| "mindmap" \| "mcq" \| "other"` | structured output, **bắt buộc** dùng `INTERNAL_LLM_CONFIG` |
| `retrieve_chunks` | câu hỏi, `active_document_ids` | `[{file_id, file_name, page, text}]` | vector store của luồng `/upload` |
| `llm_stream_answer` | system prompt, messages, `config` | `AIMessage` | phải truyền `config` của node thì token mới được stream |
| `llm_suggest_followups` | câu hỏi, câu trả lời | tối đa 3 chuỗi | `INTERNAL_LLM_CONFIG` |
| `llm_generate_quiz` | chủ đề, chunks, `count`, `difficulty` | `ShowQuiz` (đúng `count` câu) | `INTERNAL_LLM_CONFIG`, sau đó validate lại và retry |
| `llm_generate_mindmap` | chủ đề, chunks | `ShowMindmap` (sâu tối đa 6 cấp) | `INTERNAL_LLM_CONFIG` |

`INTERNAL_LLM_CONFIG = {"metadata": {"emit-messages": False, "emit-tool-calls": False}}`. ag-ui-langgraph đọc đúng hai khóa metadata này (`agent.py`, nhánh `OnChatModelStream`). Nếu thiếu, token của lời gọi nội bộ sẽ lọt ra chat. Structured output cũng đi qua tool call, nên thiếu config này thì client nhận thêm một tool lạ. `selfcheck.py` đã kiểm cả hai trường hợp.

### 2.5 Router và các node

- Thứ tự ưu tiên: `resume` (LangGraph tự chạy lại node đang interrupt, không đi qua router) → `requested_tools` (`generate-questions` → quiz, `mindmap` → mindmap, chip đầu tiên được nhận) → phân loại intent. `ask` có tài liệu đang bật → `qa_rag`, không có tài liệu → `code_mentor`; `other` → `code_mentor`.
- Mỗi run, `requested_tools`, `active_document_ids` và `user` đều được **ghi đè** từ context. Run không có chip sẽ reset chip của run trước.
- Quiz: `quiz_intro` stream text (hợp đồng 4.6 yêu cầu có text trước interrupt), sau đó `quiz` gọi `interrupt()` **ở dòng đầu tiên**, vì node bị interrupt sẽ chạy lại từ đầu khi resume. Backend thật **luôn** hỏi cấu hình khi intent là MCQ. Mock thì sinh luôn 5 câu với từ khóa "quiz", đây là khác biệt có chủ đích (xem mục 7).

---

## 3. Ánh xạ WebSocket cũ (`/chat/pedagogical`) sang AG-UI

| WS cũ (`role: "bot"`) | AG-UI | Ghi chú |
| --- | --- | --- |
| client gửi `{uuid, content}` | `POST /agent` với `RunAgentInput {threadId, runId, messages, context, state, tools, forwardedProps, resume?}` | Client gửi lại toàn bộ transcript, id giữ nguyên; server merge theo id |
| `info` (session, user info) | không có event tương ứng | `threadId` do client chọn; user lấy từ context `"user"` (mục 4.4) |
| `start` | `RUN_STARTED {threadId, runId}` | |
| `stream` | `TEXT_MESSAGE_START` → `TEXT_MESSAGE_CONTENT` (delta không rỗng) → `TEXT_MESSAGE_END` | Do chat model stream bên trong node |
| `suggest` (JSON list) | tool `suggest_followups {questions}` → `TOOL_CALL_*` + `TOOL_CALL_RESULT "ok"` | |
| `error` (`content`, `error_code`) | `RUN_ERROR {message, code}` | `server.py` thay message bằng câu tiếng Việt chung, code mặc định `AGENT_ERROR`, lỗi gốc ghi vào log |
| `end` | `RUN_FINISHED` | |
| `interrupt` | `RUN_FINISHED.outcome = {type:"interrupt", interrupts:[…]}` | Bật bằng `emit_interrupt_outcome=True`. Client trả lời qua `RunAgentInput.resume` |
| `GET /history-chat/{session}` | `GET /threads/{id}/messages` | Trả cả `toolCalls`, message `tool` và `state` |

Ngoài các event trên, ag-ui-langgraph còn phát `STEP_STARTED`/`STEP_FINISHED` (mỗi node), `MESSAGES_SNAPSHOT` (cuối run), và `CUSTOM` (`manually_emit_state`). Đây đều là event chuẩn AG-UI, client phải bỏ qua được. `make_agent()` tắt `RAW` (`emit_raw_events=False`) và `CUSTOM on_interrupt` (`enable_legacy_on_interrupt_event=False`).

---

## 4. SSE `/sse/notify` cũ sang shared state (`artifacts` / `jobs`, mục 4.7)

| SSE cũ | Thay bằng (ngữ nghĩa RFC 6902) |
| --- | --- |
| `mindmap_done` | `{"op":"add","path":"/artifacts/mindmaps/-","value":{"id":"…","title":"…"}}`, `{"op":"replace","path":"/jobs/<job>/status","value":"done"}`, `{"op":"replace","path":"/jobs/<job>/progress","value":100}` |
| `question_done` | `{"op":"add","path":"/artifacts/quizzes/-","value":{"id":"…","title":"…","count":N}}` cùng job `done` như trên |
| `document_done` | job `kind:"document"` → `done` (4.7 không có artifact cho tài liệu; danh sách file vẫn lấy từ `/session-files`) |
| bắt đầu một job | `{"op":"add","path":"/jobs/<job>","value":{"kind":"quiz","label":"Đang sinh câu hỏi","progress":0,"status":"running"}}` |

**Trên wire, ag-ui-langgraph 0.0.47 chỉ phát `STATE_SNAPSHOT`, không bao giờ phát `STATE_DELTA`.** Trong `agent.py` không có chỗ nào khởi tạo `StateDeltaEvent`, và `get_capabilities()` khai báo `"deltas": False`. Bảng trên mô tả thay đổi về ngữ nghĩa; frontend nhận snapshot đã chứa kết quả, và hợp đồng 4.7 chấp nhận cả hai cách. Snapshot được phát khi rời node có state thay đổi và ở cuối run. Muốn cập nhật giữa chừng một node (progress 0 → 40 → 80 → 100) thì dùng `publish_shared_state(...)`: hàm này phát custom event `manually_emit_state` và được ag-ui-langgraph đổi thành `STATE_SNAPSHOT`. Node vẫn phải **return** cùng giá trị đó để checkpointer lưu lại.

Mindmap không còn đi qua `image_base64`. Dữ liệu cây nằm trong args của `show_mindmap`, còn state chỉ giữ `{id, title}` (không đặt base64 vào state).

---

## 5. Job dài (Kafka / Redis Streams)

AG-UI chỉ đẩy event **trong** một run (một HTTP stream). Không có cơ chế nối lại stream đã đóng, cũng không có kênh push nào nằm ngoài run.

- **Cách đang dùng trong reference:** job chạy ngay trong node, progress được đẩy qua `publish_shared_state`. Cách này đơn giản, nhưng nếu người dùng đóng tab hoặc bấm Dừng thì Starlette sẽ hủy run, và job dở dang bị mất.
- **Khuyến nghị cho job thật (theo `event-driven-architecture.drawio`):**
  1. Node chỉ phát `RoutedEvent` lên bus, ghi `jobs[job_id] = running/0`, stream một câu xác nhận rồi kết thúc run.
  2. Worker (QG / Mind Map module) xử lý xong thì ghi kết quả và trạng thái job vào DB/Redis. **Nguồn sự thật của job nằm ngoài checkpoint.**
  3. Mỗi run mới và mỗi lần gọi `GET /threads/{id}/messages` đều chiếu trạng thái job và artifact từ DB vào state, ví dụ trong `langgraph_default_merge_state` hoặc một node đầu graph. Cách này tránh được lost update: `graph.aupdate_state()` từ worker có thể bị ghi đè bởi một run đang chạy trên cùng thread, vì kênh `jobs` là kênh last-value.
  4. Muốn cập nhật Studio theo thời gian thực mà không cần run mới thì có thể giữ `/sse/notify` để báo "có thay đổi", rồi frontend gọi lại `/threads/{id}/messages` để lấy `state`. Phần frontend này **chưa có** trong MVP.
- `MentorInput` không chứa `artifacts`/`jobs`, nên client không thể ghi đè state do server quản lý: ag-ui-langgraph chỉ chuyển vào graph các khóa nằm trong input schema.

---

## 6. `GET /threads/{id}/messages`

```json
{ "messages": [
    {"id":"u_…","role":"user","content":"tạo quiz"},
    {"id":"msg_…","role":"assistant","content":"Mình sẽ sinh câu hỏi…",
     "toolCalls":[{"id":"call_…","type":"function","function":{"name":"show_quiz","arguments":"{\"title\":…}"}}]},
    {"id":"call_…","role":"tool","toolCallId":"call_…","content":"ok"}],
  "state": {"artifacts":{"quizzes":[{"id":"quiz_…","title":"…","count":3}],"mindmaps":[]},"jobs":{…}} }
```

- Id giữ nguyên như trong checkpoint. Điều này **bắt buộc**: client gửi lại các message này ở run sau, và ag-ui-langgraph merge theo id, nên đổi id sẽ sinh bản sao trong state.
- Thread chưa tồn tại → đúng `{"messages": []}`, không trả 404.
- `selfcheck.py` so sánh id với converter của thư viện (`ag_ui_langgraph.utils.langchain_messages_to_agui`): kết quả trùng khớp.
- Giới hạn của MVP: interrupt đang chờ **không** được khôi phục sau F5. Khi user gõ câu mới, `server.py` hủy interrupt đó rồi trả lời câu mới (mục 8, điều chỉnh 4b).

---

## 7. Chạy contract test `scripts/agui-smoke.mjs` với backend thật

```bash
AGENT_URL=http://<host>:8686/agent node scripts/agui-smoke.mjs --contract-only     # backend thật
node scripts/agui-smoke.mjs http://<host>:8686/agent --contract-only --verbose     # in từng event
```

- `--contract-only` vẫn bắt buộc toàn bộ luật protocol 4.8, HTTP (CORS 204, 400, health, history), schema tool args 4.5, state 4.7, interrupt/resume/steer away. Chỉ những kỳ vọng "theo từ khóa của mock" (bảng 6.D) chuyển thành SKIP.
- Kết quả đã chạy với reference này (`uvicorn agent.server:app --port 8788`, placeholder, in-memory): **PASS 81 · FAIL 0 · WARN 20 · SKIP 20**. Các WARN là event chuẩn nằm ngoài 4.8 (`STEP_*`, `MESSAGES_SNAPSHOT`, `CUSTOM`).
- Chế độ đầy đủ (không có `--contract-only`): **5 FAIL, tất cả đều là kỳ vọng riêng của mock** và nằm trong dự kiến:
  - "lỗi" phải ra `RUN_ERROR`: backend thật không giả lập lỗi.
  - "quiz" phải ra `show_quiz` ngay: backend thật luôn hỏi `quiz_config`.
  - "giải thích đa hình" phải có `$O(1)$`, khối code java và `cite_sources`: khi không bật tài liệu, câu này đi vào `code_mentor`, nên không có trích dẫn.
- Nhớ đặt `MENTOR_CHECKPOINT_DB_URL` khi chạy với Postgres. Chưa đặt thì dữ liệu nằm trong RAM.

---

## 8. Những điều chỉnh của `MentorLangGraphAgent` (đều do lệch hợp đồng đã kiểm được)

| # | Method ghi đè | Hành vi mặc định trong 0.0.47 (đã kiểm) | Hợp đồng | Mức độ ổn định của API |
| --- | --- | --- | --- | --- |
| 1 | `_interrupts_to_agui` | `metadata = {"langgraph": {"raw": <giá trị interrupt>, …}}` (`interrupts.py`) | 4.6: `metadata.kind = "quiz_config"` ở cấp ngoài cùng | Hook protected, **có tài liệu** trong README của package |
| 2 | `get_state_snapshot` | Snapshot gồm mọi khóa của output schema, kể cả `messages` | 4.7: chỉ `{artifacts, jobs}` | Method public, không có tài liệu |
| 3 | `langgraph_default_merge_state` | Context chỉ vào `state["ag-ui"]["context"]` | 4.4: `requested_tools`… vào state; client không ghi được `artifacts`/`jobs`; chặn tool result trùng | Method public, không có tài liệu |
| 4a | `prepare_stream` + `_build_command_from_agui_resume` | Steer away (resume cancelled + user message mới): chỉ tạo `Command(resume=…)`, **message mới bị bỏ**. Graph trả "Đã hủy" và câu hỏi mới không bao giờ được trả lời (đã chạy probe) | 4.6: steer away → xử lý message mới | `_build_command_*` có tài liệu; `prepare_stream` public |
| 4b | như trên | Interrupt đang mở + message mới **không** kèm resume (ví dụ sau F5): phát lại interrupt cũ, `RUN_STARTED → RUN_FINISHED(outcome)`, **không có text**, graph không chạy (đã chạy probe) | 4.6: trước interrupt phải có text | như trên |
| 5 | `run` | `RUN_ERROR.message = str(exc)` (có thể làm lộ chi tiết nội bộ), không có `code` | 4.8: `RUN_ERROR {message, code?}` | Public |

Message được coi là "mới" khi id của nó **chưa có** trong checkpoint của thread (hợp đồng 4.6). Message mới được đưa vào graph qua `Command(resume=…, update={"messages": [...], requested_tools…})`. Node `quiz` thấy message cuối là `HumanMessage` thì route lại về `router`. Trường hợp resolved kèm message mới (client chuẩn không gửi): message vẫn được lưu nhưng nhánh resolved được ưu tiên.

Ngoài ra, có hai chỗ trong `tools.py` cũng xuất phát từ hành vi thật của thư viện:

- **`stream_ui_tool_calls` (pattern B):** UI tool do node tự quyết được phát qua `ScriptedMessageModel`, một chat model stream message dựng sẵn. Nhờ đó tool call đi đúng đường của LLM và có `parentMessageId` (hợp đồng 4.8 yêu cầu). Khi gọi tool trực tiếp (`tool.ainvoke(ToolCall)`) cũng ra đủ START/ARGS/END/RESULT nhưng **thiếu `parentMessageId`**: lần chạy đầu của contract test bị 15 FAIL vì lý do này. Tool call được gắn vào message text của cùng lượt (`attach_to=`), nên text và UI nằm trong **một** assistant message ở cả ba nơi: stream, `MESSAGES_SNAPSHOT` và history.
- **`stable_tool_message_id`:** `TOOL_CALL_RESULT.messageId = tool_msg.id or tool_call_id`, nhưng tool trả về ToolMessage chưa có id, còn `add_messages` lại gán uuid ngẫu nhiên. Client gửi lại id là `tool_call_id`, server không khớp, nên mỗi lượt sinh thêm một tool message trùng. Lỗi này đã tái hiện bằng contract test và bằng negative test trong `selfcheck`. Cách sửa: ghim id = `tool_call_id`, áp dụng cho cả `ToolNode` qua `wrap_tool_call`/`awrap_tool_call`.

---

## 9. Cần xác minh khi port

Mỗi mục ghi rõ đã kiểm đến đâu và còn lại gì.

1. **Chữ ký `add_langgraph_fastapi_endpoint`:** ✅ đã kiểm source `endpoint.py` 0.0.47: `add_langgraph_fastapi_endpoint(app: FastAPI | APIRouter, agent: LangGraphAgent, path: str = "/", **kwargs)`. Phải truyền `agent=LangGraphAgent(...)`, **không** truyền graph. Ví dụ `add_langgraph_fastapi_endpoint(app, graph, "/agent")` trong README của package đã lỗi thời. Hàm clone agent cho mỗi request (`agent.clone()`): subclass không được thêm tham số constructor, và `clone()` giữ nguyên các cờ (đã kiểm). **Còn lại:** kiểm lại khi nâng phiên bản.
2. **Frontend tool được đưa vào graph thế nào:** ✅ source: `RunAgentInput.tools` được merge vào `state["tools"]`, `state["ag-ui"]["tools"]` và `state["copilotkit"]["actions"]` (`langgraph_default_merge_state`). ❓ **Chưa kiểm end-to-end** vì MVP không có frontend tool (`highlight_source` nằm ngoài phạm vi). Hướng làm: bind `state["tools"]` vào LLM; khi LLM gọi frontend tool thì kết thúc run, **không** chạy qua `ToolNode`; client tự thực thi rồi gửi kết quả (message `tool`) ở run sau. Cần một test riêng.
3. **`AIMessage(tool_calls)` do node tự thêm vào state có thành `TOOL_CALL_*` không:** ✅ đã kiểm bằng probe: **không**, nó chỉ xuất hiện trong `MESSAGES_SNAPSHOT` cuối run. Trong 0.0.47 chỉ có ba nguồn sinh `TOOL_CALL_START` (`agent.py`): stream chunk của chat model (có `parentMessageId`), `on_tool_end` của một tool chưa từng được stream (không có `parentMessageId`), và custom event `manually_emit_tool_call` (không có RESULT). Reference dùng nguồn thứ nhất cho cả pattern A lẫn B.
4. **ag-ui-langgraph ánh xạ state sang `STATE_SNAPSHOT`/`STATE_DELTA` thế nào:** ✅ chỉ có snapshot (mục 4). Nội dung mặc định là state đã lọc theo output schema cộng `messages` và `tools`; đã ghi đè để chỉ còn `{artifacts, jobs}`. Snapshot được phát khi rời node có state đổi, khi chuyển subgraph, khi gọi `manually_emit_state`, và ở cuối run (đọc từ checkpoint). ⚠️ Theo source, sau một lần `manually_emit_state`, các snapshot ở cuối node tiếp theo trong **cùng run** dùng lại giá trị đã emit. Vì vậy hãy emit lần cuối đúng bằng giá trị node return (graph đang làm như vậy). Snapshot cuối run lấy từ checkpoint nên luôn đúng.
5. **User message mới khi resume (steer away):** ✅ đã kiểm source `prepare_stream` và chạy probe. Ở nhánh resume, input của graph chỉ là `Command(resume=…)`; danh sách message đã merge chỉ được dùng ở nhánh không resume. Kết quả là user message mới **bị bỏ**. Đã xử lý bằng điều chỉnh 4a/4b. Cơ chế đưa vào là `Command(update=…)`, đã kiểm `langgraph/pregel/_io.py:map_command`, và node `quiz` khi chạy lại **thấy** message mới (`selfcheck`: "steer away … PASS"). ❓ Còn lại: kiểm với `@assistant-ui/react-ag-ui` thật trên trình duyệt (E2E #6).
6. **Args nằm cùng chunk với tên tool bị mất:** ✅ đã quan sát trong 0.0.47. Chunk chứa `name` chỉ sinh ra `TOOL_CALL_START`, phần args trong chunk đó không được phát. OpenAI và Anthropic gửi args rỗng ở chunk đầu nên không bị ảnh hưởng. ❓ Provider stream cả tool call trong một chunk (ví dụ một số cấu hình Gemini) sẽ làm frontend nhận args rỗng cho đến `MESSAGES_SNAPSHOT`. `selfcheck` có kiểm tra "known limitation still present": nếu kiểm tra này FAIL sau khi nâng phiên bản nghĩa là lỗi đã được sửa.
7. **Id của message khi dùng LLM thật:** ❓ reference giả định id chunk khi stream bằng id của `AIMessage` cuối cùng; `ScriptedMessageModel` và fake model đều đúng như vậy. Cần kiểm với provider thật, vì text, `parentMessageId`, snapshot và history phải cùng một id.
8. **Structured output với discriminated union:** ❓ JSON schema của `PresentUI.blocks` sinh ra `oneOf` kèm `discriminator`; chế độ strict của một số provider không hỗ trợ `oneOf`. Nếu bị từ chối thì dùng function calling không strict, sau đó gọi `validate_present_ui()` và retry.
9. **Pattern A với `ToolNode`:** ✅ đã kiểm bằng fake model stream tool chunk: `parentMessageId` = id message text, ARGS là JSON hợp lệ, RESULT `"ok"`, id được lưu khớp. ⚠️ Args do LLM stream tới frontend **trước khi** backend kịp validate. Nếu args sai schema thì `ToolNode` trả error ToolMessage, nên `content` không phải `"ok"`, trong khi renderer frontend vẫn phải chịu được args sai.
10. **Event ngoài 4.8:** `STEP_STARTED`/`STEP_FINISHED`/`MESSAGES_SNAPSHOT`/`CUSTOM` luôn xuất hiện. ❓ Cần E2E xác nhận frontend xử lý `MESSAGES_SNAPSHOT` đúng: đồng bộ id, không nhân đôi message. Server đã có lưới an toàn chặn tool result trùng (điều chỉnh 3), nhưng không chặn được message **text** gửi lên với id khác.
11. **Id của interrupt:** là hash hex của LangGraph, không có tiền tố `int_` như ví dụ trong 4.6. Test không được dựa vào tiền tố này.
12. **Dừng giữa chừng (client ngắt kết nối):** đã đọc source, chưa chạy thử. Với uvicorn 0.54 (ASGI `spec_version` 2.3), `StreamingResponse` của Starlette 1.10 nghe `http.disconnect` rồi hủy cancel scope, nên generator nhận `CancelledError`. `LangGraphAgent.run` cố ý không bắt lỗi này, vì vậy `astream_events` bị hủy theo. Với server khai báo ASGI ≥ 2.4, Starlette chỉ dừng ở lần `send` kế tiếp (gặp `OSError`). Hệ quả: phần text đang stream dở không được checkpoint; ở run sau client gửi lại message dở đó (kèm id của chunk) thì nó mới được thêm vào state. ❓ Cần kiểm trên trình duyệt (E2E #7).
13. **Hạ tầng:** ❓ đặt sau nginx thì cần `proxy_buffering off` (hoặc header `X-Accel-Buffering: no`), nếu không SSE sẽ bị gom lại. Chạy nhiều worker thì cần checkpointer dùng chung (Postgres): đã kiểm resume sau khi "restart" app, xem mục 10.
14. **Import nội bộ:** `ag_ui_langgraph.utils.agui_messages_to_langchain` (dùng trong `server.py`) không có trong `__all__`. Đây chính là converter mà `LangGraphAgent` dùng cho input.
15. **`metadata.documents`** của `quiz_config`: kiểu phần tử chưa được định nghĩa trong 4.6, nên reference đang gửi `[]`.

---

## 10. Đã xác minh (nguồn)

Môi trường: venv tạm (Python 3.12.3) với `ag-ui-langgraph 0.0.47`, `ag-ui-protocol 1.0.0`, `langgraph 1.2.22`, `langgraph-prebuilt 1.1.2`, `langgraph-checkpoint-postgres 3.2.1`, `langchain-core 1.8.2`, `fastapi 0.163.2`, `starlette 1.10.0`, `pydantic 2.14.3`, `uvicorn 0.54.0`, `httpx 0.28.1`, `psycopg 3.3.9`, `psycopg-pool 3.3.3` (PyPI, ngày 2026-11-18).

- **Source đã đọc:** `ag_ui_langgraph/{agent.py, endpoint.py, interrupts.py, utils.py, types.py}`, `ag_ui/_generated/models.py` (`RunAgentInput.resume`, `Interrupt`, `ResumeEntry`, `RunFinishedInterruptOutcome`, `RunErrorEvent.code`, `ToolCallStartEvent.parent_message_id` là optional), `ag_ui/encoder/encoder.py` (`data: <json camelCase>\n\n`, `text/event-stream`), `langgraph/pregel/_io.py` (`map_command`), `langgraph/checkpoint/postgres/aio.py`, `langgraph/prebuilt/tool_node.py` (`wrap_tool_call`), `langchain_core/language_models/chat_models.py` (base class tự gọi `on_llm_new_token`), `starlette/middleware/cors.py` (preflight 200), `starlette/responses.py` + `uvicorn/protocols/http/*` (cách xử lý disconnect).
- **GitHub `ag-ui-protocol/ag-ui@main`, `integrations/langgraph/python`** (`pyproject` version 0.0.47): README (sentinel `__agui_cancelled__` / `__agui_resume_map__`, `emit_interrupt_outcome` opt-in, các hook `_interrupts_to_agui` / `_build_command_from_agui_resume`), `examples/agents/dojo.py` (`add_langgraph_fastapi_endpoint(app=app, agent=LangGraphAgent(...), path=...)`).
- **Chạy thật:** `python selfcheck.py` → 52/52 PASS. `node scripts/agui-smoke.mjs --contract-only` với `uvicorn agent.server:app` → PASS 81 / FAIL 0. Probe với `LangGraphAgent` gốc (không có điều chỉnh 4): steer away → "Đã hủy…" và message mới không vào checkpoint; message mới không kèm resume → `RUN_STARTED, RUN_FINISHED(outcome=interrupt)` và không có text. Probe `AIMessage(tool_calls)` chỉ nằm trong state → không có `TOOL_CALL_*`. Probe Postgres (container `postgres:16` tạm, đã xóa): `setup()` tạo 4 bảng; interrupt ở app #1, resume resolved `{count:3}` ở app #2 (pool mới) → `show_quiz` 3 câu, history và state được giữ.
- **Frontend (đọc để đối chiếu, không sửa):** `node_modules/@assistant-ui/react-ag-ui@0.1.10/dist/runtime/AgUiThreadController.js` (`steerAway` gửi `resume` cancelled cho mọi interrupt đang mở kèm user message mới), `adapter/run-aggregator.js` (khi thiếu `parentMessageId`, tool call được gắn vào assistant message hiện tại).
