# API đã xác minh: assistant-ui + AG-UI (Agent A, Đợt 1)

> Nguồn sự thật số 1 cho B, C2, E2 (luật 1). Mọi dòng dưới đây đều đã được đối chiếu với package **đã cài thật** trong `node_modules`.
> Cập nhật: 2026-11-18, nhánh `feat/agui-mvp`.

## Phiên bản đã cài (ghim chính xác)

| Gói | Phiên bản | Ghi chú |
| --- | --- | --- |
| `@assistant-ui/react` | `0.15.36` | kéo theo `@assistant-ui/core@0.3.36`, `@assistant-ui/store@0.3.23`, `@assistant-ui/tap@0.9.26`, `assistant-stream`, `radix-ui@1.8.1`, `zod@4.6.7` |
| `@assistant-ui/react-ag-ui` | `0.1.10` | kéo theo `@assistant-ui/generative-ui@0.0.11` (dùng chung `@assistant-ui/react@0.15.36`, deduped) |
| `@ag-ui/client` | `1.0.5` | kéo theo `@ag-ui/core@1.0.5` |

`npm ls @assistant-ui/react @assistant-ui/react-ag-ui @ag-ui/client` sạch, không có `invalid` hay `UNMET`. React 18.3.1 thỏa peer `^18 || ^19`.

## Mức độ xác minh

| Ký hiệu | Nghĩa |
| --- | --- |
| ✅ **chạy thật** | Đã chạy trong harness runtime: esbuild bundle **file thật** `src/agent/MentorRuntimeProvider.jsx` + `historyAdapter.js` + `AuthContext.jsx` cùng các snippet ở mục 4, chạy trên jsdom (React 18 StrictMode, bản dev) với một SSE server theo mục 4.3/4.8. Kết quả: `SUMMARY: 66/66 PASS`. Hoặc đã chạy trực tiếp bằng Node (HttpAgent, `fromAgUiMessages`). |
| ✅ **d.ts** | Đã đối chiếu chữ ký trong file `.d.ts` (đường dẫn kèm theo) và đọc source JS tương ứng, nhưng chưa gọi trong harness. |
| ❌ | Sai so với mục 5 của PLAN. Phần sửa ghi ngay cạnh. |

Đường dẫn d.ts viết tắt: `ag-ui/` = `node_modules/@assistant-ui/react-ag-ui/dist/`, `core/` = `node_modules/@assistant-ui/core/dist/`, `store/` = `node_modules/@assistant-ui/store/dist/`, `react/` = `node_modules/@assistant-ui/react/dist/`, `client/` = `node_modules/@ag-ui/client/dist/`.

---

## 0. Tóm tắt các bẫy (đọc trước khi code)

1. **`ErrorPrimitive.Root` luôn render `<div role="alert">`**, kể cả khi message không có lỗi. Muốn khung lỗi chỉ hiện khi có lỗi thì bọc trong `<MessagePrimitive.Error>`. (Đã kiểm.)
2. **`ComposerPrimitive.Send` và `.Cancel` không tự ẩn**: chúng luôn render `<button>`, chỉ bị `disabled`. Muốn "ẩn Gửi, hiện Dừng khi đang chạy" thì bọc bằng `AuiIf`. `Send` là `type="button"` và gửi qua `onClick`, **không** đi qua `onSubmit` của form.
3. **`ThreadPrimitive.ScrollToBottom` không trả về `null`** khi đã ở đáy (skill `thread.md` ghi sai chỗ này): nó render `<button disabled>`. Ẩn bằng class `disabled:hidden` hoặc `disabled:invisible`.
4. **Khi đang có interrupt mở, mọi lần gửi thường đều bị runtime từ chối** (`thread.append`, nút Send, Enter): không có request nào được gửi đi, console in `[assistant-ui] Message append failed Error: [agui] cannot start a new run while interrupts are pending…`. Phải chuyển sang `useAgUiSteerAway()` (snippet 4.2 xử lý cả Enter lẫn nút Gửi).
5. **`useAui().thread.append(...)` trả về `void`**, không phải Promise. Lỗi (nếu có) chỉ hiện ở console.
6. **`useAgUiState()` là `undefined`** cho tới khi có state: `STATE_SNAPSHOT` của một run, **hoặc** `state` trả kèm trong `GET /threads/:id/messages` (mục 4.3 đã cập nhật). Khi history có `state` đúng shape, `historyAdapter.load()` trả `{ ...repo, state }` và runtime nạp nó ngay (đã kiểm: Studio khôi phục sau F5). Backend không trả `state` (hoặc trả sai shape) thì vẫn `undefined` cho tới run kế tiếp. Interrupt đang chờ **không** được khôi phục sau F5 (giới hạn MVP, mục 4.3).
7. `render` trong toolkit được React render như **một component** (`<Render {...part} addResult resume respondToApproval/>`), nên bên trong được gọi hook. Toolkit phải là hằng số ở mức module.
8. Text lỗi trong message là **chuỗi gốc**, có thể là tiếng Anh: `RUN_ERROR.message`, `"Failed to fetch"` (trình duyệt) hoặc `"The connection ended before the answer finished."` (runtime). Muốn hiện tiếng Việt thì truyền children cho `ErrorPrimitive.Message` (snippet 4.1).
9. **Mục 4.9 (đã cập nhật):** không dùng `ui/progress`, `ui/collapsible`, `ui/hover-card`, `ui/tooltip`. Chỉ tái sử dụng `card`, `badge`, `button`, `table`, `skeleton`. Khối thu gọn (Reasoning), thanh tiến độ, popover thì tự viết bằng Tailwind và state.
10. Khi agent server tắt, `@ag-ui/client` tự in `console.error("Agent execution failed: …")`. Đây là log của thư viện, không phải của code mình. Cần tính đến khi so console ở E2E #11.

