import React, { useState, useEffect, memo } from 'react';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
// import remarkGfm from 'remark-gfm';
import useAutoScroll from '@/hooks/useAutoScroll';
import Spinner from '@/components/Spinner';
import userIcon from '@/assets/images/user.svg';
import errorIcon from '@/assets/images/error.svg';
import 'katex/dist/katex.min.css';


function ChatMessages({ messages, isLoading, setNewMessage }) {
  const [markdownError, setMarkdownError] = useState(false);
  const scrollContentRef = useAutoScroll(isLoading);

  useEffect(() => {
    const checkIOSVersion = () => {
      var agent = window.navigator.userAgent,
        start = agent.indexOf('OS ');
      if ((agent.indexOf('iPhone') > -1 || agent.indexOf('iPad') > -1) && start > -1) {
        return window.Number(agent.slice(start + 3, start + 6).replace('_', '.'));
      }
      return 0;
    };

    const iosVersion = checkIOSVersion();

    if (iosVersion > 0 && iosVersion < 12) {
      console.log('Markdown rendering not supported');
      setMarkdownError(true);
    }
  }, []);

  const renderContent = (role, content, nextQuestions) => {
    if (isLoading && !content) {
      return (
        <div className="flex items-center gap-3">
          <style>
            {`
              @keyframes bounce-gentle {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
              }
              @keyframes dot-bounce {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                40% { transform: translateY(-8px); opacity: 1; }
              }
              @keyframes shimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
              }
              .thinking-emoji {
                animation: bounce-gentle 1.4s ease-in-out infinite;
                display: inline-block;
                font-size: 1.5rem;
              }
              .thinking-text {
                background: linear-gradient(
                  90deg,
                  #6b7280 25%,
                  #3b82f6 50%,
                  #6b7280 75%
                );
                background-size: 200% auto;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: shimmer 2s linear infinite;
                font-weight: 500;
                font-size: 0.95rem;
              }
              .dot {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #3b82f6;
                margin: 0 2px;
                animation: dot-bounce 1.4s infinite ease-in-out;
              }
              .dot:nth-child(1) { animation-delay: 0s; }
              .dot:nth-child(2) { animation-delay: 0.2s; }
              .dot:nth-child(3) { animation-delay: 0.4s; }
            `}
          </style>
          <div className="flex items-center gap-2">
            <span className="thinking-text">I am thinking</span>
            <div className="flex items-center gap-0">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      );
    }
    if (role === 'bot') {
      return (
        <div>
          {
            markdownError ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {content}
              </div>
            ) : (
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}>
                {content}
              </Markdown>
            )
          }

          {nextQuestions && nextQuestions.length > 0 &&
            <div className="next-questions">
              <div>
                <h3 className='next-question-header'>Câu hỏi liên quan</h3>
              </div>
              {nextQuestions.map((question, index) => (
                <a key={index} href="#" className="question-link" onClick={(e) => { e.preventDefault(); setNewMessage(e.target.innerText); }}>
                  {question}
                </a>
              ))}
            </div>
          }
        </div>
      );
    }
    return <div className='whitespace-pre-line'>{content}</div>;
  };

  return (
    <div ref={scrollContentRef} className='grow space-y-4'>
      {messages.map(({ role, content, nextQuestions, error, errorCode }, idx) => (
        <div key={idx} className={`flex items-start gap-4 py-4 px-3 rounded-xl ${role === 'user' ? 'bg-primary-blue/10' : ''}`}>
          {role === 'user' && (
            <img
              className='h-[26px] w-[26px] shrink-0'
              src={userIcon}
              alt='user'
            />
          )}
          <div>
            <div className='markdown-container'>
              {renderContent(role, content, nextQuestions)}
            </div>
            {error && (
              <div className={`flex items-center gap-1 text-sm text-error-red ${content && 'mt-2'}`}>
                <img className='h-5 w-5' src={errorIcon} alt='error' />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(ChatMessages);
