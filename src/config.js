// Cấu hình endpoint dùng chung cho toàn app (đọc từ biến môi trường Vite).
export const API_URL    = import.meta.env.VITE_API_URL   ?? "http://0.0.0.0:8686";        // REST cũ
export const AGENT_URL  = import.meta.env.VITE_AGENT_URL ?? "http://localhost:8787/agent"; // AG-UI
export const AGENT_BASE = AGENT_URL.replace(/\/agent\/?$/, "");                            // cho /threads/...
export const USE_AGUI   = import.meta.env.VITE_USE_AGUI === "true";