---

## 1. Đối chiếu từng dòng mục 5 của PLAN

| # | Mảng | Kết quả | Chữ ký thật | Nguồn d.ts | Mức |
| --- | --- | --- | --- | --- | --- |
| 1 | Runtime | ✅ (bổ sung chi tiết) | `useAgUiRuntime(options: UseAgUiRuntimeOptions): AgUiAssistantRuntime`. `UseAgUiRuntimeOptions = ExternalStoreSharedOptions & { agent: AbstractAgent; logger?: Partial<Logger>; showThinking?: boolean; joinStrategy?: JoinStrategy; joinAdjacentAssistantMessages?: boolean; getRunContext?: (input: { messages: readonly Message[]; runConfig: RunConfig \| undefined }) => readonly Context[]; resumeTranscript?: "full" \| "appended"; autoCancelPendingToolCalls?: boolean; unstable_enableMessageQueue?: boolean; onError?: (e: Error) => void; onCancel?: () => void; adapters?: UseAgUiRuntimeAdapters }`. `UseAgUiRuntimeAdapters = { attachments?, speech?, dictation?, voice?, feedback?, history?: ThreadHistoryAdapter, threadList? }`. `ExternalStoreSharedOptions` = `isDisabled`, `isSendDisabled`, `unstable_capabilities`, `suggestions`. | `ag-ui/useAgUiRuntime.d.ts:16`, `ag-ui/runtime/types.d.ts:108-190`, `core/runtimes/external-store/external-store-shared-options.d.ts:2` | ✅ chạy thật (`agent`, `showThinking`, `onError`, `adapters.history`, `getRunContext`) |
| 2 | Hook AG-UI | ✅ | `useAgUiState: <TState = ReadonlyJSONValue>() => TState \| undefined`; `useAgUiSetState: <TState>() => (next: TState \| ((prev: TState \| undefined) => TState)) => void`; `useAgUiInterrupts: () => readonly AgUiInterrupt[]` (rỗng thì trả `[]`, không phải `undefined`); `useAgUiSubmitInterruptResponses: () => (responses: readonly AgUiResumeEntry[]) => Promise<void>`; `useAgUiSteerAway: () => (message: CreateAppendMessage, responses?: readonly AgUiResumeEntry[]) => Promise<void>`; `fromAgUiMessages(messages: readonly unknown[], options?: { showThinking?, joinAdjacentAssistantMessages? }): ThreadMessageLike[]`; `toAgUiMessages(messages: readonly ThreadMessageLike[]): AgUiMessage[]`. Có thêm export `useAgUiSendA2uiAction` (không dùng). | `ag-ui/hooks.d.ts:8-35`, `ag-ui/runtime/adapter/conversions.d.ts:61-86` | ✅ chạy thật (trừ `useAgUiSetState`, `toAgUiMessages`: ✅ d.ts) |
| 3 | Kiểu dữ liệu | ✅ khớp đúng | `AgUiInterrupt = { id: string; reason: AgUiInterruptReason; message?: string; toolCallId?: string; responseSchema?: Record<string, unknown>; expiresAt?: string; metadata?: Record<string, unknown> }`, trong đó `AgUiInterruptReason = "tool_call" \| "input_required" \| "confirmation" \| (string & {})`. `AgUiResumeEntry = { interruptId: string; status: "resolved" \| "cancelled"; payload?: unknown }`. | `ag-ui/runtime/types.d.ts:191-205` | ✅ chạy thật |
| 4 | History | ✅ | `ThreadHistoryAdapter = { load(): Promise<ExportedMessageRepository & { state?: ReadonlyJSONValue; unstable_resume?: boolean }>; append(item: ExportedMessageRepositoryItem): Promise<void>; update?; delete?; … }`. `ExportedMessageRepository.fromArray(messages: readonly ThreadMessageLike[]): ExportedMessageRepository`. Runtime gọi `load()` **một lần** cho mỗi controller (có guard `_loadPromise`, nên StrictMode chạy effect hai lần vẫn chỉ 1 request). Nếu `load()` ném lỗi, runtime gọi `onError`, tức là hiện toast. Vì vậy adapter của mình không bao giờ ném. **Nạp state ban đầu:** field `state` trong kết quả `load()` (không gắn nhãn experimental; chỉ `unstable_resume` có) được `AgUiThreadController.__internal_load` chuyển vào `loadExternalState(repo.state)`, tức dispatch `stateSnapshot`, nên `useAgUiState()` cập nhật ngay. | `core/adapters/thread-history.d.ts:62-99` (dòng 82-86 cho `state?`), `core/runtime/utils/message-repository.d.ts:9-25`, `ag-ui/runtime/AgUiThreadController.js:299-314,1017-1023` | ✅ chạy thật |
| 5 | Tool UI | ✅ | `defineToolkit(def)` ở runtime **trả nguyên object** (`core/react/model-context/define-toolkit.js`). Entry `{ type: "backend", render?: ToolCallMessagePartComponent, renderText?, display?: "inline" \| "standalone" }`. `Tools({ toolkit?: Toolkit, mcpApp? })`, `AuiConfig(config: AuiConfig.Input): AuiConfig`, `<AssistantRuntimeProvider runtime config?: AuiConfig aui?>`. Tool `type: "backend"` **không được upload** lên agent (`RunAgentInput.tools` là `[]`). Render props là `ToolCallMessagePartProps<TArgs, TResult> = MessagePartState & ToolCallMessagePart & { addResult, resume, respondToApproval, unstable_recordInteraction? }`, gồm `type: "tool-call"`, `toolCallId`, `toolName`, `args` (parse dần khi stream), `argsText`, `result?`, `isError?`, `status`, `artifact?`, `timing?`, `interrupt?`, `approval?`, `messages?`. | `core/react/model-context/define-toolkit.d.ts`, `core/react/model-context/toolbox.d.ts:44,63`, `assistant-stream/dist/core/tool/tool-types.d.ts:184`, `core/react/client/Tools.d.ts`, `store/AuiConfig.d.ts:33`, `react/legacy-runtime/AssistantRuntimeProvider.d.ts:24`, `core/react/types/MessagePartComponentTypes.d.ts:36`, `core/types/message.d.ts:279` | ✅ chạy thật |
| 5b | `status` của tool | ✅ (bổ sung) | `ToolCallMessagePartStatus = { type: "running" } \| { type: "complete" } \| { type: "incomplete"; reason: "cancelled" \| "length" \| "content-filter" \| "other" \| "error"; error?: unknown } \| { type: "incomplete"; reason: "tool-calls"; error? } \| { type: "requires-action"; reason: "tool-calls" \| "interrupt" }`. Tool call **có** `TOOL_CALL_RESULT` thì sau run có `status.type === "complete"` và `result === "ok"`. Tool call trong history mà **thiếu** message `role:"tool"` thì được dựng lại thành `requires-action`/`tool-calls`, và lần gửi kế tiếp runtime sẽ tự hủy nó bằng kết quả lỗi (`autoCancelPendingToolCalls`, mặc định `true`). | `core/types/message.d.ts:369-395` | ✅ chạy thật |
| 6 | Thread | ✅, ❌ một chi tiết | `ThreadPrimitive` gồm `Root`, `Viewport`, `ViewportProvider`, `ViewportFooter`, `Messages`, `MessageByIndex`, `Unstable_MessageById`, `Row`, `ScrollToBottom`, `LoadEarlier`, `Suggestion`, `Suggestions`, `SuggestionByIndex`, `Empty` (deprecated), `If` (deprecated). `Messages` nhận `children: ({ message: MessageState }) => ReactNode`. `Viewport` nhận thêm `turnAnchor?: "top" \| "bottom"` (mặc định `"bottom"`), `autoScroll?` (mặc định `true` khi bottom), `scrollToBottomOnRunStart?`, `scrollToBottomOnInitialize?`, `topAnchorMessageClamp?`. ❌ **Sửa:** `ScrollToBottom` **không** trả `null` khi đã ở đáy mà render `<button disabled>`. | `react/primitives/thread.d.ts`, `core/react/primitives/thread/ThreadMessages.d.ts:38-49`, `react/primitives/thread/ThreadViewport.d.ts`, `react/primitives/thread/ThreadScrollToBottom.js` | ✅ chạy thật |
| 7 | Message | ✅, kèm lưu ý | `MessagePrimitive` gồm `Root`, `Parts`, `PartByIndex`, `Content` (alias deprecated), `If` (deprecated), `Attachments`, `AttachmentByIndex`, `Quote`, `Error`, `GroupedParts`, `GenerativeUI`, `Unstable_PartsGrouped`, `Unstable_PartsGroupedByParentId`. `Parts` nhận `children: ({ part: EnrichedPartState }) => ReactNode`. `ErrorPrimitive` gồm `Root` (`<div role="alert">`, **luôn render**) và `Message` (`<span>`, trả `null` khi không có lỗi; có children thì children thay cho text lỗi). `MessagePrimitive.Error` chỉ render children khi message có `status.type === "incomplete"` và `reason === "error"`. | `react/primitives/message.d.ts`, `core/react/primitives/message/MessageParts.d.ts:29-170,226`, `react/primitives/error.d.ts`, `react/primitives/error/ErrorRoot.js`, `react/primitives/error/ErrorMessage.js`, `react/primitives/message/MessageError.js` | ✅ chạy thật |
| 8 | Composer | ✅, kèm lưu ý | `ComposerPrimitive` gồm `Root` (`<form>`, prop thêm `compact?`), `Input` (`<textarea>` của react-textarea-autosize, nên nhận được `minRows`/`maxRows`; `submitMode?: "enter" \| "ctrlEnter" \| "none"`, mặc định `"enter"`, tức Enter gửi và **Shift+Enter xuống dòng**; bỏ qua phím khi đang gõ IME như Telex; `cancelOnEscape?` mặc định `true`; `autoFocus` mặc định `false`), `Send`, `Cancel`, `Resume`, `AddAttachment`, `Attachments`, `AttachmentByIndex`, `AttachmentDropzone`, `Dictate`, `StopDictation`, `DictationTranscript`, `If` (deprecated), `Quote`, `QuoteText`, `QuoteDismiss`, `Queue`, `TriggerPopover…`. `Send` bị disabled khi `!composer.canSend` hoặc khi đang chạy. `Cancel` bị disabled khi `!composer.canCancel`. Cả hai **luôn render** `<button>`. Enter **không** gửi khi thread đang chạy. | `react/primitives/composer.d.ts`, `react/primitives/composer/ComposerInput.d.ts:74`, `react/primitives/composer/ComposerInput.js:80-104`, `core/store/primitive-predicates.js:7-10` | ✅ chạy thật |
| 9 | Gửi message bằng code | ✅ | `useAui(): AssistantClient`; `aui.thread.append(message: CreateAppendMessage): void`, trong đó `CreateAppendMessage = string \| { parentId?, sourceId?, role?, content, attachments?, metadata?, createdAt?, runConfig?, startRun? }`. Scope accessor là **property** (`aui.thread`); kiểu gọi hàm `aui.thread()` đã deprecated. Ngoài ra có `aui.thread.cancelRun()`, `aui.thread.getState()`, `aui.composer.setText(text)`, `aui.composer.getState().text`, `aui.composer.send()`. | `store/useAui.d.ts:63`, `store/types/client.d.ts:132-160`, `core/store/scopes/thread.d.ts:110`, `core/runtime/api/thread-runtime.d.ts:23`, `core/store/scopes/composer.d.ts:75-88` | ✅ chạy thật |
| 10 | Client | ✅ (đã xác minh `threadId`) | `new HttpAgent(config: HttpAgentConfig)`. `HttpAgentConfig extends AgentConfig { url: string; headers?: Record<string, string>; fetch?: (url, init) => Promise<Response> }`. `AgentConfig { agentId?, description?, threadId?, initialMessages?, initialState?, debug?, maxEnforcedEntries? }`. **`threadId` có thật**: runtime gửi `RunAgentInput.threadId = agent.threadId`. Request: `POST url`, header `accept: text/event-stream`, `content-type: application/json`, cộng thêm `headers` mình truyền. | `client/index.d.ts:21-41,310-325` | ✅ chạy thật (Node + harness) |

