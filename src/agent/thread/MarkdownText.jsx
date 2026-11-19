import { memo } from "react";
import { Md } from "@/agent/catalog/Md";
import { cn } from "@/lib/utils";

// Markdown for chat messages (PLAN 4.2: `default MarkdownText({ text })`).
// The parsing pipeline (react-markdown + remark-gfm + remark-math + rehype-katex with
// strict:false/throwOnError:false, KaTeX CSS, no rehype-raw, safe links, images reduced
// to alt text) lives in C's `Md` helper, so tool cards and chat render markdown the same way.
// This wrapper only adds what is specific to the chat column:
// - the legacy `.markdown-container` class (as the old chat did);
// - overrides for rules in src/index.css that would otherwise leak in:
//   `.markdown-container a` (blue #007bff, no underline) and the unscoped
//   `h2, h3, h4, h5, h6 { font-bold mb-5 }` selector (h5/h6 are not covered by Md);
// - a slightly larger reading size, and `<pre>` that scrolls horizontally instead of wrapping.

const CHAT_MD_CLASS = [
    "markdown-container min-w-0 max-w-full text-[14px] leading-[1.65]",
    "[&_p+p]:mt-2.5",
    "[&_a]:text-[#2E5A6E] [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-[#1D3E4B]",
    "[&_h1]:font-urbanist [&_h1]:text-[17px] [&_h1]:font-bold",
    "[&_h2]:font-urbanist [&_h2]:text-[16px] [&_h2]:font-bold",
    "[&_h3]:text-[15px] [&_h4]:text-[14px]",
    "[&_h5]:mb-1 [&_h5]:mt-2 [&_h5]:text-[13.5px] [&_h5]:font-semibold",
    "[&_h6]:mb-1 [&_h6]:mt-2 [&_h6]:text-[13px] [&_h6]:font-semibold [&_h6]:text-[#46595D]",
    "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:break-normal",
    "[&_pre_code]:whitespace-pre [&_pre_code]:break-normal",
].join(" ");

function MarkdownText({ text, className }) {
    return <Md text={text} className={cn(CHAT_MD_CLASS, className)} />;
}

export default memo(MarkdownText);
