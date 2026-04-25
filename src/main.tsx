// src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App";
import QuickCaptureWindow from "./components/QuickCaptureWindow";
import WidgetWindow from "./components/WidgetWindow";

// ใช้ __TAURI_INTERNALS__ แทน getCurrentWindow()
// เพราะ Tauri inject ค่านี้ก่อน JS ทำงาน — ไม่มีปัญหา timing
const windowLabel =
  (window as unknown as {
    __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } };
  }).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "main";

const rootElement = document.getElementById("root") as HTMLElement;

if (windowLabel === "quick-capture") {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QuickCaptureWindow />
    </React.StrictMode>
  );
} else if (windowLabel.startsWith("widget-")) {
  const widgetId = windowLabel.replace("widget-", "");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <WidgetWindow widgetId={widgetId} />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}