---

## 2. Bảng import (copy đúng như sau)

```js
// UI primitives và hook trạng thái: tất cả từ "@assistant-ui/react"
import {
  AssistantRuntimeProvider, AuiConfig, AuiIf, Tools, defineToolkit,
  ThreadPrimitive, MessagePrimitive, MessagePartPrimitive, ComposerPrimitive, ErrorPrimitive,
  useAui, useAuiState, ExportedMessageRepository,
} from "@assistant-ui/react";

// Hook riêng của AG-UI
import {
  useAgUiRuntime, useAgUiState, useAgUiSetState, useAgUiInterrupts,
  useAgUiSubmitInterruptResponses, useAgUiSteerAway, fromAgUiMessages, toAgUiMessages,
} from "@assistant-ui/react-ag-ui";

import { HttpAgent } from "@ag-ui/client";
```

`AuiIf`, `AuiConfig`, `useAui`, `useAuiState` được định nghĩa ở `@assistant-ui/store` nhưng **phải import từ `@assistant-ui/react`** (gói này re-export ở `react/index.d.ts:2`). Không cài và không import trực tiếp `@assistant-ui/store`.

Trong app, chỉ A dùng `useAgUiRuntime`, `HttpAgent`, `fromAgUiMessages` và `ExportedMessageRepository` (trong `MentorRuntimeProvider` và `historyAdapter`). B, C2, E2 chỉ cần primitives, `AuiIf`, `useAui`, `useAuiState`, `defineToolkit` và các hook `useAgUi*`.

