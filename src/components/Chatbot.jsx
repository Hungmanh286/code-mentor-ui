import { useEffect, useState } from 'react';
import { useImmer } from 'use-immer';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import ChatSessionUUID from './ChatSessionUUID';
import { useWebSocket } from '@/websocket';
import { useLangGraphInterrupt } from "@copilotkit/react-core";

// Add console logs to debug component mounting
function Chatbot({ onSessionUUID, sessionId }) {
  console.log("Chatbot component rendering with:", { sessionId });
  const [messages, setMessages] = useImmer([]);
  const [newMessage, setNewMessage] = useState('');

  // Use provided sessionId if available
  const { response, nextQuestions, error, errorCode, isOpen, isLoading, userInfo, sessionUUID, sendMessage, setError } = useWebSocket(sessionId);

  // Log the session ID received from props
  useEffect(() => {
    if (sessionId) {
      console.log("Received sessionId from props:", sessionId);
    }
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

  // For displaying, prioritize the sessionId from URL over the generated sessionUUID
  const displayUUID = sessionId || sessionUUID;

  return (
    <div className='relative grow flex flex-col gap-6'>
      <ChatSessionUUID sessionUUID={displayUUID} />
      {messages.length === 0 && (
        <div className='mt-3 font-urbanist text-primary-blue text-xl font-light space-y-2'>
          <p>👋 Welcome {userInfo.username}!</p>
          <p>Ask me anything about programming.</p>
        </div>
      )}
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        setNewMessage={setNewMessage}
      />
      <ChatInput
        newMessage={newMessage}
        isLoading={isLoading}
        setNewMessage={setNewMessage}
        submitNewMessage={submitNewMessage}
      />
    </div>
  );
}

export default Chatbot;