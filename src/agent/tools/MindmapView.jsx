import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ActionButton, Label, Panel, SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

// Renderer for `show_mindmap`: { title, root: Node }, Node = { id, label, children? }.
// Collapsible tree drawn with plain CSS (connector lines on the left).
// The tree is normalised first with hard limits on depth and node count, so bad
// data (cycles, huge trees, wrong types) can never recurse without bound.

const MAX_DEPTH = 6; // rendered levels: depth 0..5
const MAX_NODES = 400;
const DEFAULT_OPEN_DEPTH = 2; // depth 0 and 1 start expanded

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function buildTree(raw, depth, key, stats) {
    if (!raw || typeof raw !== "object" || stats.count >= MAX_NODES) return null;
    stats.count += 1;
    const label = asText(raw.label).trim();
    const rawChildren = Array.isArray(raw.children)
        ? raw.children.filter((child) => child && typeof child === "object")
        : [];

    if (depth >= MAX_DEPTH - 1) {
        if (rawChildren.length > 0) stats.truncated = true;
        return { key, label, depth, children: [], hiddenChildren: rawChildren.length };
    }

    const children = [];
    for (let i = 0; i < rawChildren.length; i += 1) {
        const child = buildTree(rawChildren[i], depth + 1, `${key}.${i}`, stats);
        if (!child) {
            stats.truncated = true;
            break;
        }
        children.push(child);
    }
    return {
        key,
        label,
        depth,
        children,
        hiddenChildren: rawChildren.length - children.length,
    };
}

function isNodeOpen(view, node) {
    if (has(view.overrides, node.key)) return view.overrides[node.key];
    if (view.mode === "all") return true;
    if (view.mode === "none") return node.depth < 1;
    return node.depth < DEFAULT_OPEN_DEPTH;
}

function TreeNode({ node, view, onToggle }) {
    const hasChildren = node.children.length > 0;
    const open = hasChildren && isNodeOpen(view, node);
    const isRoot = node.depth === 0;
    const label = node.label || "(chưa đặt tên)";

    return (
        <li
            className={cn(
                "relative",
                !isRoot &&
                    "pt-1.5 before:absolute before:-left-3.5 before:top-[18px] before:h-px before:w-3 before:bg-[#E3E1DC]",
            )}
        >
            <div className="flex min-w-0 items-start gap-1.5">
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node)}
                        aria-expanded={open}
                        aria-label={`${open ? "Thu gọn" : "Mở"} nhánh ${label}`}
                        className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-[6px] text-[#7C9499] hover:bg-[#F1F5F6] hover:text-[#2E5A6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30"
                    >
                        <ChevronRight
                            className={cn("size-3.5 transition-transform", open && "rotate-90")}
                            aria-hidden="true"
                        />
                    </button>
                ) : (
                    <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center">
                        <span className="size-1.5 rounded-full bg-[#B9C6C8]" />
                    </span>
                )}
                <span
                    className={cn(
                        "min-w-0 break-words py-0.5",
                        isRoot
                            ? "font-urbanist text-[15px] font-semibold leading-snug"
                            : node.depth === 1
                              ? "text-[13.5px] font-semibold leading-snug"
                              : "text-[13px] leading-snug text-[#22454C]",
                        !node.label && "italic text-[#8FA3A7]",
                    )}
                >
                    {label}
                </span>
                {hasChildren && !open ? (
                    <span className="mt-[3px] shrink-0 rounded-[2px] bg-[#EEF1F2] px-1.5 py-px text-[10.5px] text-[#7C9499]">
                        {node.children.length}
                    </span>
                ) : null}
            </div>
            {node.hiddenChildren > 0 && (open || !hasChildren) ? (
                <p className="ml-7 mt-0.5 text-[11px] text-[#8FA3A7]">
                    … còn {node.hiddenChildren} nhánh không hiển thị
                </p>
            ) : null}
            {open ? (
                <ul className="ml-[10px] border-l border-[#E3E1DC] pl-3.5">
                    {node.children.map((child) => (
                        <TreeNode key={child.key} node={child} view={view} onToggle={onToggle} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

export default function MindmapView({ args, status }) {
    const statusType = status?.type ?? "complete";
    const running = statusType === "running";
    const rawRoot = args?.root;
    const { tree, nodeCount, truncated, expandable } = useMemo(() => {
        const stats = { count: 0, truncated: false };
        const built = buildTree(rawRoot, 0, "0", stats);
        return {
            tree: built,
            nodeCount: stats.count,
            truncated: stats.truncated,
            expandable: Boolean(built && built.children.some((c) => c.children.length > 0)),
        };
    }, [rawRoot]);

    const [view, setView] = useState({ mode: "default", overrides: {} });

    const toggle = (node) =>
        setView((prev) => ({
            ...prev,
            overrides: { ...prev.overrides, [node.key]: !isNodeOpen(prev, node) },
        }));
    const expandAll = () => setView({ mode: "all", overrides: {} });
    const collapseAll = () => setView({ mode: "none", overrides: {} });

    const title = asText(args?.title).trim() || tree?.label || "Sơ đồ tư duy";

    return (
        <Panel aria-busy={running || undefined}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-[#F0EEE9] px-4 py-3">
                <div className="min-w-0 flex-1">
                    <Label>Sơ đồ tư duy</Label>
                    <p className="mt-1 truncate font-urbanist text-[15.5px] font-semibold leading-snug">
                        {title}
                    </p>
                </div>
                {tree ? <span className="text-[11.5px] text-[#7C9499]">{nodeCount} ý</span> : null}
                {tree && expandable && !running ? (
                    <div className="flex items-center gap-1.5">
                        <ActionButton className="h-7 px-2.5 text-[12px]" onClick={expandAll}>
                            Mở hết
                        </ActionButton>
                        <ActionButton className="h-7 px-2.5 text-[12px]" onClick={collapseAll}>
                            Thu gọn
                        </ActionButton>
                    </div>
                ) : null}
            </div>
            <div className="overflow-x-auto px-4 py-3">
                {tree ? (
                    <ul className="min-w-0">
                        <TreeNode node={tree} view={view} onToggle={toggle} />
                    </ul>
                ) : running ? (
                    <SkeletonLines lines={4} />
                ) : (
                    <p className="text-[13px] text-[#7C9499]">Không có dữ liệu sơ đồ.</p>
                )}
                {running ? (
                    <p className="mt-2 text-[11.5px] text-[#7C9499]" aria-live="polite">
                        Đang vẽ sơ đồ…
                    </p>
                ) : null}
                {truncated && !running ? (
                    <p className="mt-2 text-[11.5px] text-[#7C9499]">
                        Sơ đồ quá lớn hoặc quá sâu — chỉ hiển thị tối đa {MAX_DEPTH} cấp và {MAX_NODES} ý.
                    </p>
                ) : null}
            </div>
        </Panel>
    );
}