---

## 3. Kiểu `part` trong `MessagePrimitive.Parts` (`EnrichedPartState`)

| `part.type` | Field dùng được | Ghi chú |
| --- | --- | --- |
| `"text"` | `text: string`, `status?: { type: "running" \| "complete" \| "incomplete", reason? }`, `id?` | ✅ Khi assistant message **chưa có part nào** mà đang chạy, hàm children được gọi **một lần** với part tổng hợp `{ type: "text", text: "", status: { type: "running" } }`. Dùng đúng điều kiện này để hiện "Đang suy nghĩ…" (đã kiểm). |
| `"reasoning"` | `text: string`, `status?`, `timing?` | ✅ Có khi `showThinking: true` (provider đã bật) và agent phát `REASONING_*` (hoặc `THINKING_*`). |
| `"tool-call"` | toàn bộ field ở dòng 5 mục 1, **cộng** `toolUI: ReactNode` (element render của toolkit, hoặc `null` nếu tool chưa đăng ký), `addResult`, `resume`, `respondToApproval` | ✅ Viết `part.toolUI ?? <ToolFallback {...part} />`. Nếu hàm children trả `null` thì UI đã đăng ký **vẫn** được render (fallback mặc định). Muốn chặn hẳn thì trả `<></>`. |
| `"data"` | `name`, `data`, `dataRendererUI` | Không dùng (hợp đồng không phát `CUSTOM`). |
| `"source"`, `"file"`, `"image"`, `"generative-ui"` | | Không dùng. Trả `null`. |

Trạng thái message (đọc qua `useAuiState`): `s.message.role` (`"user" \| "assistant" \| "system"`), `s.message.status` (chỉ có ở assistant: `running \| requires-action \| complete \| incomplete`), `s.message.parts`, `s.message.isLast`, `s.message.index`. Trạng thái thread: `s.thread.isEmpty` (= không có message **và** không đang tải), `s.thread.isLoading` (đang tải history), `s.thread.isRunning`, `s.thread.messages`. Nguồn: `core/store/scopes/thread.d.ts:12-70`.

Selector của `useAuiState`/`AuiIf` phải trả **giá trị nguyên thủy hoặc tham chiếu ổn định**. Không trả object hay array literal (sẽ re-render liên tục), không trả nguyên `s` (sẽ throw).

---

## 4. Snippet JSX đã kiểm

Các snippet dưới đây giống hệt `harness/app.jsx` và `harness/toolkit-test.jsx` trong scratchpad của A, và đã chạy với provider thật (66/66 PASS). B, C2, E2 chỉ cần đổi class/style theo mục 4.9 và thay các component trình bày bằng component thật (MarkdownText, Reasoning, ToolFallback…). `data-testid` chỉ để test, có thể bỏ.

### 4.1 Thread, Messages, Parts (text, reasoning, tool-call) và lỗi (B)

