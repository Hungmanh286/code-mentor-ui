import { Md } from "@/agent/catalog/Md";
import { SkeletonLines } from "@/agent/catalog/parts";

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

// { type: "steps", items: Array<{ title, body_md }> }
export default function Steps({ block, streaming = false }) {
    const items = Array.isArray(block?.items)
        ? block.items.filter((item) => item && typeof item === "object")
        : [];

    if (items.length === 0) {
        return streaming ? (
            <SkeletonLines lines={3} />
        ) : (
            <p className="text-[12.5px] text-[#7C9499]">Chưa có bước nào.</p>
        );
    }

    return (
        <ol className="flex w-full min-w-0 flex-col">
            {items.map((item, i) => {
                const title = asText(item.title).trim();
                const body = asText(item.body_md);
                const isLast = i === items.length - 1;
                return (
                    <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                        {!isLast && (
                            <span
                                aria-hidden="true"
                                className="absolute bottom-0 left-[11px] top-7 w-px bg-[#E3E1DC]"
                            />
                        )}
                        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2E5A6E] text-[11.5px] font-semibold text-white">
                            {i + 1}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[13.5px] font-semibold leading-snug">
                                {title || `Bước ${i + 1}`}
                            </p>
                            {body.trim() ? (
                                <Md text={body} className="mt-1" />
                            ) : streaming && isLast ? (
                                <SkeletonLines lines={1} className="mt-2" />
                            ) : null}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
