import { ExportedMessageRepository } from "@assistant-ui/react";
import { fromAgUiMessages } from "@assistant-ui/react-ag-ui";
import { toast } from "sonner";
import { AGENT_BASE } from "@/config";

export const HISTORY_TIMEOUT_MS = 10000;

const emptyRepository = () => ExportedMessageRepository.fromArray([]);

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// State khôi phục phải đúng shape mục 4.7 ở mức khung: object có `artifacts` và `jobs` đều là object.
// Kiểm chi tiết từng field là việc của useMentorState (luôn trả giá trị mặc định).
const isMentorState = (state) => isPlainObject(state) && isPlainObject(state.artifacts) && isPlainObject(state.jobs);

/**
 * ThreadHistoryAdapter cho useAgUiRuntime (PLAN mục 4.3 và 6.A bước 6).
 *
 * load(): GET {AGENT_BASE}/threads/{threadId}/messages -> { messages: AgUiMessage[], state?: <mục 4.7> },
 * chuyển bằng fromAgUiMessages rồi ExportedMessageRepository.fromArray.
 * Nếu có `state` đúng shape thì trả kèm `{ ...repo, state }`: ThreadHistoryAdapter.load() hỗ trợ field này
 * và useAgUiRuntime nạp nó làm state ban đầu (useAgUiState) qua loadExternalState. State thiếu thì bỏ qua;
 * state sai shape thì bỏ qua kèm console.warn.
 * Mọi lỗi (mạng, timeout 10 giây, status khác 2xx, JSON hỏng, dữ liệu sai shape)
 * ghi console.warn, hiện toast cho người dùng và trả về repository rỗng: không bao giờ ném lỗi làm sập trang.
 *
 * append(): no-op, vì backend tự lưu transcript của mỗi run.
 */
// Lỗi tải lịch sử phải hiện cho người dùng thấy: nếu không, phiên cũ trông như cuộc trò chuyện mới
// và người dùng tưởng lịch sử đã mất. Toast id cố định để không chồng nhiều thông báo.
function notifyHistoryError() {
  toast.error("Không tải được lịch sử trò chuyện", {
    id: "agent-history-error",
    description: "Phiên này có thể đã có tin nhắn trước đó. Kiểm tra máy chủ agent rồi tải lại trang.",
  });
}

export function createHistoryAdapter(threadId, options = {}) {
  const baseUrl = options.baseUrl ?? AGENT_BASE;
  const timeoutMs = options.timeoutMs ?? HISTORY_TIMEOUT_MS;

  return {
    async load() {
      if (!threadId) return emptyRepository();

      const url = `${baseUrl}/threads/${encodeURIComponent(threadId)}/messages`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          console.warn(`[agui] Không tải được lịch sử hội thoại (HTTP ${res.status}) từ ${url}`);
          notifyHistoryError();
          return emptyRepository();
        }
        const data = await res.json();
        const messages = Array.isArray(data?.messages) ? data.messages : [];
        const repository = ExportedMessageRepository.fromArray(fromAgUiMessages(messages));
        const state = data?.state;
        if (state === undefined || state === null) return repository;
        if (!isMentorState(state)) {
          console.warn(`[agui] Bỏ qua state khôi phục sai shape (cần { artifacts: {...}, jobs: {...} }) từ ${url}`);
          return repository;
        }
        return { ...repository, state };
      } catch (error) {
        const reason = controller.signal.aborted ? `quá thời gian ${timeoutMs / 1000} giây` : error;
        console.warn(`[agui] Không tải được lịch sử hội thoại từ ${url}:`, reason);
        notifyHistoryError();
        return emptyRepository();
      } finally {
        clearTimeout(timer);
      }
    },
    async append() {
      // Backend tự lưu transcript; không ghi gì thêm từ client.
    },
  };
}
