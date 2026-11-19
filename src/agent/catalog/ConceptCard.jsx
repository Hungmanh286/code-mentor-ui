import { Md } from "@/agent/catalog/Md";
import { CopyButton, Label, Panel, SkeletonLines } from "@/agent/catalog/parts";

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

// { type: "concept_card", term, definition_md, example_code?, language? }
export default function ConceptCard({ block, streaming = false }) {
    const term = asText(block?.term).trim();
    const definition = asText(block?.definition_md);
    const example = asText(block?.example_code);
    const language = asText(block?.language).trim();

    return (
        <Panel className="overflow-hidden">
            <div className="px-3.5 pb-3 pt-3">
                <Label>Khái niệm</Label>
                <p className="mt-1.5 font-urbanist text-[17px] font-semibold leading-tight">
                    {term || (streaming ? "…" : "Khái niệm")}
                </p>
                {definition.trim() ? (
                    <Md text={definition} className="mt-1.5" />
                ) : streaming ? (
                    <SkeletonLines lines={2} className="mt-2" />
                ) : null}
            </div>
            {example ? (
                <div className="border-t border-[#F0EEE9]">
                    <div className="flex h-9 items-center justify-between gap-2 px-3">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#8FA3A7]">
                            {language ? `Ví dụ · ${language}` : "Ví dụ"}
                        </span>
                        <CopyButton value={example} />
                    </div>
                    <pre className="m-0 overflow-x-auto border-t border-[#F0EEE9] bg-[#FBFAF8] p-3 font-mono text-[12px] leading-[1.7] text-[#22454C]">
                        <code>{example}</code>
                    </pre>
                </div>
            ) : null}
        </Panel>
    );
}
