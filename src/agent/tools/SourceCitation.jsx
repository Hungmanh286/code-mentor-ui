import { useId } from "react";
import { FileText } from "lucide-react";
import { Label, SkeletonLines } from "@/agent/catalog/parts";

// Renderer for `cite_sources`: { sources: Array<{ file_id, file_name, page?, quote }> }.
// Each source is a chip "tên file · tr.N"; hovering or focusing it reveals the quote.
// The popover is CSS-only (group-hover / group-focus-within) because the Radix
// hover-card / tooltip packages behind src/components/ui/{hover-card,tooltip}.jsx
// are not installed in this repo.

const MAX_SOURCES = 30;

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function asPage(value) {
    const n =
        typeof value === "number"
            ? value
            : typeof value === "string" && value.trim() !== ""
              ? Number(value)
              : NaN;
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function SourceChip({ source }) {
    const tooltipId = useId();
    const name = asText(source.file_name).trim() || asText(source.file_id).trim() || "Tài liệu";
    const page = asPage(source.page);
    const quote = asText(source.quote).trim();
    const location = page ? `${name} · tr.${page}` : name;

    return (
        <span className="group relative inline-flex max-w-full">
            <button
                type="button"
                aria-describedby={quote ? tooltipId : undefined}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#DDE3E5] bg-white px-2.5 py-1 text-[12px] text-[#2E5A6E] hover:bg-[#F1F5F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30"
            >
                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 max-w-[220px] truncate">{name}</span>
                {page ? <span className="shrink-0 text-[#7C9499]">· tr.{page}</span> : null}
            </button>
            {quote ? (
                <span
                    id={tooltipId}
                    role="tooltip"
                    className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[min(18rem,80vw)] rounded-[8px] border border-[#E3E1DC] bg-white p-3 text-left opacity-0 shadow-[0_4px_16px_rgba(0,43,49,.10)] transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
                >
                    <span className="line-clamp-6 block text-[12.5px] leading-[1.55] text-[#22454C]">
                        “{quote}”
                    </span>
                    <span className="mt-2 block truncate text-[11px] text-[#7C9499]">{location}</span>
                </span>
            ) : null}
        </span>
    );
}

export default function SourceCitation({ args, status }) {
    const running = status?.type === "running";
    const sources = Array.isArray(args?.sources)
        ? args.sources
              .filter((s) => s && typeof s === "object")
              .filter((s) => asText(s.file_name).trim() || asText(s.file_id).trim())
              .slice(0, MAX_SOURCES)
        : [];

    if (sources.length === 0) {
        if (!running) return null;
        return (
            <div className="flex w-full min-w-0 flex-col gap-2" aria-busy="true">
                <Label>Nguồn trích dẫn</Label>
                <SkeletonLines lines={1} className="max-w-[240px]" />
            </div>
        );
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-2" aria-busy={running || undefined}>
            <Label>Nguồn trích dẫn</Label>
            <div className="flex flex-wrap gap-2">
                {sources.map((source, i) => (
                    <SourceChip key={`${i}:${asText(source.file_id)}`} source={source} />
                ))}
            </div>
        </div>
    );
}