```jsx
import { AuiIf, ErrorPrimitive, MessagePrimitive, ThreadPrimitive, useAui } from "@assistant-ui/react";

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts>
        {({ part }) => (part.type === "text" ? <p>{part.text}</p> : null)}
      </MessagePrimitive.Parts>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === "text") {
            // part tổng hợp lúc chưa có token đầu tiên
            if (part.status?.type === "running" && part.text === "") return <span>Đang suy nghĩ…</span>;
            return <MarkdownText text={part.text} />;
          }
          if (part.type === "reasoning") return <Reasoning text={part.text} />; // tự viết, KHÔNG dùng ui/collapsible
          if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
          return null;
        }}
      </MessagePrimitive.Parts>
      {/* ErrorPrimitive.Root luôn render, nên bọc trong MessagePrimitive.Error */}
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="mt-2 rounded-[8px] border border-[#E3E1DC] p-2 text-sm text-error-red">
          <ErrorPrimitive.Message />
          {/* hoặc Việt hóa: <ErrorPrimitive.Message>Trợ lý gặp lỗi, vui lòng thử lại.</ErrorPrimitive.Message> */}
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

function SuggestionButton({ text }) {
  const aui = useAui();
  return (
    <button type="button" onClick={() => aui.thread.append({ role: "user", content: [{ type: "text", text }] })}>
      {text}
    </button>
  );
}

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport turnAnchor="bottom" className="flex-1 overflow-y-auto">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <div>👋 Chào …! <SuggestionButton text="Giải thích đa hình" /></div>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isLoading}>
          <div>Đang tải lịch sử…</div>
        </AuiIf>
        <ThreadPrimitive.Messages>
          {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
        </ThreadPrimitive.Messages>
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 bg-white">
          <InterruptPanel />
          <Composer />
          <ThreadPrimitive.ScrollToBottom className="disabled:hidden">↓</ThreadPrimitive.ScrollToBottom>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
```

Đã kiểm: welcome hiện khi thread rỗng; text, reasoning, tool UI của toolkit và fallback cho tool lạ đều render đúng; `ErrorPrimitive.Message` hiện đúng `RUN_ERROR.message` ("Mô phỏng lỗi từ agent") và có `role="alert"`; chỉ báo "Đang suy nghĩ…" hiện trước token đầu tiên; `ScrollToBottom` là `<button disabled>` khi ở đáy.

### 4.2 Composer: Enter, Gửi/Dừng, và gửi khi đang có interrupt (B)

```jsx
import { AuiIf, ComposerPrimitive, useAui } from "@assistant-ui/react";
import { useAgUiInterrupts, useAgUiSteerAway } from "@assistant-ui/react-ag-ui";

// Khi interrupt đang mở, gửi thường sẽ bị runtime từ chối, nên chuyển sang steer away (mục 4.6).
function useSteerAwareSubmit() {
  const aui = useAui();
  const interrupts = useAgUiInterrupts();
  const steerAway = useAgUiSteerAway();
  return (event) => {
    if (interrupts.length === 0) return;      // để ComposerPrimitive tự gửi như bình thường
    event.preventDefault();                    // chặn handler gửi mặc định (composeEventHandlers)
    const text = aui.composer.getState().text.trim();
    if (!text) return;
    aui.composer.setText("");
    steerAway(text).catch((e) => { /* hiện lỗi, không để unhandled */ });
  };
}

function Composer() {
  const steerAwareSubmit = useSteerAwareSubmit();
  return (
    <ComposerPrimitive.Root onSubmit={steerAwareSubmit}>          {/* đường Enter */}
      <ComposerPrimitive.Input placeholder="Hỏi bất cứ điều gì…" maxRows={6} />
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send onClick={steerAwareSubmit}>Gửi</ComposerPrimitive.Send>  {/* đường nút */}
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel>Dừng</ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
  );
}
```

Đã kiểm: Enter gửi đúng 1 request (StrictMode); Shift+Enter không gửi (theo source `ComposerInput.js:94`); khi đang chạy thì nút Dừng hiện, nút Gửi ẩn; bấm Dừng thì stream HTTP bị đóng (server thấy client ngắt), không có toast, và gửi tiếp được ngay; khi interrupt đang mở, cả Enter lẫn nút Gửi đều đi qua `steerAway`, body gửi lên có `resume: [{ interruptId, status: "cancelled" }]` kèm user message mới, composer được xóa trắng và panel interrupt đóng lại. Không cần tự bắt phím.

### 4.3 InterruptPanel (B)

```jsx
import { useState } from "react";
import { useAgUiInterrupts, useAgUiSubmitInterruptResponses } from "@assistant-ui/react-ag-ui";

export default function InterruptPanel() {
  const interrupts = useAgUiInterrupts();            // readonly AgUiInterrupt[], rỗng thì là []
  const submit = useAgUiSubmitInterruptResponses();  // hàm mới ở mỗi render: KHÔNG đưa vào deps
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  if (interrupts.length === 0) return null;

  // entries phải phủ HẾT các interrupt đang mở
  const answer = async (status, payload) => {
    setPending(true);
    setError(null);
    try {
      await submit(interrupts.map((i) => ({ interruptId: i.id, status, ...(status === "resolved" ? { payload } : {}) })));
    } catch (e) {
      setError(e?.message ?? String(e));  // reject khi: thiếu/thừa/trùng id, interrupt hết hạn, đang có run khác chạy
    } finally {
      setPending(false);
    }
  };

  const first = interrupts[0];
  if (first.metadata?.kind === "quiz_config") {
    const defaults = first.metadata?.defaults ?? {}; // { count: 10, difficulty: "medium" }
    // … form chọn count (5/10/15) và difficulty, khởi tạo từ defaults
    return (
      <div>
        <p>{first.message}</p>
        <button disabled={pending} onClick={() => answer("resolved", { count: defaults.count ?? 10, difficulty: defaults.difficulty ?? "medium" })}>Sinh câu hỏi</button>
        <button disabled={pending} onClick={() => answer("cancelled")}>Hủy</button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }
  return null; // interrupt loại khác: hiện first.message cùng Đồng ý / Hủy
}
```

