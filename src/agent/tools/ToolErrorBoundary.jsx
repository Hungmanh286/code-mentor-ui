import { Component } from "react";
import { TriangleAlert } from "lucide-react";

// Contains render errors of a single tool UI so one bad payload can never
// take down the whole thread. Props: { toolName, resetKey?, children }.
// When `resetKey` changes (e.g. more streamed args arrive) a caught error is cleared and
// the children render again, so one bad partial frame cannot freeze the card.
export default class ToolErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
        this.reported = false;
        this.handleRetry = this.handleRetry.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { error: error ?? new Error("Unknown render error") };
    }

    componentDidCatch(error, info) {
        if (this.reported) return;
        this.reported = true;
        console.error(
            `[ToolErrorBoundary] Không hiển thị được tool "${this.props.toolName ?? "unknown"}"`,
            error,
            info?.componentStack ?? "",
        );
    }

    componentDidUpdate(prevProps) {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.reported = false;
            this.setState({ error: null });
        }
    }

    handleRetry() {
        this.setState({ error: null });
    }

    render() {
        if (this.state.error) {
            const toolName =
                typeof this.props.toolName === "string" && this.props.toolName
                    ? this.props.toolName
                    : "không rõ";
            return (
                <div
                    role="alert"
                    className="flex w-full min-w-0 items-start gap-3 rounded-[8px] border border-[#E3E1DC] bg-[#FBFAF8] px-3.5 py-3 text-[#002B31]"
                >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#8FA3A7]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">Không hiển thị được nội dung này</p>
                        <p className="mt-0.5 break-all text-[11.5px] text-[#7C9499]">
                            Công cụ: <code className="font-mono">{toolName}</code>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="shrink-0 rounded-[7px] border border-[#E3E1DC] bg-white px-2.5 py-1 text-[12px] text-[#2E5A6E] hover:bg-[#F4F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A6E]/30"
                    >
                        Thử lại
                    </button>
                </div>
            );
        }
        return this.props.children ?? null;
    }
}
