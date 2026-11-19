import { Component } from "react";
import {
    AuiIf,
    ComposerPrimitive,
    ErrorPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useAui,
    useAuiState,
} from "@assistant-ui/react";
import { useAgUiInterrupts, useAgUiSteerAway } from "@assistant-ui/react-ag-ui";
import { ArrowDown, SendHorizontal, Square } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { SkeletonLines } from "@/agent/catalog/parts";
import ToolErrorBoundary from "@/agent/tools/ToolErrorBoundary";
import ToolFallback from "@/agent/tools/ToolFallback";
import InterruptPanel from "@/agent/tools/InterruptPanel";
import MarkdownText from "@/agent/thread/MarkdownText";
import Reasoning from "@/agent/thread/Reasoning";
import ToolChips from "@/agent/thread/ToolChips";
import { friendlyAgentError } from "@/agent/errors";

// Chat thread built from assistant-ui primitives (PLAN 6.B.1, API.md 4.1–4.2).
// Must be rendered inside MentorRuntimeProvider.
//
// Layout note: src/assets/css/cusstom.css has a global `.flex>div:nth-child(1)` rule
// (overflow:hidden, white-space:normal) that beats Tailwind utilities on specificity.
// Containers here therefore use `grid` (or block) wherever their first child is a <div>
// whose overflow/white-space matters (scroll viewport, user bubble, popovers inside tool UIs).

const SUGGESTIONS = [
    "Giải thích đa hình trong Java",
    "Tạo quiz về lập trình hướng đối tượng",
    "So sánh abstract class và interface",
];


// Same extraction as assistant-ui's ErrorPrimitive.Message (primitive-predicates `messageErrorText`),
// but returns a primitive so it is a stable useAuiState selector.
function selectErrorText(s) {
    const status = s.message.status;
    if (status?.type !== "incomplete" || status.reason !== "error") return "";
    const error = status.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && typeof error.message === "string") return error.message;
    return "";
}

function friendlyError(raw) {
    return friendlyAgentError(raw).message;
}

// "[agui] …" errors are thrown by the runtime BEFORE the message is appended (e.g. a run is still
// in progress). Anything else comes from the run itself and was already reported by onError.
function isRejectedBeforeSend(error) {
    return typeof error?.message === "string" && error.message.startsWith("[agui]");
}

function notifySendRejected(error) {
    toast.error("Không gửi được tin nhắn", {
        id: "agent-error",
        description: friendlyAgentError(typeof error?.message === "string" ? error.message : "").message,
    });
}

// Sends a user message. While an interrupt is pending, a plain append is silently rejected by the
// runtime (API.md trap 4), so the message goes through steer-away instead (PLAN 4.6).
function useSendText() {
    const aui = useAui();
    const interrupts = useAgUiInterrupts();
    const steerAway = useAgUiSteerAway(); // new function every render: call it, never memoize
    return (text) => {
        const value = typeof text === "string" ? text.trim() : "";
        if (!value) return;
        if (interrupts.length > 0) {
            steerAway(value).catch((error) => {
                if (isRejectedBeforeSend(error)) notifySendRejected(error);
            });
            return;
        }
        aui.thread.append({ role: "user", content: [{ type: "text", text: value }] });
    };
}

// Last line of defence: one message that fails to render must not unmount the whole page.
class MessageBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error("[agui] Không hiển thị được tin nhắn", error);
    }

    render() {
        if (this.state.failed) {
            return (
                <p role="alert" className="text-[12.5px] italic text-[#7C9499]">
                    Không hiển thị được tin nhắn này.
                </p>
            );
        }
        return this.props.children ?? null;
    }
}

