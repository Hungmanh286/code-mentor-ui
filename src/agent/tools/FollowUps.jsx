import { useState } from "react";
import { Label, SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

// Renderer for `suggest_followups`: { questions: string[] }.
// Clicking a chip calls `onSelect(question)` (wired in toolkit.jsx, C2).
// `disabled` (e.g. thread running / interrupt pending) greys the chips out.
// After one selection the chips lock to avoid double-sending; they unlock
// again if `onSelect` throws or returns a rejected promise.

const MAX_QUESTIONS = 8;

export default function FollowUps({ args, status, onSelect, disabled = false }) {
    const running = status?.type === "running";
    const [sentIndex, setSentIndex] = useState(null);

    const questions = Array.isArray(args?.questions)
        ? args.questions
              .filter((q) => typeof q === "string")
              .map((q) => q.trim())
              .filter(Boolean)
              .slice(0, MAX_QUESTIONS)
        : [];

    const canSelect =
        typeof onSelect === "function" && !running && !disabled && sentIndex === null;

    const handleSelect = (question, index) => {
        if (!canSelect) return;
        setSentIndex(index);
        try {
            const outcome = onSelect(question);
            if (outcome && typeof outcome.then === "function") {
                outcome.then(undefined, () => setSentIndex(null));
            }
        } catch {
            setSentIndex(null);
        }
    };

    if (questions.length === 0) {
        if (!running) return null;
        return (
            <div className="flex w-full min-w-0 flex-col gap-2" aria-busy="true">
                <Label>Hỏi tiếp</Label>
                <SkeletonLines lines={1} className="max-w-[280px]" />
            </div>
        );
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-2" aria-busy={running || undefined}>
            <Label>Hỏi tiếp</Label>
            <div className="flex flex-wrap gap-2">
                {questions.map((question, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => handleSelect(question, i)}
                        disabled={!canSelect}
                        className={cn(
                            "max-w-full rounded-full border border-[#DDE3E5] bg-white px-3 py-[7px] text-left text-[12.5px] leading-snug text-[#2E5A6E] transition-colors hover:bg-[#F1F5F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-default disabled:hover:bg-white",
                            sentIndex === null && !canSelect && "opacity-60",
                            sentIndex !== null && sentIndex !== i && "opacity-60",
                            sentIndex === i && "border-[#2E5A6E] bg-[#F1F5F6] disabled:hover:bg-[#F1F5F6]",
                        )}
                    >
                        {question}
                    </button>
                ))}
            </div>
        </div>
    );
}
