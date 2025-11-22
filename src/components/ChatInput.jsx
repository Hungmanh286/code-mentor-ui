import { useState, useRef, useEffect } from 'react';
import useAutosize from '@/hooks/useAutosize';
import sendIcon from '@/assets/images/send.svg';

function ChatInput({ newMessage, isLoading, setNewMessage, submitNewMessage, onToolSelect, selectedTools = [], onRemoveTool }) {
  const textareaRef = useAutosize(newMessage);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  function handleKeyDown(e) {
    if (e.keyCode === 13 && !e.shiftKey && !isLoading) {
      e.preventDefault();
      submitNewMessage();
    }
  }

  const handleToolSelect = (tool) => {
    setShowToolMenu(false);
    if (onToolSelect) {
      onToolSelect(tool);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowToolMenu(false);
      }
    };

    if (showToolMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showToolMenu]);

  return (
    <div id='topi-chat-input' className='sticky bottom-0 bg-white py-4'>
      <div className='p-1.5 bg-primary-blue/35 rounded-3xl z-50 font-mono origin-bottom animate-chat duration-400 relative'>
        {/* Dropdown Menu - positioned outside overflow container */}
        {showToolMenu && (
          <div 
            ref={menuRef}
            className='absolute bottom-full left-4 mb-4 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] overflow-hidden z-[100]'
          >
            <button
              className='w-full px-4 py-3 text-left hover:bg-primary-blue/10 transition-colors flex items-center gap-2 border-b border-gray-100'
              onClick={() => handleToolSelect('generate-questions')}
            >
              <span className='text-lg'>💡</span>
              <span className='text-sm text-gray-700'>Sinh câu hỏi</span>
            </button>
            <button
              className='w-full px-4 py-3 text-left hover:bg-primary-blue/10 transition-colors flex items-center gap-2'
              onClick={() => handleToolSelect('mindmap')}
            >
              <span className='text-lg'>🗺️</span>
              <span className='text-sm text-gray-700'>Mindmap</span>
            </button>
          </div>
        )}

        <div className='pr-0.5 bg-white relative shrink-0 rounded-3xl overflow-hidden ring-primary-blue ring-1 focus-within:ring-2 transition-all'>
          {/* Tool Menu Button */}
          <button
            ref={buttonRef}
            className='absolute top-1/2 -translate-y-1/2 left-3 z-10 w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary-blue/20 transition-colors text-primary-blue font-bold text-xl'
            onClick={() => setShowToolMenu(!showToolMenu)}
            title="Chọn tool"
          >
            +
          </button>

          {/* Selected Tools Display */}
          {selectedTools.length > 0 && (
            <div className='px-12 pt-2 pb-1 flex flex-wrap gap-2'>
              {selectedTools.map((tool) => (
                <div 
                  key={tool.id}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue/10 text-primary-blue rounded-full text-sm border border-primary-blue/20'
                >
                  <span>{tool.icon}</span>
                  <span>{tool.name}</span>
                  <button
                    className='ml-1 hover:bg-primary-blue/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors'
                    onClick={() => onRemoveTool(tool.id)}
                    title="Xóa tool"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className='block w-full max-h-[140px] py-2 px-12 pr-11 bg-white rounded-3xl resize-none placeholder:text-primary-blue placeholder:leading-4 placeholder:-translate-y-1 sm:placeholder:leading-normal sm:placeholder:translate-y-0 focus:outline-none'
            ref={textareaRef}
            rows='1'
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className='absolute top-1/2 -translate-y-1/2 right-3 p-1 rounded-md hover:bg-primary-blue/20'
            onClick={submitNewMessage}
          >
            <img src={sendIcon} alt='send' />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;