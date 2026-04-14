// src/components/widgets/PomodoroWidget.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Widget } from "../../types/widget";

type TimerMode = "work" | "break";

interface PomodoroSettings { workMinutes: number; breakMinutes: number; }
interface PomodoroWidgetProps { widget: Widget; onUpdateData: (widgetId: string, data: Record<string, unknown>) => void; }

function getSettings(widget: Widget): PomodoroSettings {
  return {
    workMinutes:  typeof widget.data.workMinutes  === "number" ? widget.data.workMinutes  : 25,
    breakMinutes: typeof widget.data.breakMinutes === "number" ? widget.data.breakMinutes : 5,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function requestNotificationPermission(): void {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function sendNotification(title: string, body: string): void {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, silent: false });
  }
}

const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ widget, onUpdateData }) => {
  const settings = getSettings(widget);

  const [mode,              setMode]              = useState<TimerMode>("work");
  const [isRunning,         setIsRunning]         = useState<boolean>(false);
  const [secondsLeft,       setSecondsLeft]       = useState<number>(settings.workMinutes * 60);
  const [isEditingSettings, setIsEditingSettings] = useState<boolean>(false);
  const [draftWork,         setDraftWork]         = useState<string>(String(settings.workMinutes));
  const [draftBreak,        setDraftBreak]        = useState<string>(String(settings.breakMinutes));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Request notification permission on mount ───────────────────────────────
  useEffect(() => { requestNotificationPermission(); }, []);

  // ── Effect 1: Timer tick — only decrements secondsLeft ─────────────────────
  // ทำไม: แยก logic นับถอยหลังออกมาให้ clean ไม่มี side-effect อื่น
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // ── Effect 2: Timer completion — watches secondsLeft hitting 0 ─────────────
  // ทำไม: แยก completion logic ออกมา ทำให้ไม่ต้องซ้อน setState หลายชั้น
  useEffect(() => {
    // ออกถ้า: ยังไม่ running, หรือเวลายังไม่หมด
    if (!isRunning || secondsLeft > 0) return;

    // หมดเวลา — หยุด interval, สลับ mode, แจ้งเตือน
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const nextMode    = mode === "work" ? "break" : "work";
    const nextSeconds = nextMode === "work"
      ? settings.workMinutes  * 60
      : settings.breakMinutes * 60;

    sendNotification(
      nextMode === "break" ? "🍅 Work session done!" : "☕ Break over!",
      nextMode === "break" ? "Time for a break."     : "Back to work."
    );

    setIsRunning(false);
    setMode(nextMode);
    setSecondsLeft(nextSeconds);
  }, [secondsLeft, isRunning, mode, settings.workMinutes, settings.breakMinutes]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStartPause = useCallback(() => setIsRunning((prev) => !prev), []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setMode("work");
    setSecondsLeft(settings.workMinutes * 60);
  }, [settings.workMinutes]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    setMode((currentMode) => {
      const nextMode    = currentMode === "work" ? "break" : "work";
      const nextSeconds = nextMode === "work"
        ? settings.workMinutes  * 60
        : settings.breakMinutes * 60;
      setSecondsLeft(nextSeconds);
      return nextMode;
    });
  }, [settings.workMinutes, settings.breakMinutes]);

  const handleSaveSettings = useCallback(() => {
    const workVal  = parseInt(draftWork,  10);
    const breakVal = parseInt(draftBreak, 10);
    if (isNaN(workVal)  || workVal  < 1 || workVal  > 99) return;
    if (isNaN(breakVal) || breakVal < 1 || breakVal > 99) return;
    onUpdateData(widget.id, { ...widget.data, workMinutes: workVal, breakMinutes: breakVal });
    setIsRunning(false);
    setMode("work");
    setSecondsLeft(workVal * 60);
    setIsEditingSettings(false);
  }, [draftWork, draftBreak, widget.id, widget.data, onUpdateData]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalSeconds = mode === "work" ? settings.workMinutes * 60 : settings.breakMinutes * 60;
  const progress     = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const modeColor    = mode === "work" ? "var(--accent-color)" : "var(--accent-green)";

  // ── Styles ────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    width: "100%", height: "100%",
    background: "var(--widget-bg)", borderRadius: "14px",
    border: "1px solid var(--widget-border)", backdropFilter: "blur(12px)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  };
  const btnStyle: React.CSSProperties = {
    padding: "6px 14px", borderRadius: "6px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)", color: "var(--btn-text)",
    fontSize: "11px", cursor: "pointer", fontFamily: "inherit",
  };
  const inputStyle: React.CSSProperties = {
    width: "56px", padding: "4px 8px", borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "12px", outline: "none", fontFamily: "inherit", textAlign: "center",
  };

  // ── Render: Settings form ──────────────────────────────────────────────────
  if (isEditingSettings) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>🍅 Pomodoro Settings</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Work (min)</p>
            <input style={inputStyle} type="number" min={1} max={99} value={draftWork} onChange={(e) => setDraftWork(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Break (min)</p>
            <input style={inputStyle} type="number" min={1} max={99} value={draftBreak} onChange={(e) => setDraftBreak(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button style={{ ...btnStyle, flex: 1 }} onClick={() => setIsEditingSettings(false)}>Cancel</button>
            <button style={{ ...btnStyle, flex: 1, borderColor: "var(--accent-color)", color: "var(--accent-color)" }} onClick={handleSaveSettings}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Timer ─────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>🍅 {widget.label}</p>
        <button
          style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}
          onClick={() => { setIsRunning(false); setIsEditingSettings(true); setDraftWork(String(settings.workMinutes)); setDraftBreak(String(settings.breakMinutes)); }}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px", gap: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: modeColor }}>
          {mode === "work" ? "Work" : "Break"}
        </p>
        <p style={{ fontSize: "38px", fontWeight: "700", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", lineHeight: 1, letterSpacing: "2px" }}>
          {formatTime(secondsLeft)}
        </p>

        {/* Progress bar */}
        <div style={{ width: "100%", height: "4px", borderRadius: "2px", background: "var(--progress-bg)", overflow: "hidden" }}>
          <div data-accent-bar style={{ height: "100%", width: `${progress * 100}%`, borderRadius: "2px", transition: "width 0.9s linear" }} />
        </div>

        <p style={{ fontSize: "10px", color: "var(--text-dim)" }}>
          {mode === "work" ? settings.workMinutes : settings.breakMinutes} min session
        </p>

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button
            style={{ ...btnStyle, minWidth: "70px", borderColor: modeColor, color: modeColor, background: `color-mix(in srgb, ${modeColor} 12%, transparent)` }}
            onClick={handleStartPause}
          >
            {isRunning ? "⏸ Pause" : "▶ Start"}
          </button>
          <button style={btnStyle} onClick={handleReset} title="Reset">↺</button>
          <button style={btnStyle} onClick={handleSkip}  title="Skip to next">⏭</button>
        </div>
      </div>
    </div>
  );
};

export default PomodoroWidget;