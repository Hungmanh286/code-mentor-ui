import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CopilotKit } from "@copilotkit/react-core";
import { copilotConfig } from "./copilot.config";
import './index.css'

// Thêm polyfill đảm bảo hoạt động trên iOS cũ
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CopilotKit publicApiKey={copilotConfig.publicApiKey}>
      <App />
    </CopilotKit>
  </React.StrictMode>
);
