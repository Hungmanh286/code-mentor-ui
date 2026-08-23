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
    {/* showDevConsole: nút tròn dev-console của CopilotKit neo ở góc trái dưới
        màn hình, che đúng tab đầu tiên của thanh tab mobile nên không bấm
        được. Nó cũng hiện trên mọi trang kể cả trang không dùng chat. */}
    <CopilotKit publicApiKey={copilotConfig.publicApiKey} showDevConsole={false}>
      <App />
    </CopilotKit>
  </React.StrictMode>
);
