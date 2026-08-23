import useAutosize from '@/hooks/useAutosize';

function ChatInput({ newMessage, isLoading, setNewMessage, submitNewMessage, placeholder }) {
  const textareaRef = useAutosize(newMessage);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      submitNewMessage();
    }
  }

  return (
    <div className="shrink-0 px-4 sm:px-6 lg:px-12 pb-5 pt-3.5">
      <div className="mx-auto max-w-3xl flex items-end gap-3 py-2.5 px-3.5 bg-panel border border-hairline
                      rounded-xl shadow-[0_1px_3px_rgba(0,43,49,0.05)] focus-within:border-accent transition-colors">
        <textarea
          ref={textareaRef}
          rows="1"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Hỏi về tài liệu đang bật…'}
          aria-label="Câu hỏi của bạn"
          className="flex-1 max-h-[140px] py-1 bg-transparent resize-none text-[14px] leading-relaxed
                     placeholder:text-muted-soft focus:outline-none"
        />
        <button
          type="button"
          onClick={submitNewMessage}
          disabled={isLoading || !newMessage.trim()}
          aria-label="Gửi câu hỏi"
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-accent text-white
                     hover:bg-accent-strong disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 14-7-5.5 14L11 13z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
