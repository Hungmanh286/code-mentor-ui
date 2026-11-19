import { useId, useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// Generic renderer for tool calls without a dedicated UI.
// Receives ToolCallMessagePartProps ({ toolName, args, argsText, result, isError,
// status, … }) but only reads plain fields — no @assistant-ui imports.
// Collapsed by default; optional `defaultOpen` starts it expanded.

const STATUS_META = {
    running: { label: "Đang chạy…", dot: "bg-[#2E5A6E] animate-pulse" },
    complete: { label: "Hoàn tất", dot: "bg-[#4E8F6E]" },
    error: { label: "Lỗi", dot: "bg-error-red" },
    cancelled: { label: "Đã hủy", dot: "bg-[#B9C6C8]" },
    incomplete: { label: "Chưa hoàn tất", dot: "bg-[#B9C6C8]" },
    "requires-action": { label: "Chờ phản hồi", dot: "bg-[#2E5A6E]" },
};

const MAX_PRE_CHARS = 20000;

function safeStringify(value) {
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
        try {
            return String(value);
        } catch {
            return "[không hiển thị được]";
        }
    }
}

// Pretty-prints argsText when it is complete JSON; otherwise shows it raw.
function formatArgs(argsText, args) {
    if (typeof argsText === "string" && argsText.trim()) {
        try {
            return JSON.stringify(JSON.parse(argsText), null, 2);
        } catch {
            return argsText;
        }
    }
    if (args && typeof args === "object" && Object.keys(args).length > 0) return safeStringify(args);
    return "";
}

function clip(text) {
    return text.length > MAX_PRE_CHARS ? `${text.slice(0, MAX_PRE_CHARS)}\n… (đã cắt bớt)` : text;
}

function statusKey(status, isError) {
    const type = status?.type;
    if (type === "running" || type === "requires-action") return type;
    if (type === "incomplete") {
        if (status?.reason === "cancelled") return "cancelled";
        if (status?.reason === "error") return "error";
        return "incomplete";
    }
    return isError ? "error" : "complete";
}

function errorText(status) {
    const error = status?.type === "incomplete" ? status?.error : undefined;
    if (error === undefined || error === null) return "";
    if (typeof error === "string") return error;
    if (typeof error?.message === "string") return error.message;
    return safeStringify(error);
}

export default function ToolFallback({
    toolName,
    argsText,
    args,
    result,
    isError,
    status,
    defaultOpen = false,
}) {
    const [open, setOpen] = useState(Boolean(defaultOpen));
    const bodyId = useId();
    const key = statusKey(status, isError);
    const meta = STATUS_META[key];
    const name = typeof toolName === "string" && toolName ? toolName : "công cụ";
    const argsDisplay = open ? clip(formatArgs(argsText, args)) : "";
    const resultDisplay = open && result !== undefined ? clip(safeStringify(result)) : "";
    const errorDisplay = open ? clip(errorText(status)) : "";

    return (
        <div className="w-full min-w-0 overflow-hidden rounded-[8px] border border-[#E3E1DC] bg-white text-[#002B31]">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={open ? bodyId : undefined}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#F4F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2E5A6E]/30"
            >
                <Wrench className="size-4 shrink-0 text-[#7C9499]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                    Công cụ <code className="font-mono font-semibold">{name}</code>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-[#7C9499]">
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                </span>
                <ChevronRight
                    className={cn("size-3.5 shrink-0 text-[#7C9499] transition-transform", open && "rotate-90")}
                    aria-hidden="true"
                />
            </button>
            {open ? (
                <div id={bodyId} className="flex flex-col gap-2.5 border-t border-[#F0EEE9] px-3.5 py-3">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#7C9499]">
                            Tham số
                        </p>
                        <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[6px] bg-[#F7F6F3] p-2.5 font-mono text-[11.5px] leading-[1.6] text-[#22454C]">
                            {argsDisplay || "(trống)"}
                        </pre>
                    </div>
                    {resultDisplay ? (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#7C9499]">
                                Kết quả
                            </p>
                            <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[6px] bg-[#F7F6F3] p-2.5 font-mono text-[11.5px] leading-[1.6] text-[#22454C]">
                                {resultDisplay}
                            </pre>
                        </div>
                    ) : null}
                    {errorDisplay ? (
                        <p className="break-words text-[12px] text-error-red">{errorDisplay}</p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
