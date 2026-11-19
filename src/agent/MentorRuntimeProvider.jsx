import { useCallback, useMemo } from "react";
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { HttpAgent } from "@ag-ui/client";
import { toast } from "sonner";
import { AGENT_URL } from "@/config";
import { mentorToolkit } from "@/agent/toolkit";
import { createHistoryAdapter } from "@/agent/adapters/historyAdapter";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyAgentError, NETWORK_ERROR_PATTERN } from "@/agent/errors";

const AGENT_ERROR_TOAST_ID = "agent-error";

// onError của useAgUiRuntime: RUN_ERROR, lỗi giao thức, lỗi mạng. Không được gọi khi người dùng bấm Dừng.
// Dùng một toast id cố định để nhiều lỗi liên tiếp không chồng thành nhiều toast.
function notifyAgentError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  if (NETWORK_ERROR_PATTERN.test(message)) {
    toast.error("Không kết nối được tới trợ lý", {
      id: AGENT_ERROR_TOAST_ID,
      description: "Kiểm tra máy chủ agent hoặc kết nối mạng rồi gửi lại.",
    });
    return;
  }
  toast.error("Trợ lý gặp lỗi khi trả lời", {
    id: AGENT_ERROR_TOAST_ID,
    description: friendlyAgentError(message).message,
  });
}

// Context[] của AG-UI: { description: string, value: string }. value luôn là string (PLAN mục 4.4).
function normalizeExtraContext(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry.description === "string")
    .map((entry) => ({
      description: entry.description,
      value: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value ?? null),
    }));
}

function MentorRuntime({ threadId, getExtraContext, children }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const userName = user?.user_name ?? null;

  // Một HttpAgent và một history adapter cho mỗi thread; không tạo lại ở mỗi lần render.
  const agent = useMemo(() => new HttpAgent({ url: AGENT_URL, threadId }), [threadId]);
  const adapters = useMemo(() => ({ history: createHistoryAdapter(threadId) }), [threadId]);

  const getRunContext = useCallback(() => {
    const userCtx = {
      description: "user",
      value: JSON.stringify({ user_id: userId, user_name: userName }),
    };
    let extra = [];
    try {
      extra = normalizeExtraContext(getExtraContext?.());
    } catch (error) {
      console.warn("[agui] getExtraContext lỗi, bỏ qua context bổ sung:", error);
    }
    return [userCtx, ...extra];
  }, [userId, userName, getExtraContext]);

  const runtime = useAgUiRuntime({
    agent,
    showThinking: true,
    onError: notifyAgentError,
    adapters,
    getRunContext,
  });

  const auiConfig = useMemo(() => AuiConfig({ tools: Tools({ toolkit: mentorToolkit }) }), []);

  return (
    <AssistantRuntimeProvider runtime={runtime} config={auiConfig}>
      {children}
    </AssistantRuntimeProvider>
  );
}

/**
 * Bọc cây con trong runtime AG-UI của Mentor (PLAN mục 4.2).
 * Props: threadId (= sessionId), getExtraContext?: () => Context[], children.
 *
 * Runtime gắn với một thread cố định: khi threadId đổi, toàn bộ cây con được mount lại
 * (key = threadId) để lịch sử của thread mới được tải lại và không lẫn message giữa hai thread.
 */
export default function MentorRuntimeProvider({ threadId, getExtraContext, children }) {
  return (
    <MentorRuntime key={threadId} threadId={threadId} getExtraContext={getExtraContext}>
      {children}
    </MentorRuntime>
  );
}
