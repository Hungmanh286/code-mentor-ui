import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import { Md } from "@/agent/catalog/Md";
import { SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

const TONES = {
    info: {
        Icon: Info,
        label: "Thông tin",
        box: "border-[#D9E3E7] bg-[#F4F7F8]",
        accent: "text-[#2E5A6E]",
    },
    tip: {
        Icon: Lightbulb,
        label: "Mẹo",
        box: "border-[#DCE8E0] bg-[#F5F8F6]",
        accent: "text-[#4E8F6E]",
    },
    warning: {
        Icon: TriangleAlert,
        label: "Lưu ý",
        box: "border-[#F0D9D9] bg-[#FDF6F6]",
        accent: "text-error-red",
    },
};

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

// { type: "callout", tone: "info"|"tip"|"warning", title, body_md }
export default function Callout({ block, streaming = false }) {
    const tone = Object.prototype.hasOwnProperty.call(TONES, block?.tone) ? block.tone : "info";
    const { Icon, label, box, accent } = TONES[tone];
    const title = asText(block?.title).trim();
    const body = asText(block?.body_md);

    return (
        <div
            role="note"
            className={cn("flex w-full min-w-0 gap-3 rounded-[8px] border px-3.5 py-3", box)}
        >
            <Icon className={cn("mt-0.5 size-4 shrink-0", accent)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] font-semibold leading-snug", accent)}>
                    {title || label}
                </p>
                {body.trim() ? (
                    <Md text={body} className="mt-1" />
                ) : streaming ? (
                    <SkeletonLines lines={2} className="mt-2" />
                ) : null}
            </div>
        </div>
    );
}
