import { useId, useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import MarkdownText from "@/agent/thread/MarkdownText";
import { cn } from "@/lib/utils";

// Collapsible "Quá trình suy nghĩ" block for `reasoning` message parts (PLAN 6.B.3).
// Closed by default. Hand-written with state (PLAN 4.9: no ui/collapsible).
// Props: { text, status } — `status.type === "running"` while REASONING_* is still streaming.

export default function Reasoning({ text, status }) {
    const [open, setOpen] = useState(false);
    const bodyId = useId();
    const running = status?.type === "running";
    const content = typeof text === "string" ? text : "";

    return (
        <div className="w-full min-w-0 rounded-[8px] border border-[#E7E5E0] bg-[#FBFAF8]">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={open ? bodyId : undefined}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[12.5px] text-[#46595D] hover:bg-[#F4F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2E5A6E]/30"
            >
                <Brain className="size-3.5 shrink-0 text-[#7C9499]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold">Quá trình suy nghĩ</span>
                {running ? (
                    <span className="shrink-0 animate-pulse text-[11.5px] text-[#7C9499]">Đang suy nghĩ…</span>
                ) : null}
                <ChevronRight
                    className={cn("size-3.5 shrink-0 text-[#7C9499] transition-transform", open && "rotate-90")}
                    aria-hidden="true"
                />
            </button>
            {open ? (
                <div id={bodyId} className="border-t border-[#F0EEE9] px-3 py-2.5">
                    {content.trim() ? (
                        <MarkdownText text={content} className="text-[13px] text-[#46595D]" />
                    ) : (
                        <p className="text-[12.5px] italic text-[#8FA3A7]">(Chưa có nội dung)</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
