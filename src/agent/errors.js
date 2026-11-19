// Chuyển lỗi của runtime/agent thành câu tiếng Việt an toàn để hiển thị cho người dùng.
// Lỗi phía client của @ag-ui/client (verifier giao thức, schema, JSON) là Error thường,
// không có class riêng, nên nhận diện theo nội dung; chi tiết gốc chỉ ghi ra console.

export const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i;
export const CONNECTION_ENDED = "The connection ended before the answer finished.";

const INTERNAL_ERROR_PATTERN =
  /^\s*(\[agui\]|AGUI|Cannot send\b|Cannot\s+\w+\s+'|Unexpected token|Unexpected end of JSON)|while (a |an )?\S+( \S+)? (is|are) still active|ZodError|invalid_type|is not valid JSON|schema/i;

const MAX_LENGTH = 300;

export function friendlyAgentError(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { kind: "unknown", message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  if (NETWORK_ERROR_PATTERN.test(text)) {
    return { kind: "network", message: "Không kết nối được tới trợ lý. Kiểm tra máy chủ hoặc mạng rồi gửi lại." };
  }
  if (text === CONNECTION_ENDED) {
    return { kind: "connection-ended", message: "Kết nối bị ngắt trước khi trợ lý trả lời xong." };
  }
  if (INTERNAL_ERROR_PATTERN.test(text)) {
    console.warn("[agui] Lỗi nội bộ/giao thức (ẩn với người dùng):", text);
    return { kind: "internal", message: "Trợ lý trả về dữ liệu không hợp lệ. Vui lòng thử lại." };
  }
  // Message do backend phát qua RUN_ERROR: backend chịu trách nhiệm viết cho người dùng đọc.
  return { kind: "agent", message: text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text };
}
