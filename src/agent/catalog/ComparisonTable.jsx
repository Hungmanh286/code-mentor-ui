import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SkeletonLines } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";

const MAX_COLUMNS = 12;
const MAX_ROWS = 100;

function asText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Có" : "Không";
    return "";
}

// { type: "comparison_table", columns: string[], rows: string[][], highlight_col?: number }
export default function ComparisonTable({ block, streaming = false }) {
    const columns = Array.isArray(block?.columns)
        ? block.columns.slice(0, MAX_COLUMNS).map(asText)
        : [];
    const rows = Array.isArray(block?.rows)
        ? block.rows
              .filter(Array.isArray)
              .slice(0, MAX_ROWS)
              .map((row) => row.slice(0, MAX_COLUMNS).map(asText))
        : [];
    const width = Math.max(columns.length, ...rows.map((row) => row.length), 0);
    const highlight =
        Number.isInteger(block?.highlight_col) &&
        block.highlight_col >= 0 &&
        block.highlight_col < width
            ? block.highlight_col
            : -1;

    if (width === 0) {
        return streaming ? (
            <SkeletonLines lines={4} />
        ) : (
            <p className="text-[12.5px] text-[#7C9499]">Bảng chưa có dữ liệu.</p>
        );
    }

    const colIndexes = Array.from({ length: width }, (_, i) => i);
    const cellClass = (i) =>
        cn(
            "min-w-[140px] whitespace-normal px-3 py-2 align-top text-[13px] leading-[1.5]",
            i === 0 && "font-semibold text-[#46595D]",
            i === highlight && "bg-[#F1F5F6]",
        );

    return (
        <div className="w-full min-w-0 overflow-hidden rounded-[8px] border border-[#E3E1DC] bg-white">
            <Table className="text-[#002B31]">
                {columns.length > 0 && (
                    <TableHeader className="[&_tr]:border-[#E7E5E0]">
                        <TableRow className="border-[#E7E5E0] hover:bg-transparent">
                            {colIndexes.map((i) => (
                                <TableHead
                                    key={i}
                                    scope="col"
                                    className={cn(
                                        "h-auto min-w-[140px] whitespace-normal bg-[#FBFAF8] px-3 py-2 align-bottom text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#7C9499]",
                                        i === highlight && "bg-[#EEF1F2] text-[#2E5A6E]",
                                    )}
                                >
                                    {columns[i] ?? ""}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                )}
                <TableBody>
                    {rows.map((row, r) => (
                        <TableRow key={r} className="border-[#E7E5E0] hover:bg-[#FBFAF8]">
                            {colIndexes.map((i) => (
                                <TableCell key={i} className={cellClass(i)}>
                                    {row[i] ?? ""}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                    {streaming && (
                        <TableRow className="border-0 hover:bg-transparent">
                            <TableCell colSpan={width} className="px-3 py-2">
                                <SkeletonLines lines={1} />
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
