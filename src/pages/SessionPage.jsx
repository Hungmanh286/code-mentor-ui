import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Element } from "react-scroll";
import Chatbot from "../components/Chatbot";
import SourcePanel from "../components/SourcePanel";
import StudioDashboard from "../components/StudioDashboard";
import CustomScrollbar from "../components/CustomScrollbar";
import AgentChat from "../components/AgentChat";
import MentorRuntimeProvider from "@/agent/MentorRuntimeProvider";
import { USE_AGUI } from "@/config";

// Luồng chat cũ (WebSocket), dùng khi VITE_USE_AGUI tắt. Giữ nguyên như trước khi có AG-UI.
function LegacySessionPage() {
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

const NO_TOOLS = [];

// threadId của phiên mới (PLAN 4.3). crypto.randomUUID chỉ có trong secure context
// (https hoặc localhost); mở app qua http://<IP LAN> thì dùng getRandomValues tạo UUID v4.
function createThreadId() {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Luồng AG-UI (VITE_USE_AGUI=true): cả layout 3 cột nằm trong MentorRuntimeProvider (PLAN 4.2),
// để Studio (E2) đọc được state của agent. threadId = sessionId trên URL, phiên mới thì tạo một lần
// mỗi lần mount. Provider tự mount lại cây con khi threadId đổi.
function AgentSessionPage() {
    const { sessionId } = useParams();
    const [newThreadId] = useState(createThreadId);
    const threadId = sessionId ?? newThreadId;
    const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
    const [studioDashboardCollapsed, setStudioDashboardCollapsed] = useState(false);

    // Chip công cụ ở composer (PLAN 6.B.5). State để render; ref để getExtraContext đọc giá trị mới
    // nhất lúc gửi mà không đổi identity. Gắn theo threadId nên đổi phiên thì danh sách về rỗng
    // (giống Chatbot cũ, vốn được key theo phiên).
    const toolsRef = useRef({ threadId, tools: NO_TOOLS });
    const [toolSelection, setToolSelection] = useState({ threadId, tools: NO_TOOLS });
    const selectedTools = toolSelection.threadId === threadId ? toolSelection.tools : NO_TOOLS;

    const handleToolsChange = useCallback(
        (tools) => {
            const next = { threadId, tools: Array.isArray(tools) ? tools : NO_TOOLS };
            toolsRef.current = next;
            setToolSelection(next);
        },
        [threadId],
    );

    // PLAN 4.4: mọi value là JSON string. Được gọi lúc gửi mỗi run.
    const getExtraContext = useCallback(() => {
        const current = toolsRef.current;
        const tools = current.threadId === threadId ? current.tools : NO_TOOLS;
        return [
            { description: "requested_tools", value: JSON.stringify(tools) },
            { description: "active_document_ids", value: JSON.stringify([]) },
        ];
    }, [threadId]);

    return (
        <MentorRuntimeProvider threadId={threadId} getExtraContext={getExtraContext}>
            <div className="flex h-screen bg-white overflow-hidden">
                {/* LEFT: Source Panel (cùng phiên với thread AG-UI) */}
                <div
                    className={`flex flex-col border-r border-gray-200 transition-all relative ${sourcePanelCollapsed ? "w-12" : "w-1/3"}`}
                >
                    <div
                        id="source-panel-container"
                        className="flex-1 overflow-y-scroll h-full"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        <style>{`#source-panel-container::-webkit-scrollbar { display: none; }`}</style>
                        <SourcePanel onCollapsedChange={setSourcePanelCollapsed} sessionUUID={threadId} />
                        <Element name="source-bottom" className="py-4">
                            <div className="p-4 text-center text-gray-400">Source Panel Content End</div>
                        </Element>
                    </div>
                    {!sourcePanelCollapsed && <CustomScrollbar containerId="source-panel-container" />}
                </div>

                {/* MIDDLE: Chat (AG-UI). Thread tự cuộn trong cột này. */}
                <main
                    className={`flex flex-col min-h-0 transition-all relative ${
                        sourcePanelCollapsed && studioDashboardCollapsed
                            ? "w-full"
                            : sourcePanelCollapsed || studioDashboardCollapsed
                              ? "w-2/3"
                              : "w-1/3"
                    }`}
                >
                    <AgentChat selectedTools={selectedTools} onToolsChange={handleToolsChange} />
                </main>

                {/* RIGHT: Studio Dashboard */}
                <div
                    className={`flex flex-col border-l border-gray-200 transition-all relative ${studioDashboardCollapsed ? "w-12" : "w-1/3"}`}
                >
                    <div
                        id="studio-dashboard-container"
                        className="flex-1 overflow-y-scroll h-full"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        <style>{`#studio-dashboard-container::-webkit-scrollbar { display: none; }`}</style>
                        <StudioDashboard onCollapsedChange={setStudioDashboardCollapsed} sessionUUID={threadId} />
                        <Element name="studio-bottom" className="py-4">
                            <div className="p-4 text-center text-gray-400">Studio Dashboard Content End</div>
                        </Element>
                    </div>
                    {!studioDashboardCollapsed && <CustomScrollbar containerId="studio-dashboard-container" />}
                </div>
            </div>
        </MentorRuntimeProvider>
    );
}

// USE_AGUI là hằng số lúc build, nên chỉ một trong hai nhánh được dùng trong suốt vòng đời app.
// Flag tắt: không render và không khởi tạo gì của AG-UI.
function SessionPage() {
    return USE_AGUI ? <AgentSessionPage /> : <LegacySessionPage />;
}

export default SessionPage;
