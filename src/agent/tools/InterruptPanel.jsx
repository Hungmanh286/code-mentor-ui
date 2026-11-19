import { useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useAgUiInterrupts, useAgUiSubmitInterruptResponses } from "@assistant-ui/react-ag-ui";
import { ActionButton, Label, Panel } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

// Human-in-the-loop panel shown above the composer (PLAN 4.2, 4.6, 6.B.6). No props.
// - `metadata.kind === "quiz_config"`: count (5/10/15) + difficulty (Dễ/Vừa/Khó), "Sinh câu hỏi" / "Hủy".
// - any other interrupt: its `message` with "Đồng ý" / "Hủy".
// The response always covers EVERY open interrupt (the runtime rejects partial answers).
//
// Runtime behaviour (API.md 4.3 + react-ag-ui source): submit() clears the interrupts right away and
// its promise settles only when the resumed run ends. Validation errors ("[agui] …") reject before
// anything is cleared, so the card is still mounted and shows the error with a retry. Errors of the
// resumed run itself are already reported by the provider's onError (toast + message error); by then
// the card is unmounted, so they are only swallowed here (never an unhandled rejection).

const COUNT_OPTIONS = [5, 10, 15];
const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Dễ" },
    { value: "medium", label: "Vừa" },
    { value: "hard", label: "Khó" },
];
const DEFAULT_COUNT = 10;
const DEFAULT_DIFFICULTY = "medium";
const MAX_COUNT = 50;

function isValidCount(value) {
    return Number.isInteger(value) && value > 0 && value <= MAX_COUNT;
}

function isQuizConfig(interrupt) {
    return interrupt?.metadata?.kind === "quiz_config";
}

function readDefaults(interrupt) {
    const defaults = interrupt?.metadata?.defaults;
    const count = isValidCount(defaults?.count) ? defaults.count : DEFAULT_COUNT;
    const difficulty = DIFFICULTY_OPTIONS.some((o) => o.value === defaults?.difficulty)
        ? defaults.difficulty
        : DEFAULT_DIFFICULTY;
    return { count, difficulty };
}

function errorText(error) {
    const message = typeof error?.message === "string" ? error.message : String(error ?? "");
    return message || "Lỗi không xác định";
}

function Segmented({ label, options, value, onChange, disabled }) {
    return (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            <div role="radiogroup" aria-label={label} className="grid grid-flow-col justify-start gap-1.5">
                {options.map((option) => {
                    const active = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "h-8 min-w-[52px] rounded-[7px] border px-3 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed disabled:opacity-60",
                                active
                                    ? "border-[#2E5A6E] bg-[#EEF1F2] font-semibold text-[#1D3E4B]"
                                    : "border-[#E3E1DC] bg-white text-[#002B31] hover:bg-[#F4F7F8]",
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Keyed by the open interrupt ids: form state, pending and error reset for every new interrupt set.
function InterruptCard({ interrupts }) {
    const submit = useAgUiSubmitInterruptResponses(); // new function every render: call it, never memoize
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const first = interrupts[0];
    const quiz = isQuizConfig(first);
    const [initial] = useState(() => readDefaults(first));
    const [count, setCount] = useState(initial.count);
    const [difficulty, setDifficulty] = useState(initial.difficulty);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const busy = pending || isRunning;

    const countOptions = (COUNT_OPTIONS.includes(initial.count)
        ? COUNT_OPTIONS
        : [...COUNT_OPTIONS, initial.count].sort((a, b) => a - b)
    ).map((n) => ({ value: n, label: String(n) }));

    const answer = async (status) => {
        if (busy) return;
        setPending(true);
        setError(null);
        const entries = interrupts.map((interrupt) => {
            if (status === "cancelled") return { interruptId: interrupt.id, status: "cancelled" };
            const payload = isQuizConfig(interrupt) ? { count, difficulty } : { approved: true };
            return { interruptId: interrupt.id, status: "resolved", payload };
        });
        try {
            await submit(entries);
        } catch (e) {
            // Still mounted only when the runtime refused the answer (interrupts not cleared).
            setError(errorText(e));
        } finally {
            setPending(false);
        }
    };

    const documents = Array.isArray(first?.metadata?.documents)
        ? first.metadata.documents.filter((d) => typeof d === "string")
        : [];
    const message =
        typeof first?.message === "string" && first.message.trim()
            ? first.message
            : quiz
              ? "Cấu hình bộ câu hỏi"
              : "Trợ lý cần bạn xác nhận để tiếp tục.";
    const extra = interrupts.length - 1;

    return (
        <Panel
            role="group"
            aria-label={quiz ? "Cấu hình sinh câu hỏi" : "Yêu cầu xác nhận"}
            aria-busy={pending || undefined}
            className="grid gap-3 px-4 py-3.5"
        >
            <div className="grid gap-1">
                <Label>{quiz ? "Cấu hình câu hỏi" : "Cần xác nhận"}</Label>
                <p className="text-[13.5px] leading-[1.5] text-[#002B31]">{message}</p>
                {quiz && documents.length > 0 ? (
                    <p className="text-[12px] text-[#7C9499]">Dùng {documents.length} tài liệu đang bật.</p>
                ) : null}
                {extra > 0 ? (
                    <p className="text-[12px] text-[#7C9499]">
                        Kèm {extra} yêu cầu khác, sẽ được trả lời cùng lúc.
                    </p>
                ) : null}
            </div>

            {quiz ? (
                <div className="grid gap-3">
                    <Segmented label="Số câu" options={countOptions} value={count} onChange={setCount} disabled={busy} />
                    <Segmented
                        label="Độ khó"
                        options={DIFFICULTY_OPTIONS}
                        value={difficulty}
                        onChange={setDifficulty}
                        disabled={busy}
                    />
                </div>
            ) : null}

            {error ? (
                <p role="alert" className="break-words text-[12.5px] text-error-red">
                    Không gửi được phản hồi: {error}. Hãy thử lại.
                </p>
            ) : null}

            <div className="grid grid-flow-col justify-start gap-2">
                <ActionButton tone="primary" disabled={busy} onClick={() => answer("resolved")}>
                    {pending ? "Đang gửi…" : quiz ? "Sinh câu hỏi" : "Đồng ý"}
                </ActionButton>
                <ActionButton tone="outline" disabled={busy} onClick={() => answer("cancelled")}>
                    Hủy
                </ActionButton>
            </div>
            <p className="text-[11.5px] text-[#8FA3A7]">Hoặc gõ câu hỏi khác để bỏ qua.</p>
        </Panel>
    );
}

export default function InterruptPanel() {
    const interrupts = useAgUiInterrupts(); // readonly AgUiInterrupt[]; [] when nothing is pending
    if (!Array.isArray(interrupts) || interrupts.length === 0) return null;
    const key = interrupts.map((interrupt) => interrupt.id).join("|");
    return <InterruptCard key={key} interrupts={interrupts} />;
}