Đã kiểm: `metadata.kind === "quiz_config"`, `message` và `defaults` đọc được đúng như payload; resolved thì body gửi `resume: [{ interruptId: "int_…", status: "resolved", payload: { count: 3, difficulty: "hard" } }]`, cùng threadId, kèm toàn bộ transcript, rồi QuizCard nhận đúng 3 câu và state delta được áp; cancelled thì body gửi `resume: [{ status: "cancelled" }]` **không kèm** user message mới (id user cuối giữ nguyên), assistant trả lời "Đã hủy sinh câu hỏi.". Panel tự đóng sau khi trả lời.

### 4.4 Toolkit plain và FollowUps dùng `useAui().thread.append` (C2)

```jsx
// src/agent/toolkit.jsx (KHÔNG có "use generative", KHÔNG cần compiler)
import { defineToolkit, useAui, useAuiState } from "@assistant-ui/react";
import ToolErrorBoundary from "@/agent/tools/ToolErrorBoundary";
import QuizCard from "@/agent/tools/QuizCard";
import FollowUps from "@/agent/tools/FollowUps";

// render được React mount như một component: được dùng hook bên trong
function FollowUpsTool(props) {
  const aui = useAui();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return (
    <FollowUps
      {...props}
      disabled={isRunning}
      onSelect={(q) => aui.thread.append({ role: "user", content: [{ type: "text", text: q }] })}
    />
  );
}

export const mentorToolkit = defineToolkit({  // hằng số mức module: tham chiếu ổn định
  show_quiz: {
    type: "backend",
    render: (p) => (
      <ToolErrorBoundary toolName="show_quiz">
        <QuizCard {...p} />
      </ToolErrorBoundary>
    ),
  },
  suggest_followups: {
    type: "backend",
    render: (p) => (
      <ToolErrorBoundary toolName="suggest_followups">
        <FollowUpsTool {...p} />
      </ToolErrorBoundary>
    ),
  },
  // show_mindmap, cite_sources, present_ui: cùng mẫu
});
```

Đã kiểm: `cite_sources` và `show_quiz` render qua `part.toolUI` với `args` đã parse từ các delta JSON, `status.type === "complete"`, `result === "ok"`, `toolName`/`toolCallId` đúng; tool không đăng ký thì `toolUI === null` và rơi về fallback; nút follow-up gọi `aui.thread.append(...)` sinh đúng 1 run với text đó; sau F5, tool UI được dựng lại từ history (QuizCard `OOP|3`, `status: complete`). `render: (p) => <X {...p}/>` và `render: Component` đều chạy. Props mà `render` nhận: toàn bộ field của part (`args`, `argsText`, `result`, `isError`, `status`, `toolName`, `toolCallId`, …) cộng `addResult`, `resume`, `respondToApproval`. Component C1 nhận `{ args, result, status }` thì cứ spread `{...p}`.

### 4.5 State Studio (E2)

```jsx
import { useAgUiState } from "@assistant-ui/react-ag-ui";

const EMPTY = { artifacts: { quizzes: [], mindmaps: [] }, jobs: {} };

export function useMentorState() {
  const state = useAgUiState();                    // undefined trước STATE_SNAPSHOT đầu tiên và sau F5
  const raw = state && typeof state === "object" ? state : EMPTY;
  // … kiểm từng field: Array.isArray(raw.artifacts?.quizzes) ? … : [], jobs là object thường, v.v.
  // Nên useMemo theo `state` để giữ tham chiếu ổn định.
}
```

Đã kiểm: `useAgUiState()` là `undefined` trước run đầu (thread mới), `{ artifacts: { quizzes: [] }, … }` sau `STATE_SNAPSHOT`, và cập nhật ngay khi có `STATE_DELTA` `add /artifacts/quizzes/-` (component re-render: số quiz đổi 0 rồi 1). Sau remount (F5), nếu `GET /threads/:id/messages` trả `state` thì state được khôi phục ngay (quiz vẫn là 1). Nếu không có `state` thì về `undefined`, nên `useMentorState` phải luôn có mặc định. Hook này chỉ dùng được **bên trong** `MentorRuntimeProvider`.

### 4.6 Dùng `MentorRuntimeProvider` (B, trong SessionPage)

```jsx
import { useRef, useState, useCallback } from "react";
import MentorRuntimeProvider from "@/agent/MentorRuntimeProvider";

const [newId] = useState(() => crypto.randomUUID());
const threadId = sessionId ?? newId;
const toolsRef = useRef([]); // ["generate-questions" | "mindmap"]
const getExtraContext = useCallback(() => [
  { description: "requested_tools", value: JSON.stringify(toolsRef.current) },
  { description: "active_document_ids", value: JSON.stringify([]) },
], []);

<MentorRuntimeProvider threadId={threadId} getExtraContext={getExtraContext}>
  {/* cả layout 3 cột */}
</MentorRuntimeProvider>
```

