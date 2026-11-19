import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

// Internal markdown renderer for the `*_md` fields of tool args.
// Raw HTML is never rendered (no rehype-raw); react-markdown's default
// urlTransform strips unsafe protocols such as `javascript:`.

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [[rehypeKatex, { strict: false, throwOnError: false }]];

function MdLink({ href, title, children }) {
    return (
        <a
            href={href}
            title={title}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2E5A6E] underline underline-offset-2 hover:text-[#1D3E4B]"
        >
            {children}
        </a>
    );
}

// Images from model output are not loaded (avoids tracking / data-exfiltration
// URLs); only their alt text is shown.
function MdImage({ alt }) {
    return alt ? <span className="text-[#7C9499]">[Ảnh: {alt}]</span> : null;
}

const COMPONENTS = { a: MdLink, img: MdImage };

const MD_CLASS = [
    "min-w-0 break-words text-[13.5px] leading-[1.65] text-[#002B31]",
    "[&_p]:my-0 [&_p+p]:mt-2 [&_strong]:font-semibold",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
    "[&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-[15px] [&_h1]:font-semibold",
    "[&_h2]:mb-1.5 [&_h2]:mt-2 [&_h2]:text-[14.5px] [&_h2]:font-semibold",
    "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[14px] [&_h3]:font-semibold",
    "[&_h4]:mb-1 [&_h4]:mt-2 [&_h4]:text-[13.5px] [&_h4]:font-semibold",
    "[&_code]:font-mono [&_code]:text-[12.5px]",
    "[&_:not(pre)>code]:rounded-[2px] [&_:not(pre)>code]:bg-[#F1F5F6] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px",
    "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[6px] [&_pre]:border [&_pre]:border-[#E7E5E0] [&_pre]:bg-[#F7F6F3] [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:leading-[1.6]",
    "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[#E3E1DC] [&_blockquote]:pl-3 [&_blockquote]:text-[#46595D]",
    "[&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse",
    "[&_th]:border [&_th]:border-[#E7E5E0] [&_th]:bg-[#FBFAF8] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
    "[&_td]:border [&_td]:border-[#E7E5E0] [&_td]:px-2 [&_td]:py-1",
    "[&_hr]:my-3 [&_hr]:border-[#E7E5E0]",
    "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1",
].join(" ");

export function Md({ text, className }) {
    const source =
        typeof text === "string"
            ? text
            : typeof text === "number" && Number.isFinite(text)
              ? String(text)
              : "";
    if (!source.trim()) return null;
    return (
        <div className={cn(MD_CLASS, className)}>
            <Markdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
                components={COMPONENTS}
            >
                {source}
            </Markdown>
        </div>
    );
}

export default Md;
