import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Chatbot from "../components/Chatbot";
import SourcePanel from "../components/SourcePanel";
import StudioDashboard from "../components/StudioDashboard";

const TABS = [
    {
        id: "sources",
        label: "Nguồn",
        icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
    },
    {
        id: "chat",
        label: "Hỏi đáp",
        icon: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z",
    },
    {
        id: "studio",
        label: "Studio",
        icon: "M4 4h16v16H4zM9 11.5l2 2 4.5-4.5",
    },
];

function Chevron({ pointing }) {
    return (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={pointing === "left" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
        </svg>
    );
}

/**
 * Một cột bên. Trên desktop có thể thu gọn còn 56px (chiều rộng do lưới cha
 * quyết định); trên mobile luôn mở vì việc ẩn/hiện đã do thanh tab lo.
 */
function Rail({ side, title, collapsed, onToggle, visibleOnMobile, children }) {
    const toggleBtn = (
        <button
            type="button"
            onClick={onToggle}
            title={collapsed ? "Mở rộng" : "Thu gọn"}
            aria-expanded={!collapsed}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-main-text hover:bg-surface transition-colors"
        >
            <Chevron pointing={side === "left" ? (collapsed ? "right" : "left") : (collapsed ? "left" : "right")} />
        </button>
    );

    return (
        <aside
            className={[
                "flex-1 flex-col min-h-0 bg-panel",
                side === "left" ? "lg:border-r" : "lg:border-l",
                "border-hairline",
                visibleOnMobile ? "flex" : "hidden",
                "lg:flex",
            ].join(" ")}
        >
            <div className="h-11 shrink-0 hidden lg:flex items-center gap-2 px-3 border-b border-hairline-soft">
                {side === "left" ? (
                    <>
                        {!collapsed && <span className="flex-1 label-caps">{title}</span>}
                        {collapsed && <span className="flex-1" />}
                        {toggleBtn}
                    </>
                ) : (
                    <>
                        {toggleBtn}
                        {!collapsed && <span className="flex-1 label-caps">{title}</span>}
                    </>
                )}
            </div>
            <div className={`flex-1 min-h-0 overflow-y-auto ${collapsed ? "lg:hidden" : ""}`}>{children}</div>
        </aside>
    );
}

function SessionPage() {
    const { sessionId } = useParams();
    const [sessionUUID, setSessionUUID] = useState(sessionId || null);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const [mobileTab, setMobileTab] = useState("chat");
    const [sourceStats, setSourceStats] = useState({ total: 0, active: 0 });

    useEffect(() => {
        if (sessionId) setSessionUUID(sessionId);
    }, [sessionId]);

    const handleSessionUUID = useCallback((uuid) => {
        setSessionUUID((prev) => (prev ? prev : uuid || prev));
    }, []);

    const gridTemplateColumns = `${leftCollapsed ? "56px" : "320px"} minmax(0, 1fr) ${rightCollapsed ? "56px" : "344px"}`;

    return (
        <div className="flex flex-col h-screen bg-surface text-main-text overflow-hidden">
            <AppHeader
                sessionLabel={sessionUUID ? `Phiên ${sessionUUID.substring(0, 8)}` : "Đang mở phiên…"}
                sessionId={sessionUUID || undefined}
                meta={sourceStats.total > 0 ? `${sourceStats.active}/${sourceStats.total} nguồn đang dùng` : undefined}
            />

            <div className="flex-1 min-h-0 flex flex-col lg:grid" style={{ gridTemplateColumns }}>
                <Rail
                    side="left"
                    title="Nguồn"
                    collapsed={leftCollapsed}
                    onToggle={() => setLeftCollapsed((v) => !v)}
                    visibleOnMobile={mobileTab === "sources"}
                >
                    <SourcePanel sessionUUID={sessionUUID} onStatsChange={setSourceStats} />
                </Rail>

                <main
                    className={`flex-1 flex-col min-h-0 bg-surface ${mobileTab === "chat" ? "flex" : "hidden"} lg:flex`}
                >
                    <Chatbot
                        key={sessionId || sessionUUID || "new-session"}
                        onSessionUUID={handleSessionUUID}
                        sessionId={sessionId}
                    />
                </main>

                <Rail
                    side="right"
                    title="Studio"
                    collapsed={rightCollapsed}
                    onToggle={() => setRightCollapsed((v) => !v)}
                    visibleOnMobile={mobileTab === "studio"}
                >
                    <StudioDashboard sessionUUID={sessionUUID} />
                </Rail>
            </div>

            {/* Thanh tab chỉ có trên mobile: thay cho 3 cột chen nhau còn ~130px mỗi cột */}
            <nav className="lg:hidden relative z-20 h-16 shrink-0 flex bg-panel border-t border-hairline">
                {TABS.map((tab) => {
                    const active = mobileTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setMobileTab(tab.id)}
                            aria-current={active ? "page" : undefined}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors
                                        ${active ? "text-accent" : "text-muted"}`}
                        >
                            <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d={tab.icon} />
                            </svg>
                            <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

export default SessionPage;