Hành vi đã kiểm của provider (file `src/agent/MentorRuntimeProvider.jsx`):
- Gửi `context = [userCtx, ...getExtraContext()]`, với `userCtx = { description: "user", value: JSON.stringify({ user_id, user_name }) }` lấy từ `useAuth().user`. Mọi `value` được ép về string: nếu B lỡ truyền mảng thì provider `JSON.stringify` giùm. Entry thiếu `description` dạng string bị bỏ. `getExtraContext` ném lỗi thì chỉ `console.warn`, run vẫn chạy.
- `getExtraContext` được gọi **lúc gửi mỗi run**, nên đọc ref thì luôn lấy giá trị mới nhất. Không cần đổi identity hàm.
- **Đổi `threadId` thì toàn bộ children được mount lại** (`key={threadId}`): history của thread mới được tải lại, message cũ không bị lẫn. Không đặt state cần giữ qua lần đổi thread vào bên trong provider.
- StrictMode: lúc mount có đúng 1 `GET /threads/:id/messages` và 0 `POST`; mỗi lần gửi đúng 1 `POST`.
- `onError`: toast id cố định `"agent-error"` (lỗi liên tiếp không chồng toast). Lỗi mạng hiện "Không kết nối được tới trợ lý"; lỗi khác hiện "Trợ lý gặp lỗi khi trả lời" với description là message gốc. Bấm Dừng **không** gọi `onError`.
- History: lỗi mạng, timeout 10 giây, HTTP khác 2xx, JSON hỏng đều dẫn tới `console.warn("[agui] Không tải được lịch sử hội thoại …")` và repository rỗng. Không ném lỗi, không toast.
- State khôi phục: `state` trong response history được nạp khi là object có `artifacts` và `jobs` đều là object (không phải array). Thiếu hoặc `null` thì bỏ qua lặng lẽ; sai shape thì bỏ qua kèm `console.warn("[agui] Bỏ qua state khôi phục sai shape …")`. Message vẫn được nạp bình thường.

### 4.7 Cấu hình HttpAgent và runtime (chỉ A dùng, để tham khảo)

```jsx
const agent = useMemo(() => new HttpAgent({ url: AGENT_URL, threadId }), [threadId]);
const adapters = useMemo(() => ({ history: createHistoryAdapter(threadId) }), [threadId]);
const runtime = useAgUiRuntime({ agent, showThinking: true, onError: notifyAgentError, adapters, getRunContext });
const auiConfig = useMemo(() => AuiConfig({ tools: Tools({ toolkit: mentorToolkit }) }), []);
return <AssistantRuntimeProvider runtime={runtime} config={auiConfig}>{children}</AssistantRuntimeProvider>;
```

---

## 5. Hành vi trên dây đã quan sát (cho D, E1, F)

Đo bằng harness với client thật (`HttpAgent` qua `useAgUiRuntime`) và bằng `HttpAgent.runAgent` chạy trực tiếp trong Node:

| Điểm | Giá trị thật |
| --- | --- |
| Key của body | `context, forwardedProps, messages, protocolVersion, runId, state, threadId, tools`, thêm `resume` khi trả lời interrupt hoặc steer away. **`protocolVersion` không có trong danh sách mục 4.3**: server phải chấp nhận field thừa. |
| `tools` | `[]` (tool `type: "backend"` không được upload) |
| `state` | `{}` khi client chưa biết state nào. Sau đó runtime **gửi lại state cuối cùng nó biết** (từ `STATE_SNAPSHOT`/`STATE_DELTA`, hoặc từ `state` của history sau F5). Đã kiểm: POST đầu tiên sau F5 mang `state.artifacts.quizzes.length === 1`. Server nên coi state mình đã lưu là nguồn chính. |
| `forwardedProps` | `{}` |
| `context` | `[{ description: "user", value: "{\"user_id\":42,\"user_name\":\"Hùng\"}" }, { description: "requested_tools", value: "[\"mindmap\"]" }, { description: "active_document_ids", value: "[]" }]` |
| User message gửi lên | `{ id: "<7 ký tự>", role: "user", content: "xin chào" }`: **`content` là string** (text thuần) |
| Transcript gửi lại | Mỗi run gửi **toàn bộ** transcript (`resumeTranscript` mặc định `"full"`), gồm cả `role:"reasoning"`, assistant có `toolCalls`, và message `role:"tool"`. **Id được giữ nguyên** giữa các run. Id của assistant message = `messageId` mà server phát trong `TEXT_MESSAGE_START` (không phải id do client tự sinh). |
| Steer away | `resume: [{ interruptId, status: "cancelled" }]` kèm **một user message có id mới** ở cuối `messages` (khớp mục 4.6) |
| Hủy interrupt | `resume: [{ interruptId, status: "cancelled" }]`, **không** có user message mới (user cuối giữ nguyên id) |
| Resolved | `resume: [{ interruptId, status: "resolved", payload: { count, difficulty } }]` |
| Bấm Dừng | Client abort fetch, server nhận `close` trên request |
| Interrupt | `RUN_FINISHED.outcome = { type: "interrupt", interrupts: [...] }`, đặt ngay sau một assistant text message (mục 4.6), được nhận đúng |
| Reasoning | `REASONING_START {messageId}` → `REASONING_MESSAGE_START {messageId, role:"reasoning"}` → `REASONING_MESSAGE_CONTENT {messageId, delta}` → `REASONING_MESSAGE_END` → `REASONING_END` render thành part `reasoning` |
| History (`GET /threads/:id/messages`) | `fromAgUiMessages` gộp message `role:"tool"` vào `result` của tool-call tương ứng. Thiếu message tool thì message đó thành `requires-action`. `{ "messages": [] }` cho ra repository rỗng. `state` (tùy chọn, shape mục 4.7) được nạp làm state ban đầu. |

---

## 6. Lưu ý riêng cho từng agent

