import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Small shared building blocks for the generative-UI renderers.
// The shadcn components in src/components/ui reference CSS variables
// (bg-card, bg-primary, …) that this Tailwind v3 setup does not define,
// so every reuse below overrides colors with the tokens from PLAN.md 4.9.

/** Uppercase section label: 10px, tracking .14em, #7C9499. */
export function Label({ className, children, ...props }) {
    return (
        <span
            className={cn(
                "text-[10px] font-semibold uppercase leading-none tracking-[.14em] text-[#7C9499]",
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}

/** Card shell with the design-token border, radius and surface. */
export function Panel({ className, ...props }) {
    return (
        <Card
            className={cn(
                "w-full min-w-0 max-w-full gap-0 rounded-[8px] border border-[#E3E1DC] bg-white text-[#002B31] shadow-none",
                className,
            )}
            {...props}
        />
    );
}

/** Pulsing placeholder lines used while args are still streaming. */
export function SkeletonLines({ lines = 3, className }) {
    const count = Math.max(1, Math.min(8, Number.isInteger(lines) ? lines : 3));
    const widths = ["w-11/12", "w-4/5", "w-3/5", "w-2/3", "w-1/2"];
    return (
        <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <Skeleton
                    key={i}
                    className={cn("h-2.5 rounded-[2px] bg-[#EEF1F2]", widths[i % widths.length])}
                />
            ))}
        </div>
    );
}

const BUTTON_BASE =
    "h-8 gap-1.5 rounded-[7px] px-3 text-[12.5px] shadow-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30 disabled:cursor-not-allowed";
const BUTTON_TONES = {
    outline:
        "border border-[#E3E1DC] bg-white text-[#002B31] hover:bg-[#F4F7F8] hover:text-[#002B31]",
    primary:
        "border border-transparent bg-[#2E5A6E] font-semibold text-white hover:bg-[#1D3E4B] hover:text-white",
    ghost: "border border-transparent bg-transparent text-[#2E5A6E] hover:bg-[#F1F5F6] hover:text-[#1D3E4B]",
};

/** ui/button with design-token colors. `tone`: outline | primary | ghost. */
export function ActionButton({ tone = "outline", className, ...props }) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(BUTTON_BASE, BUTTON_TONES[tone] ?? BUTTON_TONES.outline, className)}
            {...props}
        />
    );
}

/** Copies `value` to the clipboard; shows "Đã chép" / "Không chép được" for 1.5s. */
export function CopyButton({ value, label = "Sao chép", className }) {
    const [state, setState] = useState("idle");
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const handleCopy = async () => {
        let next = "error";
        try {
            const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
            if (clipboard && typeof clipboard.writeText === "function") {
                await clipboard.writeText(typeof value === "string" ? value : "");
                next = "copied";
            }
        } catch {
            next = "error";
        }
        setState(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1500);
    };

    const text = state === "copied" ? "Đã chép" : state === "error" ? "Không chép được" : label;
    return (
        <ActionButton
            tone="ghost"
            className={cn("h-7 px-2 text-[11.5px]", className)}
            onClick={handleCopy}
            disabled={!value}
            aria-label={`${label} đoạn mã`}
        >
            {state === "copied" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span aria-live="polite">{text}</span>
        </ActionButton>
    );
}
