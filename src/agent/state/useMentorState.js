import { useMemo } from "react";
import { useAgUiState } from "@assistant-ui/react-ag-ui";

// Shared agent state (PLAN.md 4.7):
//   { artifacts: { quizzes: [{ id, title, count }], mindmaps: [{ id, title }] },
//     jobs: { [jobId]: { kind, label, progress: 0..100, status: "running" | "done" | "error" } } }
//
// useAgUiState() is undefined until the first STATE_SNAPSHOT of a run, or until the history
// adapter restores `state` after a reload. A backend may also send only snapshots (no deltas,
// PLAN.md 4.8 rule 7) or a malformed shape. Every consumer therefore reads the normalized value
// below, which always has the full default shape.

const JOB_STATUSES = new Set(["running", "done", "error"]);

export const EMPTY_MENTOR_STATE = Object.freeze({
    artifacts: Object.freeze({ quizzes: Object.freeze([]), mindmaps: Object.freeze([]) }),
    jobs: Object.freeze({}),
});

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const toId = (value) => {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
};

const toText = (value, fallback) => (typeof value === "string" && value.trim() ? value : fallback);

const toProgress = (value) => {
    const n = typeof value === "number" ? value : Number.NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
};

/** Keeps object items with a usable id; drops duplicates so React keys stay unique. */
function normalizeList(list, mapItem) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        if (!isPlainObject(item)) continue;
        const id = toId(item.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(mapItem(item, id));
    }
    return out;
}

function normalizeJobs(jobs) {
    if (!isPlainObject(jobs)) return {};
    const out = {};
    for (const [id, job] of Object.entries(jobs)) {
        if (!isPlainObject(job) || !JOB_STATUSES.has(job.status)) continue;
        const kind = typeof job.kind === "string" ? job.kind : "";
        out[id] = {
            kind,
            label: toText(job.label, kind === "quiz" ? "Đang sinh câu hỏi" : kind === "mindmap" ? "Đang tạo mindmap" : "Đang xử lý"),
            progress: toProgress(job.progress),
            status: job.status,
        };
    }
    return out;
}

/** Pure normalizer: any input (undefined, null, wrong shape) → full PLAN.md 4.7 shape. */
export function normalizeMentorState(state) {
    if (!isPlainObject(state)) return EMPTY_MENTOR_STATE;
    const artifacts = isPlainObject(state.artifacts) ? state.artifacts : {};
    return {
        artifacts: {
            quizzes: normalizeList(artifacts.quizzes, (quiz, id) => ({
                id,
                title: toText(quiz.title, "Bộ câu hỏi"),
                count: Number.isInteger(quiz.count) && quiz.count >= 0 ? quiz.count : null,
            })),
            mindmaps: normalizeList(artifacts.mindmaps, (mindmap, id) => ({
                id,
                title: toText(mindmap.title, "Mindmap"),
            })),
        },
        jobs: normalizeJobs(state.jobs),
    };
}

/**
 * `() => ({ artifacts: { quizzes, mindmaps }, jobs })`, always with defaults.
 * Only usable inside MentorRuntimeProvider. The result keeps its reference until the agent
 * state changes.
 */
export function useMentorState() {
    const state = useAgUiState();
    return useMemo(() => normalizeMentorState(state), [state]);
}
