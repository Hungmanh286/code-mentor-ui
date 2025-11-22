import React, { useState, useEffect, useRef } from 'react';
import { useImmer } from 'use-immer';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import ChatSessionUUID from './ChatSessionUUID';
import { useWebSocket } from '@/websocket';
import { useLangGraphInterrupt } from "@copilotkit/react-core";
import CustomScrollbar from './CustomScrollbar';

// Add console logs to debug component mounting
const Chatbot = ({ onSessionUUID, sessionId }) => {
  console.log("Chatbot component rendering with:", { sessionId });
  const [messages, setMessages] = useImmer([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedTools, setSelectedTools] = useState([]);

  // Use provided sessionId if available
  const { response, nextQuestions, error, errorCode, isOpen, isLoading, userInfo, sessionUUID, sendMessage, setError } = useWebSocket(sessionId);

  // Log the session ID received from props
  useEffect(() => {
    if (sessionId) {
      console.log("Received sessionId from props:", sessionId);
    }
  }, [sessionId]);

  // Fetch chat history when sessionId is available
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!sessionId) return;

      try {
        setIsLoadingHistory(true);
        const response = await fetch(`http://0.0.0.0:8686/history-chat/${sessionId}`);
        const data = await response.json();

        if (data.history && data.history.length > 0) {
          const historyMessages = [];
          data.history.forEach(item => {
            if (item.question) {
              historyMessages.push({
                role: 'user',
                content: item.question,
                error: "",
                errorCode: 0
              });
            }
            if (item.answer) {
              historyMessages.push({
                role: 'bot',
                content: item.answer,
                sources: [],
                nextQuestions: [],
                error: "",
                errorCode: 0
              });
            }
          });
          setMessages(historyMessages);
          console.log("Loaded chat history:", historyMessages.length, "messages");
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchChatHistory();
  }, [sessionId]);

  // Truyền sessionUUID lên component cha mỗi khi có thay đổi
  useEffect(() => {
    if (sessionUUID && onSessionUUID) {
      onSessionUUID(sessionUUID);
      console.log("Session UUID đã được truyền lên:", sessionUUID);
    }
  }, [sessionUUID, onSessionUUID]);

  useLangGraphInterrupt({
    render: ({ event, resolve }) => (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded mb-4">
        <p className="mb-2 text-yellow-800">{event.value}</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          resolve(e.target.response.value);
        }}>
          <input type="text" name="response" placeholder="Enter your response" className="border rounded px-2 py-1 mr-2" />
          <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">Submit</button>
        </form>
      </div>
    )
  });

  useEffect(() => {
    const updateMessages = (updates) => {
      setMessages((draft) => {
        const lastMessage = draft[draft.length - 1];
        if (lastMessage && lastMessage.role === 'bot') {
          Object.assign(lastMessage, updates);
        } else {
          draft.push({ role: 'bot', ...updates });
        }
      });
    };

    if (response) {
      updateMessages({ content: response, error: "" });
    }
    if (nextQuestions && nextQuestions.length > 0) {
      updateMessages({ nextQuestions });
    }
    if (error) {
      updateMessages({ content: "", error: error });
    }
    if (errorCode) {
      updateMessages({ errorCode });
    }
  }, [response, nextQuestions, error, errorCode]);

  async function submitNewMessage() {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || isLoading) return;

    setMessages(draft => [...draft,
    { role: 'user', content: trimmedMessage, error: "", errorCode: 0 },
    { role: 'bot', content: '', sources: [], nextQuestions: [], error: "", errorCode: 0 }
    ]);

    setNewMessage('');

    try {
      if (isOpen) {
        sendMessage(trimmedMessage);
      }
    } catch (err) {
      console.log(err);
      setError("An error occurred while creating the answer.");
    }
  }

  function handleToolSelect(tool) {
    console.log("Tool selected:", tool);
    
    // Chỉ thêm tool vào danh sách hiển thị, không gửi message
    if (!selectedTools.find(t => t.id === tool)) {
      const toolInfo = {
        id: tool,
        name: tool === 'generate-questions' ? 'Sinh câu hỏi' : 'Mindmap',
        icon: tool === 'generate-questions' ? '💡' : '🗺️'
      };
      setSelectedTools([...selectedTools, toolInfo]);
    }
  }

  function handleRemoveTool(toolId) {
    setSelectedTools(selectedTools.filter(t => t.id !== toolId));
  }

  // For displaying, prioritize the sessionId from URL over the generated sessionUUID
  const displayUUID = sessionId || sessionUUID;

  return (
    <div className="flex flex-col h-full relative">
      <ChatSessionUUID sessionUUID={displayUUID} />
      {/* Chat messages container with custom scroll */}
      <div
        id="chatbot-messages-container"
        className="flex-1 overflow-y-scroll"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>
          {`#chatbot-messages-container::-webkit-scrollbar { display: none; }`}
        </style>

        {/* Chat messages content */}
        <div className="p-4 space-y-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Đang tải lịch sử chat...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className='mt-3 font-urbanist text-primary-blue text-xl font-light space-y-2'>
              <p>👋 Welcome {userInfo.username}!</p>
              <p>Ask me anything about programming.</p>
            </div>
          ) : null}
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            setNewMessage={setNewMessage}
          />
        </div>
      </div>

      {/* Custom scrollbar for chat messages */}
      <CustomScrollbar containerId="chatbot-messages-container" />

      {/* Input area - fixed at bottom */}
      <div className="border-t bg-white p-4">
        <ChatInput
          newMessage={newMessage}
          isLoading={isLoading}
          setNewMessage={setNewMessage}
          submitNewMessage={submitNewMessage}
          onToolSelect={handleToolSelect}
          selectedTools={selectedTools}
          onRemoveTool={handleRemoveTool}
        />
      </div>
    </div>
  );
};

export default Chatbot;