**B**
- Áp dụng bẫy 1–6 và 8–10 ở mục 0. Composer theo snippet 4.2 (cần cả `onSubmit` của Root **và** `onClick` của Send).
- `Reasoning.jsx`: tự viết khối thu gọn bằng `useState` (mặc định đóng), không dùng `ui/collapsible`.
- Chip follow-up và gợi ý: nên disable khi `useAuiState((s) => s.thread.isRunning)` là true. Nếu interrupt đang mở thì gợi ý cũng nên đi qua `steerAway`.
- `useAgUiSubmitInterruptResponses()` và `useAgUiSteerAway()` trả hàm mới ở mỗi render: gọi trực tiếp trong handler, không đưa vào deps của `useEffect`/`useCallback`.
- `s.thread.isEmpty` là false trong lúc tải history (`isLoading`). Muốn hiện skeleton thì dùng `AuiIf s.thread.isLoading`.
- Muốn biết interrupt đang mở ở ngoài panel thì dùng `useAgUiInterrupts().length > 0`.

**C2**
- Theo snippet 4.4. Không dùng `makeAssistantToolUI` (deprecated), không thêm `"use generative"`.
- Renderer có thể nhận `status.type === "requires-action"` (tool call từ history không có kết quả) hoặc `"incomplete"` (run bị hủy hoặc lỗi giữa chừng). Phải render được với args dở, không ném lỗi.
- Không dùng `ui/hover-card`/`ui/tooltip` cho SourceCitation (mục 4.9). Popover tự viết.

**E2**
- Theo snippet 4.5. Không dùng `ui/progress` (mục 4.9), thanh tiến độ tự viết bằng div.
- Sau F5, Studio được khôi phục **nếu** backend trả `state` trong history (mock của D cần trả field này). Nếu không có thì trống cho tới run kế tiếp. Không cần code thêm gì ở E2: chỉ đọc `useAgUiState()`.

**D / E1 / F**: xem mục 5. Điểm cần chú ý nhất: body có `protocolVersion`; user `content` là string; transcript gửi lại có id ổn định, có cả message `reasoning` và `tool`; id assistant = `messageId` của server.

---

## 7. Danh sách export thật (lệnh `node --input-type=module -e "import('<pkg>')…"`)

- `@assistant-ui/react-ag-ui` (9): `fromAgUiMessages, toAgUiMessages, useAgUiInterrupts, useAgUiRuntime, useAgUiSendA2uiAction, useAgUiSetState, useAgUiState, useAgUiSteerAway, useAgUiSubmitInterruptResponses`.
- `@ag-ui/client` (47), các tên liên quan: `HttpAgent, AbstractAgent, EventType, verifyEvents, parseSSEStream, randomUUID, AGUIError, PROTOCOL_VERSION, buildResumeArray, getRunOutcome, isInterruptExpired`, …
- `@assistant-ui/react` (169), các tên liên quan: `AssistantRuntimeProvider, AuiConfig, AuiIf, AuiProvider, Tools, defineToolkit, ThreadPrimitive, MessagePrimitive, MessagePartPrimitive, ComposerPrimitive, ErrorPrimitive, ExportedMessageRepository, useAui, useAuiState, useAuiEvent, useToolArgsStatus, useInlineRender, makeAssistantToolUI` (deprecated), `useMessagePartText` (deprecated), …

Cả ba gói đều import được trong Node (ESM), không cần đọc d.ts thay thế.

---

## 8. Sai khác so với PLAN và điểm orchestrator cần biết

- ❌ Mục 5, dòng Thread (chi tiết): `ScrollToBottom` không trả `null` mà render `<button disabled>`. Không đổi API, chỉ cần style `disabled:hidden`.
- Bổ sung cho mục 5, dòng Message: `ErrorPrimitive.Root` luôn render, nên phải bọc bằng `MessagePrimitive.Error`.
- Bổ sung cho mục 5, dòng Composer: Send/Cancel không tự ẩn; gửi khi interrupt đang mở bị từ chối, phải dùng steer away (snippet 4.2).
- Bổ sung cho mục 4.3: body có thêm `protocolVersion`.
- Mục 4.3 đã cập nhật (`state?` trong response history): **đã cài** bằng đường chính thức `ThreadHistoryAdapter.load() → { ...repo, state }`, được runtime nạp qua `loadExternalState`. Kết quả xác minh các phương án khác:
  - `AgentConfig.initialState`: ❌ không dùng được. Runtime chỉ đọc nó khi tạo controller hoặc khi đổi agent mà chưa có state (`getAgentInitialState` trong `AgUiThreadController.js:193,240-249`), trong khi history về **sau** khi agent đã được tạo.
  - `agent.setState(...)`/gán `agent.state`: ❌ runtime ghi đè `agent.state` bằng state của nó mỗi lần chạy (`AgUiThreadController.js:1573-1575`), không phải nguồn của `useAgUiState`.
  - `useAgUiSetState()`: ✅ d.ts/source cho thấy nó cập nhật `useAgUiState` ngay (dispatch `stateSnapshot`, `AgUiThreadController.js:1024-1031`) và gửi lên ở run sau. Đây là API "optimistic update", nên không dùng cho việc khôi phục khi đã có đường qua history.

## 9. Bằng chứng và cách chạy lại

- Harness: `/tmp/claude-1000/-home-hungmanh-Documents-mentor-code-ui/e5ce72ba-1982-4234-a033-1fe43930c343/scratchpad/A/harness/run.mjs` (cùng `app.jsx`, `toolkit-test.jsx`, `sonner-spy.js`). jsdom@25.0.1 được cài riêng ở `…/scratchpad/A/tools`, không đụng `package.json` của repo. Chạy: `node …/scratchpad/A/harness/run.mjs /home/hungmanh/Documents/mentor-code-ui`, kết quả `SUMMARY: 66/66 PASS`, exit 0. Lưu ý: scratchpad có thể bị dọn.
- History: `…/scratchpad/A/harness/verify-history.mjs`. Kết quả: tool message được gộp vào `result`, tool call không có kết quả thành `requires-action`, history rỗng cho `{"messages":[]}`.
