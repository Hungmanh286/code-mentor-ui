import React, { useState } from 'react';

function ChatSessionUUID({ sessionUUID }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(sessionUUID);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error("Copy failed", err);
        }
    };

    return (
        <div className="font-urbanist text-primary-blue text-xl font-light space-y-2 flex items-center">
            <div className="flex items-center">
                {sessionUUID ? (
                    <p>Your session UUID: <span className="font-mono">{sessionUUID}</span></p>
                ) : (
                    <p>Starting new session...</p>
                )}
                <button
                    onClick={handleCopy}
                    className="ml-3 border rounded text-primary-blue hover:bg-gray-200 flex items-center"
                    style={{ marginBottom: "0.5rem" }}
                >
                    {copied ? "✔️" : "📋"}
                </button>
            </div>
        </div>
    );
}

export default ChatSessionUUID;