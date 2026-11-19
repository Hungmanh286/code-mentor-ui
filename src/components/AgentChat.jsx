import Thread from "@/agent/thread/Thread";

// Middle column of SessionPage when VITE_USE_AGUI is on (PLAN 6.B.8).
// Fills the column; the thread viewport is the only scroll container.
// Must be rendered inside MentorRuntimeProvider.
// Props: selectedTools (string[]), onToolsChange(nextIds) — forwarded to the composer chips.
export default function AgentChat({ selectedTools, onToolsChange }) {
    return (
        <section aria-label="Trò chuyện với trợ lý" className="h-full min-h-0 flex-1 overflow-hidden bg-white">
            <Thread selectedTools={selectedTools} onToolsChange={onToolsChange} />
        </section>
    );
}
