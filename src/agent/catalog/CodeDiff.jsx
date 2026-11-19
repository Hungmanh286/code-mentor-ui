import { Md } from "@/agent/catalog/Md";
import { CopyButton, Panel, SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function CodePane({ label, dotClass, code, streaming }) {
    return (
        <div className="flex min-w-0 flex-col">
            <div className="flex h-9 items-center justify-between gap-2 border-b border-[#F0EEE9] px-3">
                <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#46595D]">
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClass)} />
                    {label}
                </span>
                <CopyButton value={code} />
            </div>
            {code ? (
                <pre className="m-0 min-h-[3rem] flex-1 overflow-x-auto bg-[#FBFAF8] p-3 font-mono text-[12px] leading-[1.7] text-[#22454C]">
                    <code>{code}</code>
                </pre>
            ) : streaming ? (
                <SkeletonLines lines={3} className="p-3" />
            ) : (
                <p className="p-3 text-[12px] text-[#7C9499]">(trống)</p>
            )}
        </div>
    );
}

// { type: "code_diff", language, before, after, explanation_md }
// Two columns that collapse into one when the container is narrow
// (auto-fit grid, so it reacts to the chat column width, not the viewport).
export default function CodeDiff({ block, streaming = false }) {
    const language = asText(block?.language).trim();
    const before = asText(block?.before);
    const after = asText(block?.after);
    const explanation = asText(block?.explanation_md);

    return (
        <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EEE9] px-3 py-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#8FA3A7]">
                    {language || "code"}
                </span>
                <span className="text-[10.5px] text-[#A3B2B5]">Trước · Sau</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-px bg-[#F0EEE9]">
                <div className="min-w-0 bg-white">
                    <CodePane
                        label="Trước"
                        dotClass="bg-error-red"
                        code={before}
                        streaming={streaming}
                    />
                </div>
                <div className="min-w-0 bg-white">
                    <CodePane
                        label="Sau"
                        dotClass="bg-[#4E8F6E]"
                        code={after}
                        streaming={streaming}
                    />
                </div>
            </div>
            {explanation.trim() ? (
                <div className="border-t border-[#F0EEE9] px-3.5 py-3">
                    <Md text={explanation} />
                </div>
            ) : null}
        </Panel>
    );
}
