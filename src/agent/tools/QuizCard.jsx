import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Md } from "@/agent/catalog/Md";
import { ActionButton, Label, Panel, SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

// Renderer for `show_quiz`: { title, questions: Array<{ id, question, options,
// answer_index, explanation, difficulty }> }. One question at a time; picking an
// option locks that question. Keyboard (when the card has focus): 1–9 picks an
// option, ←/→ moves between questions.

const DIFFICULTY = {
    easy: { label: "Dễ", className: "bg-[#F5FAF7] text-[#4E8F6E]" },
    medium: { label: "Vừa", className: "bg-[#F1F5F6] text-[#2E5A6E]" },
    hard: { label: "Khó", className: "bg-[#FDF6F6] text-error-red" },
};
const LETTERS = "ABCDEFGHI";
const MAX_OPTIONS = 9;

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

// Keeps only questions that can be answered and scored; counts the rest.
function normalizeQuestions(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const valid = [];
    let received = 0;
    list.forEach((q, i) => {
        if (!q || typeof q !== "object") return;
        const question = asText(q.question).trim();
        if (question) received += 1;
        const options = Array.isArray(q.options)
            ? q.options.slice(0, MAX_OPTIONS).map(asText)
            : [];
        const answer = q.answer_index;
        if (
            !question ||
            options.length < 2 ||
            !Number.isInteger(answer) ||
            answer < 0 ||
            answer >= options.length
        ) {
            return;
        }
        valid.push({
            key: `${i}:${asText(q.id)}`,
            question,
            options,
            answer,
            explanation: asText(q.explanation),
            difficulty: has(DIFFICULTY, q.difficulty) ? q.difficulty : null,
        });
    });
    return { valid, received, total: list.length };
}

function DifficultyBadge({ difficulty }) {
    const meta = difficulty ? DIFFICULTY[difficulty] : null;
    if (!meta) return null;
    return (
        <Badge
            variant="outline"
            className={cn(
                "rounded-[2px] border-transparent px-1.5 py-0.5 text-[10.5px] font-semibold leading-none shadow-none",
                meta.className,
            )}
        >
            {meta.label}
        </Badge>
    );
}

function optionClasses({ answered, isCorrect, isPicked }) {
    if (answered && isCorrect) {
        return { box: "border-[#4E8F6E] bg-[#F5FAF7]", badge: "bg-[#4E8F6E] text-white" };
    }
    if (answered && isPicked) {
        return { box: "border-error-red bg-[#FDF6F6]", badge: "bg-error-red text-white" };
    }
    if (answered) {
        return { box: "border-[#E7E5E0] bg-white opacity-70", badge: "bg-[#F2F4F5] text-[#5D7175]" };
    }
    return {
        box: "border-[#E7E5E0] bg-white hover:border-[#C9D6DA] hover:bg-[#F4F7F8]",
        badge: "bg-[#F2F4F5] text-[#5D7175]",
    };
}

function QuizHeader({ title, count, difficulty }) {
    return (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[#F0EEE9] px-4 py-3">
            <div className="min-w-0 flex-1">
                <Label>Bài kiểm tra</Label>
                <p className="mt-1 truncate font-urbanist text-[15.5px] font-semibold leading-snug">
                    {title}
                </p>
            </div>
            {count > 0 ? <span className="text-[11.5px] text-[#7C9499]">{count} câu</span> : null}
            <DifficultyBadge difficulty={difficulty} />
        </div>
    );
}

export default function QuizCard({ args, status }) {
    const statusType = status?.type ?? "complete";
    const running = statusType === "running";
    const rawQuestions = args?.questions;
    const {
        valid: questions,
        received,
        total: totalRaw,
    } = useMemo(() => normalizeQuestions(rawQuestions), [rawQuestions]);

    const [index, setIndex] = useState(0);
    const [picks, setPicks] = useState({});
    const [finished, setFinished] = useState(false);
    const rootRef = useRef(null);

    const title = asText(args?.title).trim() || "Bài kiểm tra";
    const count = questions.length;
    const safeIndex = count > 0 ? Math.min(Math.max(index, 0), count - 1) : 0;
    const current = count > 0 ? questions[safeIndex] : null;
    const picked = current && has(picks, current.key) ? picks[current.key] : undefined;
    const answered = picked !== undefined;
    const answeredCount = questions.filter((q) => has(picks, q.key)).length;
    const correctCount = questions.filter((q) => picks[q.key] === q.answer).length;
    const skipped = totalRaw - count;

    // Nav buttons can become disabled or unmount after a click; keep keyboard
    // focus on the card so ←/→ and 1–9 keep working.
    const keepFocus = () => rootRef.current?.focus({ preventScroll: true });

    const pick = (optionIndex) => {
        if (!current || answered || optionIndex < 0 || optionIndex >= current.options.length) {
            return;
        }
        const key = current.key;
        setPicks((prev) => (has(prev, key) ? prev : { ...prev, [key]: optionIndex }));
    };
    const goPrev = () => {
        setIndex(Math.max(0, safeIndex - 1));
        keepFocus();
    };
    const goNext = () => {
        if (safeIndex < count - 1) setIndex(safeIndex + 1);
        else if (answered) setFinished(true);
        keepFocus();
    };
    const review = () => {
        setFinished(false);
        keepFocus();
    };
    const restart = () => {
        setPicks({});
        setIndex(0);
        setFinished(false);
        keepFocus();
    };

    const handleKeyDown = (event) => {
        if (finished || !current) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
            return;
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            goPrev();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            goNext();
        } else if (/^[1-9]$/.test(event.key)) {
            const optionIndex = Number(event.key) - 1;
            if (optionIndex < current.options.length) {
                event.preventDefault();
                pick(optionIndex);
            }
        }
    };

    if (running) {
        return (
            <Panel aria-busy="true">
                <QuizHeader title={title} count={0} />
                <div className="flex flex-col gap-3 px-4 py-4">
                    <SkeletonLines lines={2} />
                    <div className="flex flex-col gap-2" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-9 animate-pulse rounded-[8px] border border-[#EEF1F2] bg-[#FBFAF8]"
                            />
                        ))}
                    </div>
                    <p className="text-[12px] text-[#7C9499]" aria-live="polite">
                        {received > 0 ? `Đã nhận ${received} câu…` : "Đang soạn câu hỏi…"}
                    </p>
                </div>
            </Panel>
        );
    }

    if (!current) {
        return (
            <Panel>
                <QuizHeader title={title} count={0} />
                <p className="px-4 py-4 text-[13px] text-[#7C9499]">
                    {statusType === "incomplete"
                        ? "Bài kiểm tra bị dừng trước khi nhận được câu hỏi nào."
                        : "Không có câu hỏi hợp lệ để hiển thị."}
                </p>
            </Panel>
        );
    }

    const notes =
        statusType === "incomplete" || skipped > 0 ? (
            <div className="flex flex-col gap-0.5 text-[11.5px] text-[#7C9499]">
                {statusType === "incomplete" ? (
                    <p>Bài kiểm tra bị dừng giữa chừng — chỉ hiển thị các câu đã nhận đủ.</p>
                ) : null}
                {skipped > 0 ? <p>Đã bỏ qua {skipped} câu thiếu dữ liệu.</p> : null}
            </div>
        ) : null;

    let body;
    if (finished) {
        const ratio = correctCount / count;
        const verdict =
            ratio >= 0.8
                ? "Rất tốt!"
                : ratio >= 0.5
                  ? "Khá ổn, xem lại các câu sai nhé."
                  : "Hãy ôn lại và thử lần nữa.";
        body = (
            <div className="flex flex-col items-start gap-3 px-4 py-4" aria-live="polite">
                <Label>Kết quả</Label>
                <p className="font-urbanist text-[28px] font-semibold leading-none">
                    {correctCount}/{count}
                    <span className="ml-2 font-sans text-[13px] font-normal text-[#7C9499]">
                        câu đúng
                    </span>
                </p>
                <p className="text-[13.5px]">{verdict}</p>
                {answeredCount < count ? (
                    <p className="text-[12px] text-[#7C9499]">
                        Chưa trả lời {count - answeredCount} câu.
                    </p>
                ) : null}
                {notes}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <ActionButton onClick={review}>Xem lại</ActionButton>
                    <ActionButton tone="primary" onClick={restart}>
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Làm lại
                    </ActionButton>
                </div>
            </div>
        );
    } else {
        const progress = Math.round(((safeIndex + 1) / count) * 100);
        const isLast = safeIndex === count - 1;
        const isRight = picked === current.answer;
        body = (
            <div className="flex flex-col gap-3.5 px-4 py-4">
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-[#7C9499]">
                    <span>
                        Câu {safeIndex + 1}/{count}
                    </span>
                    <span>
                        Đã trả lời {answeredCount}/{count}
                    </span>
                </div>
                <div
                    className="h-[3px] overflow-hidden rounded-[2px] bg-[#EDF1F2]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="Tiến độ bài kiểm tra"
                >
                    <div
                        className="h-full rounded-[2px] bg-[#2E5A6E] transition-[width] duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <p className="text-[14px] font-semibold leading-[1.5]">{current.question}</p>

                <div className="flex flex-col gap-[7px]">
                    {current.options.map((option, i) => {
                        const cls = optionClasses({
                            answered,
                            isCorrect: i === current.answer,
                            isPicked: i === picked,
                        });
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => pick(i)}
                                aria-disabled={answered || undefined}
                                aria-pressed={i === picked}
                                className={cn(
                                    "flex w-full items-start gap-2.5 rounded-[9px] border px-[11px] py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 aria-disabled:cursor-default",
                                    cls.box,
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                                        cls.badge,
                                    )}
                                >
                                    {LETTERS[i]}
                                </span>
                                <span className="min-w-0 break-words text-[13px] leading-[1.5] text-[#002B31]">
                                    {option || "(trống)"}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {answered ? (
                    <div
                        className={cn(
                            "rounded-[9px] border px-3 py-2.5",
                            isRight ? "border-[#DCE8E0] bg-[#F5F8F6]" : "border-[#F0D9D9] bg-[#FDF6F6]",
                        )}
                        aria-live="polite"
                    >
                        <p
                            className={cn(
                                "text-[11px] font-semibold uppercase tracking-[.08em]",
                                isRight ? "text-[#4E8F6E]" : "text-error-red",
                            )}
                        >
                            {isRight
                                ? "Chính xác"
                                : `Chưa đúng — đáp án đúng là ${LETTERS[current.answer]}`}
                        </p>
                        {current.explanation.trim() ? (
                            <Md
                                text={current.explanation}
                                className="mt-1.5 text-[12.5px] text-[#2E4A50]"
                            />
                        ) : null}
                    </div>
                ) : null}

                {notes}

                <div className="flex items-center gap-2 pt-0.5">
                    <ActionButton onClick={goPrev} disabled={safeIndex === 0}>
                        <ChevronLeft className="size-3.5" aria-hidden="true" />
                        Câu trước
                    </ActionButton>
                    <span className="hidden flex-1 text-center text-[11px] text-[#A3B2B5] sm:block">
                        Phím 1–{current.options.length} để chọn · ←/→ để chuyển câu
                    </span>
                    <span className="flex-1 sm:hidden" />
                    <ActionButton tone="primary" onClick={goNext} disabled={isLast && !answered}>
                        {isLast ? "Xem kết quả" : "Câu tiếp"}
                        {isLast ? null : <ChevronRight className="size-3.5" aria-hidden="true" />}
                    </ActionButton>
                </div>
            </div>
        );
    }

    return (
        <Panel>
            <div
                ref={rootRef}
                role="group"
                aria-label={`Bài kiểm tra: ${title}`}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className="rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30"
            >
                <QuizHeader
                    title={title}
                    count={count}
                    difficulty={finished ? null : current.difficulty}
                />
                {body}
            </div>
        </Panel>
    );
}
