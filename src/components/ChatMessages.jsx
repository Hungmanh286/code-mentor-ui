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
      return <Spinner />;
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