function Welcome() {
    const { user } = useAuth();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const send = useSendText();
    const name = typeof user?.user_name === "string" && user.user_name.trim() ? user.user_name.trim() : "bạn";

    return (
        <div className="grid gap-4 pt-6">
            <div className="grid gap-1">
                <p className="font-urbanist text-[20px] font-semibold leading-tight text-[#002B31]">
                    👋 Chào {name}!
                </p>
                <p className="text-[14px] text-[#46595D]">Hỏi mình bất cứ điều gì về lập trình.</p>
            </div>
            <div className="grid gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#7C9499]">Gợi ý</span>
                <div className="grid justify-items-start gap-2">
                    {SUGGESTIONS.map((text) => (
                        <button
                            key={text}
                            type="button"
                            disabled={isRunning}
                            onClick={() => send(text)}
                            className="rounded-full border border-[#DDE3E5] bg-white px-3 py-1.5 text-left text-[12.5px] text-[#2E5A6E] hover:bg-[#F1F5F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function HistoryLoading() {
    return (
        <div className="grid gap-3 pt-6" aria-busy="true">
            <span className="text-[12.5px] text-[#7C9499]">Đang tải lịch sử hội thoại…</span>
            <SkeletonLines lines={4} className="max-w-[320px]" />
        </div>
    );
}

function ThinkingIndicator() {
    return (
        <div role="status" className="grid grid-flow-col items-center justify-start gap-2 py-1 text-[13px] text-[#7C9499]">
            <span className="grid grid-flow-col gap-1" aria-hidden="true">
                <span className="size-1.5 animate-bounce rounded-full bg-[#2E5A6E] [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#2E5A6E] [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#2E5A6E]" />
            </span>
            <span>Đang suy nghĩ…</span>
        </div>
    );
}

function UserMessage() {
    return (
        <MessagePrimitive.Root className="grid justify-items-end">
            <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[13px_13px_3px_13px] bg-primary-blue/10 px-4 py-2.5 text-[14px] leading-[1.55] text-[#002B31]">
                <MessagePrimitive.Parts>
                    {({ part }) => (part.type === "text" ? part.text : null)}
                </MessagePrimitive.Parts>
            </div>
        </MessagePrimitive.Root>
    );
}

// Renders one part of an assistant message (PLAN 5, API.md 3). Unknown part types render nothing.
function renderAssistantPart({ part }) {
    switch (part?.type) {
        case "text":
            // Synthetic part while the message has no content yet (API.md 3), or an empty text part
            // that has just been opened: show the thinking indicator.
            if (part.status?.type === "running" && !part.text) return <ThinkingIndicator />;
            return <MarkdownText text={part.text} />;
        case "reasoning":
            return <Reasoning text={part.text} status={part.status} />;
        case "tool-call":
            return (
                part.toolUI ?? (
                    <ToolErrorBoundary toolName={part.toolName}>
                        <ToolFallback {...part} />
                    </ToolErrorBoundary>
                )
            );
        case "data":
            return part.dataRendererUI ?? null;
        default:
            return null;
    }
}

function MessageError() {
    const raw = useAuiState(selectErrorText);
    return (
        <MessagePrimitive.Error>
            <ErrorPrimitive.Root className="grid gap-0.5 rounded-[8px] border border-error-red/30 bg-error-red/5 px-3 py-2 text-[13px]">
                <span className="font-semibold text-error-red">Trợ lý gặp lỗi khi trả lời.</span>
                <ErrorPrimitive.Message className="break-words text-[12.5px] text-[#46595D]">
                    {friendlyError(raw)}
                </ErrorPrimitive.Message>
            </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
    );
}

function AssistantMessage() {
    return (
        <MessagePrimitive.Root className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
            <span
                className="grid size-7 place-items-center rounded-[8px] bg-[#2E5A6E]"
                aria-label="Trợ lý"
                role="img"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 6 3.5 12 8 18" />
                    <path d="m16 6 4.5 6L16 18" />
                </svg>
            </span>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 pt-0.5">
                <MessageBoundary>
                    <MessagePrimitive.Parts>{renderAssistantPart}</MessagePrimitive.Parts>
                </MessageBoundary>
                <MessageError />
                <AuiIf
                    condition={(s) => s.message.status?.type === "incomplete" && s.message.status.reason === "cancelled"}
                >
                    <span className="text-[12px] italic text-[#8FA3A7]">Đã dừng.</span>
                </AuiIf>
            </div>
        </MessagePrimitive.Root>
    );
}

function Composer({ selectedTools, onToolsChange }) {
    const aui = useAui();
    const interrupts = useAgUiInterrupts();
    const steerAway = useAgUiSteerAway(); // new function every render: call it, never memoize
    const hasInterrupt = interrupts.length > 0;

    // Enter (form submit) and the Send button both land here. Without a pending interrupt the
    // default ComposerPrimitive handler sends; with one, preventDefault() skips it and the text
    // goes through steer-away (API.md 4.2).
    const steerAwareSubmit = (event) => {
        if (!hasInterrupt) return;
        event.preventDefault();
        const text = aui.composer.getState().text.trim();
        if (!text) return;
        aui.composer.setText("");
        steerAway(text).catch((error) => {
            if (!isRejectedBeforeSend(error)) return; // run errors: already reported by onError
            if (!aui.composer.getState().text) aui.composer.setText(text);
            notifySendRejected(error);
        });
    };

    return (
        <ComposerPrimitive.Root
            onSubmit={steerAwareSubmit}
            className="grid gap-1 rounded-[12px] border border-[#DDE3E5] bg-white px-2 pb-2 pt-1.5 shadow-[0_1px_3px_rgba(0,43,49,.05)] focus-within:border-[#2E5A6E]/50"
        >
            <ComposerPrimitive.Input
                placeholder={hasInterrupt ? "Hoặc gõ câu hỏi khác để bỏ qua biểu mẫu…" : "Hỏi bất cứ điều gì về lập trình…"}
                aria-label="Nội dung tin nhắn"
                minRows={1}
                maxRows={6}
                className="block w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-[1.5] text-[#002B31] outline-none placeholder:text-[#8FA3A7]"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <ToolChips value={selectedTools} onChange={onToolsChange} />
                <AuiIf condition={(s) => !s.thread.isRunning}>
                    <ComposerPrimitive.Send
                        onClick={steerAwareSubmit}
                        aria-label="Gửi"
                        title="Gửi (Enter)"
                        className="grid size-8 place-items-center rounded-[8px] bg-[#2E5A6E] text-white hover:bg-[#1D3E4B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed disabled:bg-[#B9C6C8]"
                    >
                        <SendHorizontal className="size-4" aria-hidden="true" />
                    </ComposerPrimitive.Send>
                </AuiIf>
                <AuiIf condition={(s) => s.thread.isRunning}>
                    <ComposerPrimitive.Cancel
                        aria-label="Dừng"
                        title="Dừng"
                        className="grid h-8 grid-flow-col items-center gap-1.5 rounded-[8px] border border-[#E3E1DC] bg-white px-3 text-[12.5px] font-semibold text-[#002B31] hover:bg-[#F4F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Square className="size-3 fill-current" aria-hidden="true" />
                        Dừng
                    </ComposerPrimitive.Cancel>
                </AuiIf>
            </div>
        </ComposerPrimitive.Root>
    );
}

function renderMessage({ message }) {
    if (message.role === "user") return <UserMessage />;
    if (message.role === "assistant") return <AssistantMessage />;
    return null;
}

/**
 * Props: selectedTools (string[]), onToolsChange(nextIds) — the composer tool chips,
 * owned by SessionPage so getExtraContext can read them (PLAN 6.B.5).
 */
export default function Thread({ selectedTools, onToolsChange }) {
    return (
        <ThreadPrimitive.Root className="relative h-full min-h-0 bg-white">
            <ThreadPrimitive.Viewport
                turnAnchor="bottom"
                className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto] overflow-y-auto"
            >
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 px-4 pb-4 pt-4">
                    <AuiIf condition={(s) => s.thread.isEmpty}>
                        <Welcome />
                    </AuiIf>
                    <AuiIf condition={(s) => s.thread.isLoading}>
                        <HistoryLoading />
                    </AuiIf>
                    <ThreadPrimitive.Messages>{renderMessage}</ThreadPrimitive.Messages>
                </div>
                <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-10 grid gap-2 bg-white px-4 pb-4 pt-2">
                    <ThreadPrimitive.ScrollToBottom
                        aria-label="Cuộn xuống cuối"
                        title="Cuộn xuống cuối"
                        className="absolute -top-10 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-[#E3E1DC] bg-white text-[#2E5A6E] shadow-[0_1px_3px_rgba(0,43,49,.08)] hover:bg-[#F4F7F8] disabled:hidden"
                    >
                        <ArrowDown className="size-4" aria-hidden="true" />
                    </ThreadPrimitive.ScrollToBottom>
                    <InterruptPanel />
                    <Composer selectedTools={selectedTools} onToolsChange={onToolsChange} />
                </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
    );
}
