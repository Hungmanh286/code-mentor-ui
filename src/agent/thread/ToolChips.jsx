import { useEffect, useId, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Tool picker of the composer (PLAN 6.B.5): a "+" button with two options and removable chips.
// Controlled: `value` is the selected id list, `onChange(nextIds)` reports a new list.
// The list itself lives in SessionPage (state for rendering + ref read by getExtraContext),
// and is sent to the agent as context `requested_tools` (PLAN 4.4).
//
// Layout note: src/assets/css/cusstom.css has a global `.flex>div:nth-child(1) { overflow: hidden }`
// rule. The menu is absolutely positioned inside this component's root, so the root is a
// grid (not `.flex`) and must not be placed as the first <div> child of a `.flex` container.

const TOOL_OPTIONS = [
    { id: "generate-questions", label: "Sinh câu hỏi", icon: "💡" },
    { id: "mindmap", label: "Mindmap", icon: "🗺️" },
];

const OPTION_BY_ID = new Map(TOOL_OPTIONS.map((option) => [option.id, option]));

export default function ToolChips({ value, onChange, disabled = false }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const menuId = useId();
    const selected = Array.isArray(value) ? value.filter((id) => OPTION_BY_ID.has(id)) : [];

    // Close on outside pointer down and on Escape (Escape must not also cancel the run).
    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [open]);

    const emit = (next) => {
        if (typeof onChange === "function") onChange(next);
    };

    const toggle = (id) => {
        emit(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
        setOpen(false);
    };

    return (
        <div ref={rootRef} className="relative grid min-w-0 grid-flow-col items-center justify-start gap-1.5">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label="Chọn công cụ"
                title="Chọn công cụ"
                className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[#2E5A6E] hover:bg-[#F1F5F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Plus className="size-4" aria-hidden="true" />
            </button>

            {selected.map((id) => {
                const option = OPTION_BY_ID.get(id);
                return (
                    <span
                        key={id}
                        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[#DDE3E5] bg-[#F1F5F6] py-1 pl-2.5 pr-1 text-[12px] text-[#2E5A6E]"
                    >
                        <span aria-hidden="true">{option.icon}</span>
                        <span className="truncate">{option.label}</span>
                        <button
                            type="button"
                            onClick={() => emit(selected.filter((item) => item !== id))}
                            aria-label={`Bỏ chọn ${option.label}`}
                            title="Bỏ chọn"
                            className="grid size-4 place-items-center rounded-full hover:bg-[#E3EAEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30"
                        >
                            <X className="size-3" aria-hidden="true" />
                        </button>
                    </span>
                );
            })}

            {open ? (
                <div
                    id={menuId}
                    role="menu"
                    aria-label="Công cụ"
                    className="absolute bottom-full left-0 z-30 mb-2 min-w-[200px] overflow-hidden rounded-[8px] border border-[#E3E1DC] bg-white py-1 shadow-[0_6px_20px_rgba(0,43,49,.10)]"
                >
                    {TOOL_OPTIONS.map((option) => {
                        const checked = selected.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={checked}
                                onClick={() => toggle(option.id)}
                                className={cn(
                                    "grid w-full grid-cols-[20px_minmax(0,1fr)_16px] items-center gap-2 px-3 py-2 text-left text-[13px] text-[#002B31] hover:bg-[#F4F7F8] focus-visible:bg-[#F4F7F8] focus-visible:outline-none",
                                    checked && "font-semibold",
                                )}
                            >
                                <span aria-hidden="true">{option.icon}</span>
                                <span className="truncate">{option.label}</span>
                                {checked ? <Check className="size-4 text-[#4E8F6E]" aria-hidden="true" /> : <span />}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
