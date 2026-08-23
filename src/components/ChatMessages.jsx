import { useState, useEffect, memo } from 'react';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import Spinner from '@/components/Spinner';
import 'katex/dist/katex.min.css';

function BotAvatar() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-lg bg-accent flex items-center justify-center" aria-hidden="true">
      <svg className="w-[15px] h-[15px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6 3.5 12 8 18" />
        <path d="m16 6 4.5 6L16 18" />
      </svg>
    </div>
  );
}

function ChatMessages({ messages, isLoading, setNewMessage }) {
  const [markdownError, setMarkdownError] = useState(false);

  // iOS cũ (<12) không render nổi markdown đã dựng — rơi về text thuần.
  useEffect(() => {
    const agent = window.navigator.userAgent;
    const start = agent.indexOf('OS ');
    if ((agent.indexOf('iPhone') > -1 || agent.indexOf('iPad') > -1) && start > -1) {
      const version = window.Number(agent.slice(start + 3, start + 6).replace('_', '.'));
      if (version > 0 && version < 12) setMarkdownError(true);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
      {messages.map(({ role, content, nextQuestions, error }, idx) => {
        if (role === 'user') {
          return (
            <div key={idx} className="self-end max-w-[85%] sm:max-w-[70%] py-3 px-4 rounded-[13px] rounded-br-[3px]
                                      bg-primary-blue/25 text-[14px] leading-relaxed whitespace-pre-line">
              {content}
            </div>
          );
        }

        const waiting = isLoading && !content && !error;

        return (
          <div key={idx} className="flex gap-3.5 max-w-full">
            <BotAvatar />
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="markdown-container text-[14px]">
                {waiting ? (
                  <Spinner />
                ) : markdownError ? (
                  <div className="whitespace-pre-wrap">{content}</div>
                ) : (
                  <Markdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  >
                    {content}
                  </Markdown>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 py-2.5 px-3 rounded-lg border border-error-red/25 bg-error-red/5">
                  <svg className="w-4 h-4 shrink-0 mt-px text-error-red" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" />
                  </svg>
                  <span className="text-[13px] leading-relaxed text-error-red">{error}</span>
                </div>
              )}

              {nextQuestions && nextQuestions.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  <span className="label-caps">Hỏi tiếp</span>
                  <div className="flex flex-wrap gap-2">
                    {nextQuestions.map((question, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNewMessage(question)}
                        className="py-1.5 px-3 rounded-full border border-hairline bg-panel text-[12.5px]
                                   text-accent hover:bg-accent-tint hover:border-accent/40 transition-colors text-left"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ChatMessages);
