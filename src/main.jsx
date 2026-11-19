import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import './index.css'

// Thêm polyfill đảm bảo hoạt động trên iOS cũ
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
}

// Repo chưa định nghĩa --popover/--border mà ui/sonner.jsx tham chiếu, nên truyền màu nền/chữ/viền
// theo design token (PLAN mục 4.9) để toast không bị trong suốt.
const toasterStyle = {
  "--normal-bg": "#FFFFFF",
  "--normal-text": "#002B31",
  "--normal-border": "#E3E1DC",
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" richColors closeButton style={toasterStyle} />
  </React.StrictMode>
);
