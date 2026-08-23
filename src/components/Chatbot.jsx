import { useState, useEffect } from 'react';
import { useImmer } from 'use-immer';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import useAutoScroll from '@/hooks/useAutoScroll';
import { useWebSocket } from '@/websocket';
import { useLangGraphInterrupt } from '@copilotkit/react-core';

const Chatbot = ({ onSessionUUID, sessionId }) => {
  const [messages, setMessages] = useImmer([]);
  const [newMessage, setNewMessage] = useState('');

  const {
    response, nextQuestions, error, errorCode, isOpen, isLoading,
    userInfo, sessionUUID, sendMessage, setError,
  } = useWebSocket(sessionId);

  const scrollRef = useAutoScroll(messages, isLoading, response);

  useEffect(() => {
    if (sessionUUID && onSessionUUID) onSessionUUID(sessionUUID);
  }, [sessionUUID, onSessionUUID]);

  useLangGraphInterrupt({
    render: ({ event, resolve }) => (
      <div className="mx-auto w-full max-w-3xl p-4 rounded-xl border border-primary-orange bg-primary-orange/15">
        <p className="mb-2.5 text-[13.5px] leading-relaxed">{event.value}</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); resolve(e.target.response.value); }}
        >
          <input
            type="text"
            name="response"
            placeholder="Nhập câu trả lời"
            className="flex-1 h-9 px-3 rounded-lg border border-hairline bg-panel text-[13px] focus:outline-none focus:border-accent"
          />
          <button type="submit" className="h-9 px-3.5 rounded-lg bg-accent text-white text-[13px] font-semibold">
            Gửi
          </button>
        </form>
      </div>
    ),
  });

  useEffect(() => {
    const updateLastBotMessage = (updates) => {
      setMessages((draft) => {
        const last = draft[draft.length - 1];
        if (last && last.role === 'bot') Object.assign(last, updates);
        else draft.push({ role: 'bot', ...updates });
      });
    };
    if (response) updateLastBotMessage({ content: response, error: '' });
    if (nextQuestions && nextQuestions.length > 0) updateLastBotMessage({ nextQuestions });
    if (error) updateLastBotMessage({ content: '', error });
    if (errorCode) updateLastBotMessage({ errorCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, nextQuestions, error, errorCode]);

  function submitNewMessage() {
    const trimmed = newMessage.trim();
    if (!trimmed || isLoading) return;

    // Trước đây khi socket chưa mở thì hàm này im lặng không làm gì: câu hỏi
    // của người dùng hiện lên rồi biến mất, không báo lỗi, không gửi lại.
    if (!isOpen) {
      setMessages((draft) => [
        ...draft,
        { role: 'user', content: trimmed, error: '', errorCode: 0 },
        {
          role: 'bot', content: '', sources: [], nextQuestions: [], errorCode: 0,
          error: 'Mất kết nối tới máy chủ nên chưa gửi được câu hỏi. Đợi kết nối lại rồi gửi lại giúp mình.',
        },
      ]);
      setNewMessage('');
      return;
    }

    setMessages((draft) => [
      ...draft,
      { role: 'user', content: trimmed, error: '', errorCode: 0 },
      { role: 'bot', content: '', sources: [], nextQuestions: [], error: '', errorCode: 0 },
    ]);
    setNewMessage('');

    try {
      sendMessage(trimmed);
    } catch (err) {
      console.error(err);
      setError('Có lỗi xảy ra khi tạo câu trả lời.');
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-12 pt-7 pb-2">
        {messages.length === 0 ? (
          <div className="mx-auto w-full max-w-3xl pt-6">
            <h2 className="font-urbanist text-[26px] font-semibold tracking-[-0.02em]">
              Chào {userInfo.username || 'bạn'}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-main-text/60 max-w-md">
              Bật những tài liệu bạn muốn hỏi ở mục Nguồn, rồi đặt câu hỏi — câu trả lời sẽ bám theo đúng
              nội dung trong đó.
            </p>
            {!isOpen && (
              <p className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-orange animate-pulse" />
                Đang kết nối tới máy chủ…
              </p>
            )}
          </div>
        ) : (
          <ChatMessages messages={messages} isLoading={isLoading} setNewMessage={setNewMessage} />
        )}
      </div>

      <ChatInput
        newMessage={newMessage}
        isLoading={isLoading}
        setNewMessage={setNewMessage}
        submitNewMessage={submitNewMessage}
      />
    </div>
  );
};

export default Chatbot;
