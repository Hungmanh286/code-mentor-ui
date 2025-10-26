import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Element } from "react-scroll";
import Chatbot from "../components/Chatbot";
import SourcePanel from "../components/SourcePanel";
import StudioDashboard from "../components/StudioDashboard";
import CustomScrollbar from "../components/CustomScrollbar";

function SessionPage() {
    const { sessionId } = useParams();
    const [sessionUUID, setSessionUUID] = useState(sessionId || null);
    const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
    const [studioDashboardCollapsed, setStudioDashboardCollapsed] = useState(false);

    useEffect(() => {
        if (sessionId) {
            console.log("Session page loaded with session ID:", sessionId);
            setSessionUUID(sessionId);
        }
    }, [sessionId]);

    const handleSessionUUID = (uuid) => {
        if (!sessionId && uuid) {
            setSessionUUID(uuid);
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* LEFT: Source Panel */}
            <div
                className={`
          flex flex-col border-r border-gray-200 transition-all relative
          ${sourcePanelCollapsed ? "w-12" : "w-1/3"}
        `}
            >
                {/* ✅ scroll riêng biệt và chắc chắn có chiều cao */}
                <div
                    id="source-panel-container"
                    className="flex-1 overflow-y-scroll h-full"
                    style={{
                        scrollbarWidth: "none", // Hide default scrollbar
                        msOverflowStyle: "none", // Hide scrollbar for IE and Edge
                    }}
                >
                    <style>
                        {`#source-panel-container::-webkit-scrollbar { display: none; }`}
                    </style>
                    <SourcePanel
                        onCollapsedChange={setSourcePanelCollapsed}
                        sessionUUID={sessionUUID}
                    />
                    <Element name="source-bottom" className="py-4">
                        <div className="p-4 text-center text-gray-400">
                            Source Panel Content End
                        </div>
                    </Element>
                </div>
                {!sourcePanelCollapsed && (
                    <CustomScrollbar containerId="source-panel-container" />
                )}
            </div>

            {/* MIDDLE: Chat Area */}
            <main
                className={`
          flex flex-col transition-all relative
          ${sourcePanelCollapsed && studioDashboardCollapsed
                        ? "w-full"
                        : sourcePanelCollapsed || studioDashboardCollapsed
                            ? "w-2/3"
                            : "w-1/3"
                    }
        `}
            >
                <div
                    id="chat-container"
                    className="flex-1 overflow-y-scroll p-4 bg-white h-full"
                    style={{
                        scrollbarWidth: "none", // Hide default scrollbar
                        msOverflowStyle: "none", // Hide scrollbar for IE and Edge
                    }}
                >
                    <style>
                        {`#chat-container::-webkit-scrollbar { display: none; }`}
                    </style>
                    <Chatbot
                        key={sessionId || sessionUUID || "new-session"}
                        onSessionUUID={handleSessionUUID}
                        sessionId={sessionId}
                    />
                    <Element name="chat-bottom" className="py-4">
                        <div className="p-4 text-center text-gray-400">
                            Chat Content End
                        </div>
                    </Element>
                </div>
                <CustomScrollbar containerId="chat-container" />
            </main>

            {/* RIGHT: Studio Dashboard */}
            <div
                className={`
          flex flex-col border-l border-gray-200 transition-all relative
          ${studioDashboardCollapsed ? "w-12" : "w-1/3"}
        `}
            >
                <div
                    id="studio-dashboard-container"
                    className="flex-1 overflow-y-scroll h-full"
                    style={{
                        scrollbarWidth: "none", // Hide default scrollbar
                        msOverflowStyle: "none", // Hide scrollbar for IE and Edge
                    }}
                >
                    <style>
                        {`#studio-dashboard-container::-webkit-scrollbar { display: none; }`}
                    </style>
                    <StudioDashboard
                        onCollapsedChange={setStudioDashboardCollapsed}
                        sessionUUID={sessionUUID}
                    />
                    <Element name="studio-bottom" className="py-4">
                        <div className="p-4 text-center text-gray-400">
                            Studio Dashboard Content End
                        </div>
                    </Element>
                </div>
                {!studioDashboardCollapsed && (
                    <CustomScrollbar containerId="studio-dashboard-container" />
                )}
            </div>
        </div>
    );
}

export default SessionPage;
