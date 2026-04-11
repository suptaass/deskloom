// src/components/Toast.tsx

import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => { onDismiss(); }, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div style={{
      position: "fixed", bottom: "24px", left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(200, 50, 50, 0.92)", color: "white",
      padding: "10px 20px", borderRadius: "8px",
      fontSize: "13px", fontWeight: "500",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,100,100,0.4)",
      zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      ⚠️ {message}
    </div>
  );
};

export default Toast;