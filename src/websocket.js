import { useEffect, useRef, useState, useCallback } from 'react';
import { useImmer } from 'use-immer';

const BASE_URL = import.meta.env.VITE_CHAT_URL;
const SAMPLE_TOKEN = import.meta.env.VITE_CHAT_TOKEN;

export const useWebSocket = () => {
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');
    const [errorCode, setErrorCode] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [nextQuestions, setNextQuestions] = useImmer([]);
    const [userInfo, setUserInfo] = useImmer({});
    const [sessionUUID, setSessionUUID] = useState('');
    const sessionUUIDRef = useRef('');

    const socketRef = useRef(null);
    const messageQueueRef = useRef('');
    const retryCountRef = useRef(0);
    const maxRetries = 1200;

    const updateSessionUUID = (newSession) => {
        if (!sessionUUIDRef.current) {
            sessionUUIDRef.current = newSession;
            setSessionUUID(newSession);
            console.log('WebSocket opened session:', newSession);
        } else {
            console.log('WebSocket reconnected to session:', sessionUUIDRef.current);
        }
    };

    const connectSocket = useCallback(() => {
        const socket = new WebSocket(`${BASE_URL}/chat/pedagogical?token=${SAMPLE_TOKEN}`);
        socketRef.current = socket;

        socket.onopen = () => {
            setIsOpen(true);
            retryCountRef.current = 0;
            if (messageQueueRef.current) {
                sendMessage(messageQueueRef.current);
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket received:", data); // Debug log

                if (data.role === 'bot') {
                    switch (data.type) {
                        case 'info': {
                            console.log('INFO:', data);
                            if (data.session) {
                                updateSessionUUID(data.session);
                            }
                            setUserInfo(JSON.parse(data.content));
                            break;
                        }
                        case 'start':
                            setError('');
                            setErrorCode(0);
                            break;
                        case 'stream':
                            setResponse(prevResponse => prevResponse + data.content);
                            break;
                        case 'suggest':
                            const suggestions = JSON.parse(data.content);
                            if (suggestions?.length > 0) {
                                setNextQuestions(suggestions);
                            }
                            break;
                        case 'error':
                            setError(data.content);
                            setErrorCode(data.error_code);
                            setIsLoading(false);
                            break;
                        case 'end':
                            setIsLoading(false);
                            break;
                        case 'interrupt':
                            console.log('Interrupt event received:', data); // In ra terminal/console
                            window.dispatchEvent(
                                new CustomEvent("copilotkit-interrupt", { detail: data })
                            );
                            break;
                        default:
                            break;
                    }
                }
            } catch (error) {
                console.error("WebSocket message error:", error);
                setError("Error parsing WebSocket message");
                setErrorCode(503);
                setIsLoading(false);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed', sessionUUIDRef.current);
            setIsOpen(false);

            if (retryCountRef.current < maxRetries) {
                retryCountRef.current += 1;
                console.log(`Attempting to reconnect (${retryCountRef.current}/${maxRetries}) in 3 seconds...`);
                setTimeout(connectSocket, 3000);
            } else {
                console.log('Max reconnection attempts reached. Stopping reconnection.');
            }
        };

        socket.onerror = (error) => {
            console.log(`WebSocket session ${sessionUUIDRef.current} error:`, error);
        };
    }, []);

    useEffect(() => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            connectSocket();
        }

        return () => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.close();
            }
        };
    }, [connectSocket]);

    const sendMessage = useCallback((message) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const payload = {
                uuid: sessionUUIDRef.current,
                content: message
            };
            setIsLoading(true);
            setResponse('');
            setNextQuestions([]);
            socketRef.current.send(JSON.stringify(payload));
        } else {
            console.log('WebSocket connection is not open, queuing message:', message);
            messageQueueRef.current = message;
        }
    }, []);

    return { response, nextQuestions, error, errorCode, isOpen, isLoading, userInfo, sessionUUID, sendMessage, setError };
};
