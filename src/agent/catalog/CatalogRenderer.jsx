import { Blocks } from "lucide-react";
import Callout from "@/agent/catalog/Callout";
import CodeDiff from "@/agent/catalog/CodeDiff";
import ComparisonTable from "@/agent/catalog/ComparisonTable";
import ConceptCard from "@/agent/catalog/ConceptCard";
import Steps from "@/agent/catalog/Steps";
import { SkeletonLines } from "@/agent/catalog/parts";
import ToolErrorBoundary from "@/agent/tools/ToolErrorBoundary";

// Renderer for the `present_ui` tool: { title?: string, blocks: Block[] }.
// Dispatches each block on its `type`; unknown types get a neutral
// "Không hỗ trợ khối này" frame and the remaining blocks still render.

const BLOCKS = {
    callout: Callout,
    steps: Steps,
    comparison_table: ComparisonTable,
    code_diff: CodeDiff,
    concept_card: ConceptCard,
};

const MAX_BLOCKS = 50;

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function UnsupportedBlock({ type }) {
    return (
        <div className="flex w-full min-w-0 items-center gap-2.5 rounded-[8px] border border-dashed border-[#D5DCDE] bg-[#FBFAF8] px-3.5 py-2.5 text-[12.5px] text-[#7C9499]">
            <Blocks className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">
                Không hỗ trợ khối này
                {type ? (
                    <>
                        {" "}
                        (<code className="font-mono">{type}</code>)
                    </>
                ) : null}
            </span>
        </div>
    );
}

function BlockSlot({ block, streaming }) {
    const type = typeof block?.type === "string" ? block.type : "";
    const Renderer = Object.prototype.hasOwnProperty.call(BLOCKS, type) ? BLOCKS[type] : null;

    if (!Renderer) {
        // While the last block is still streaming its `type` may be missing
        // or a prefix of a valid name ("comp…"): show a placeholder instead.
        if (streaming) return <SkeletonLines lines={2} />;
        return <UnsupportedBlock type={type} />;
    }

    return (
        <ToolErrorBoundary toolName={`present_ui › ${type}`}>
            <Renderer block={block} streaming={streaming} />
        </ToolErrorBoundary>
    );
}

export default function CatalogRenderer({ args, status }) {
    const running = status?.type === "running";
    const title = asText(args?.title).trim();
    const allBlocks = Array.isArray(args?.blocks) ? args.blocks : [];
    const blocks = allBlocks.slice(0, MAX_BLOCKS);
    const hidden = allBlocks.length - blocks.length;

    if (!title && blocks.length === 0) {
        return running ? (
            <div className="flex w-full min-w-0 flex-col gap-2 py-1" aria-busy="true">
                <SkeletonLines lines={3} />
                <span className="text-[11.5px] text-[#7C9499]">Đang soạn nội dung…</span>
            </div>
        ) : (
            <p className="text-[12.5px] text-[#7C9499]">Không có nội dung để hiển thị.</p>
        );
    }

    return (
        <section
            className="flex w-full min-w-0 flex-col gap-3"
            aria-busy={running || undefined}
            aria-label={title || "Nội dung minh họa"}
        >
            {title ? (
                <h3 className="m-0 font-urbanist text-[16px] font-semibold leading-snug text-[#002B31]">
                    {title}
                </h3>
            ) : null}
            {blocks.map((block, i) => (
                <BlockSlot
                    key={i}
                    block={block}
                    streaming={running && i === blocks.length - 1}
                />
            ))}
            {running && blocks.length === 0 ? <SkeletonLines lines={3} /> : null}
            {hidden > 0 ? (
                <p className="text-[11.5px] text-[#7C9499]">Đã ẩn {hidden} khối vượt giới hạn hiển thị.</p>
            ) : null}
        </section>
    );
}
