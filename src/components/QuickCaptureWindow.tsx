// src/components/QuickCaptureWindow.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

type TargetType = "todo" | "notes";

const QuickCaptureWindow: React.FC = () => {
  const [text,       setText]       = useState<string>("");
  const [targetType, setTargetType] = useState<TargetType>("todo");
  const [isSending,  setIsSending]  = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus input ทุกครั้งที่ window แสดง
  useEffect(() => {
    const win = getCurrentWindow();

    // focus เมื่อ component mount ครั้งแรก
    setTimeout(() => inputRef.current?.focus(), 80);

    // focus อีกครั้งทุกครั้งที่ window ถูก show (shortcut กดซ้ำ)
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        setText("");
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleHide = useCallback(async () => {
    setText("");
    await getCurrentWindow().hide();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      // ส่ง event ไปหา main window — App.tsx จะรับและเพิ่มลง store
      await emitTo("main", "quick-capture-submit", {
        text:       trimmed,
        targetType,
      });
      await getCurrentWindow().hide();
      setText("");
    } catch (e) {
      console.error("[QuickCapture] emitTo failed:", e);
    } finally {
      setIsSending(false);
    }
  }, [text, targetType, isSending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter")  { e.preventDefault(); void handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); void handleHide();   }
    },
    [handleSubmit, handleHide]
  );

  // ── Styles ─────────────────────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    width:          "100vw",
    height:         "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "transparent",
  };

  const cardStyle: React.CSSProperties = {
    width:          "400px",
    background:     "rgba(18, 18, 32, 0.92)",
    borderRadius:   "16px",
    border:         "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(20px)",
    padding:        "18px 20px",
    boxShadow:      "0 24px 60px rgba(0,0,0,0.6)",
    display:        "flex",
    flexDirection:  "column",
    gap:            "12px",
  };

  const headerStyle: React.CSSProperties = {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
  };

  const inputStyle: React.CSSProperties = {
    width:        "100%",
    padding:      "10px 14px",
    borderRadius: "10px",
    border:       "1px solid rgba(255,255,255,0.15)",
    background:   "rgba(255,255,255,0.06)",
    color:        "rgba(255,255,255,0.92)",
    fontSize:     "14px",
    outline:      "none",
    fontFamily:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing:    "border-box",
    transition:   "border-color 0.15s",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding:      "5px 14px",
    borderRadius: "7px",
    border:       "1px solid",
    borderColor:  active ? "#6C8EF5" : "rgba(255,255,255,0.12)",
    background:   active
      ? "color-mix(in srgb, #6C8EF5 20%, transparent)"
      : "rgba(255,255,255,0.04)",
    color:        active ? "#6C8EF5" : "rgba(255,255,255,0.5)",
    fontSize:     "12px",
    fontWeight:   active ? "700" : "400",
    cursor:       "pointer",
    fontFamily:   "inherit",
    transition:   "all 0.15s",
  });

  const submitBtnStyle: React.CSSProperties = {
    padding:      "8px 0",
    borderRadius: "10px",
    border:       "1px solid #6C8EF5",
    background:   "color-mix(in srgb, #6C8EF5 20%, transparent)",
    color:        "#6C8EF5",
    fontSize:     "13px",
    fontWeight:   "700",
    cursor:       isSending ? "not-allowed" : "pointer",
    fontFamily:   "inherit",
    width:        "100%",
    opacity:      isSending ? 0.6 : 1,
    transition:   "opacity 0.15s",
  };

  const hintStyle: React.CSSProperties = {
    fontSize:  "11px",
    color:     "rgba(255,255,255,0.25)",
    textAlign: "center",
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>

        {/* ── Header ── */}
        <div style={headerStyle}>
          <span style={{
            fontSize:    "13px",
            fontWeight:  "700",
            color:       "rgba(255,255,255,0.7)",
            letterSpacing: "0.3px",
          }}>
            ⚡ Quick Capture
          </span>

          {/* Target type tabs */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={tabStyle(targetType === "todo")}
              onClick={() => setTargetType("todo")}
            >
              ✅ Todo
            </button>
            <button
              style={tabStyle(targetType === "notes")}
              onClick={() => setTargetType("notes")}
            >
              📝 Notes
            </button>
          </div>
        </div>

        {/* ── Input ── */}
        <input
          ref={inputRef}
          style={inputStyle}
          type="text"
          placeholder={
            targetType === "todo"
              ? "Add a task… (Enter to save)"
              : "Add a note… (Enter to save)"
          }
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        {/* ── Submit button ── */}
        <button
          style={submitBtnStyle}
          onClick={() => void handleSubmit()}
          disabled={isSending || !text.trim()}
        >
          {isSending ? "Saving…" : `Save to ${targetType === "todo" ? "Todo" : "Notes"}`}
        </button>

        {/* ── Hint ── */}
        <p style={hintStyle}>Enter to save · Esc to close</p>

      </div>
    </div>
  );
};

export default QuickCaptureWindow;