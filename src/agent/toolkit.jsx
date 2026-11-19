import { defineToolkit, useAui, useAuiState } from "@assistant-ui/react";
import { useAgUiInterrupts } from "@assistant-ui/react-ag-ui";
import CatalogRenderer from "@/agent/catalog/CatalogRenderer";
import FollowUps from "@/agent/tools/FollowUps";
import MindmapView from "@/agent/tools/MindmapView";
import QuizCard from "@/agent/tools/QuizCard";
import SourceCitation from "@/agent/tools/SourceCitation";
import ToolErrorBoundary from "@/agent/tools/ToolErrorBoundary";

// Tool UI registry for the backend-executed tools of PLAN.md 4.5.
// Plain toolkit (no "use generative" compiler): `type: "backend"` entries are
// render-only and are not uploaded to the agent. The runtime mounts each
// `render` as a component (<Render {...part} />), so hooks are allowed inside.
// `mentorToolkit` is a module-level constant so its reference stays stable.

// suggest_followups: clicking a chip appends a user message. `thread.append`
// returns void (errors only reach the console), so the chips are disabled
// whenever a send would be rejected: while the thread is running and while an
// interrupt is pending (the runtime refuses new runs until it is answered).
// Kept as its own component so its hooks also sit inside ToolErrorBoundary.
function FollowUpsTool(props) {
    const aui = useAui();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const hasPendingInterrupt = useAgUiInterrupts().length > 0;

    const handleSelect = (question) => {
        aui.thread.append({ role: "user", content: [{ type: "text", text: question }] });
    };

    return (
        <FollowUps
            {...props}
            disabled={isRunning || hasPendingInterrupt}
            onSelect={handleSelect}
        />
    );
}

export const mentorToolkit = defineToolkit({
    show_quiz: {
        type: "backend",
        render: (props) => (
            <ToolErrorBoundary toolName="show_quiz" resetKey={props.argsText}>
                <QuizCard {...props} />
            </ToolErrorBoundary>
        ),
    },
    show_mindmap: {
        type: "backend",
        render: (props) => (
            <ToolErrorBoundary toolName="show_mindmap" resetKey={props.argsText}>
                <MindmapView {...props} />
            </ToolErrorBoundary>
        ),
    },
    cite_sources: {
        type: "backend",
        render: (props) => (
            <ToolErrorBoundary toolName="cite_sources" resetKey={props.argsText}>
                <SourceCitation {...props} />
            </ToolErrorBoundary>
        ),
    },
    suggest_followups: {
        type: "backend",
        render: (props) => (
            <ToolErrorBoundary toolName="suggest_followups" resetKey={props.argsText}>
                <FollowUpsTool {...props} />
            </ToolErrorBoundary>
        ),
    },
    present_ui: {
        type: "backend",
        render: (props) => (
            <ToolErrorBoundary toolName="present_ui" resetKey={props.argsText}>
                <CatalogRenderer {...props} />
            </ToolErrorBoundary>
        ),
    },
});
