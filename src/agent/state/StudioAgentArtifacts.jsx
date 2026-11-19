import { AlertCircle, ListChecks, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/agent/catalog/parts";
import { cn } from "@/lib/utils";
import { useMentorState } from "@/agent/state/useMentorState";

// Studio block fed by the agent's shared state (PLAN.md 4.7, 6.E E2).
// Must render inside MentorRuntimeProvider. Renders nothing when there is nothing to show.

const TAG_CLASS =
    "shrink-0 rounded-[2px] border-transparent px-1.5 py-0 text-[10.5px] font-semibold leading-[18px] shadow-none";
const LIST_CLASS = "m-0 flex list-none flex-col gap-1.5 p-0";

/** Hand-written progress bar (ui/progress is not usable here, see PLAN.md 4.9). */
function ProgressBar({ value, error, label }) {
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            aria-valuetext={error ? `Lỗi ở ${value}%` : `${value}%`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF1F2]"
        >
            <div
                className={cn(
                    "h-full rounded-full transition-[width] duration-300 ease-out",
                    error ? "bg-error-red" : "bg-[#2E5A6E]",
                )}
                style={{ width: `${value}%` }}
            />
        </div>
    );
}

function JobRow({ job }) {
    const error = job.status === "error";
    return (
        <li className="flex flex-col gap-1.5 rounded-[8px] border border-[#E7E5E0] bg-[#FBFAF8] px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className={cn("flex min-w-0 items-center gap-1.5", error ? "text-error-red" : "text-[#002B31]")}>
                    {error && <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />}
                    <span className="truncate" title={job.label}>
                        {job.label}
                    </span>
                </span>
                <span className={cn("shrink-0 text-[11px] tabular-nums", error ? "text-error-red" : "text-[#7C9499]")}>
                    {error ? "Lỗi" : `${job.progress}%`}
                </span>
            </div>
            <ProgressBar value={job.progress} error={error} label={job.label} />
        </li>
    );
}

function ArtifactRow({ icon: Icon, title, tag }) {
    return (
        <li className="flex items-center gap-2 rounded-[8px] border border-[#E7E5E0] bg-white px-3 py-2 text-[12.5px] text-[#002B31]">
            <Icon className="size-4 shrink-0 text-[#2E5A6E]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate" title={title}>
                {title}
            </span>
            {tag}
        </li>
    );
}

export default function StudioAgentArtifacts() {
    const { artifacts, jobs } = useMentorState();
    const { quizzes, mindmaps } = artifacts;
    // "Đang xử lý": running jobs, plus failed ones shown in error-red. Finished jobs are hidden.
    const activeJobs = Object.entries(jobs).filter(([, job]) => job.status !== "done");

    if (activeJobs.length === 0 && quizzes.length === 0 && mindmaps.length === 0) return null;

    return (
        <section aria-label="Kết quả từ trợ lý" className="mb-3 flex flex-col gap-3 font-sans text-[#002B31]">
            {activeJobs.length > 0 && (
                <div className="flex flex-col gap-2">
                    <Label>Đang xử lý</Label>
                    <ul className={LIST_CLASS}>
                        {activeJobs.map(([id, job]) => (
                            <JobRow key={id} job={job} />
                        ))}
                    </ul>
                </div>
            )}
            {quizzes.length + mindmaps.length > 0 && (
                <div className="flex flex-col gap-2">
                    <Label>Từ trợ lý</Label>
                    <ul className={LIST_CLASS}>
                        {quizzes.map((quiz) => (
                            <ArtifactRow
                                key={`quiz-${quiz.id}`}
                                icon={ListChecks}
                                title={quiz.title}
                                tag={
                                    quiz.count !== null ? (
                                        <Badge variant="outline" className={cn(TAG_CLASS, "bg-[#EEF1F2] text-[#2E5A6E]")}>
                                            {quiz.count} câu
                                        </Badge>
                                    ) : null
                                }
                            />
                        ))}
                        {mindmaps.map((mindmap) => (
                            <ArtifactRow
                                key={`mindmap-${mindmap.id}`}
                                icon={Network}
                                title={mindmap.title}
                                tag={
                                    <Badge variant="outline" className={cn(TAG_CLASS, "bg-[#F1F5F6] text-[#7C9499]")}>
                                        Mindmap
                                    </Badge>
                                }
                            />
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
