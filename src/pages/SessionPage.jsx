import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
// Ensure components are imported correctly with console logs to verify loading
import Chatbot from '../components/Chatbot';
import SourcePanel from '../components/SourcePanel';
import StudioDashboard from '../components/StudioDashboard';

function SessionPage() {
    const { sessionId } = useParams(); // Extract sessionId from URL parameter
    const [sessionUUID, setSessionUUID] = useState(sessionId || null);
    const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
    const [studioDashboardCollapsed, setStudioDashboardCollapsed] = useState(false);

    // Log the session ID when it's available from URL and use it as sessionUUID
    useEffect(() => {
        if (sessionId) {
            console.log("Session page loaded with session ID:", sessionId);
            setSessionUUID(sessionId); // Set sessionUUID to be the URL parameter sessionId
        }
    }, [sessionId]);

    // Handle session UUID updates from Chatbot component
    // Only update if we don't already have a sessionId from the URL
    const handleSessionUUID = (uuid) => {
        if (!sessionId && uuid) {
            setSessionUUID(uuid);
        }
    };

    return (
        <div className="flex h-screen bg-white">
            {/* Source Panel (left sidebar) - 1/3 width */}
            <div className={`w-1/3 ${sourcePanelCollapsed ? 'w-12' : 'w-1/3'} transition-all`}>
                <SourcePanel
                    onCollapsedChange={setSourcePanelCollapsed}
                    sessionUUID={sessionUUID}
                />
            </div>

            {/* Main Chat Area - expands when side panels are collapsed */}
            <main className={`${sourcePanelCollapsed && studioDashboardCollapsed ? 'w-full' :
                (sourcePanelCollapsed || studioDashboardCollapsed) ? 'w-2/3' : 'w-1/3'
                } flex flex-col overflow-hidden transition-all`}>
                <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white">
                    <Chatbot
                        key={sessionId || sessionUUID || 'new-session'}
                        onSessionUUID={handleSessionUUID}
                        sessionId={sessionId} // Only pass the session ID from URL parameter
                    />
                </div>
            </main>

            {/* Studio Dashboard (right sidebar) - 1/3 width */}
            <div className={`w-1/3 ${studioDashboardCollapsed ? 'w-12' : 'w-1/3'} transition-all`}>
                <StudioDashboard
                    onCollapsedChange={setStudioDashboardCollapsed}
                    sessionUUID={sessionUUID}
                />
            </div>
        </div>
    );
}

export default SessionPage;