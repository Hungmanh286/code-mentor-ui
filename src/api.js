// Điểm duy nhất định nghĩa địa chỉ backend.
//
// Trước đây 13 chỗ trong src/ hardcode 'http://0.0.0.0:8686'. Ngoài việc bản
// build production đóng cứng localhost, 0.0.0.0 còn không phải địa chỉ đích
// hợp lệ trên Windows/macOS. Giờ lấy từ biến môi trường, giữ giá trị cũ làm
// mặc định để môi trường dev hiện tại không đổi gì.
const BASE = (import.meta.env.VITE_API_URL || 'http://0.0.0.0:8686').replace(/\/+$/, '');

export const apiUrl = (path) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
