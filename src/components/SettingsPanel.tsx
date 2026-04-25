// src/components/SettingsPanel.tsx

import React, { useState, useCallback, useEffect } from "react";
import { Widget, WidgetCondition } from "../types/widget";
import {
  WidgetType,
  WidgetRegistryEntry,
  WIDGET_REGISTRY,
} from "../registry/widgetRegistry";
import { DEFAULT_CONDITION } from "../utils/condition";
import { useLicenseStore } from "../store/licenseStore";
import LicenseModal from "./LicenseModal";

const DEFAULT_WIDGET_IDS = ["clock-1", "todo-1", "notes-1"];

const WIDGET_TYPE_ICON: Record<WidgetType, string> = Object.fromEntries(
  WIDGET_REGISTRY.map((e) => [e.type, `${e.icon} ${e.displayName}`])
) as Record<WidgetType, string>;

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface SettingsPanelProps {
  isOpen: boolean;
  widgets: Widget[];
  theme: "dark" | "light";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  autostart: boolean;
  alwaysOnTop: boolean;
  addableEntries: WidgetRegistryEntry[];
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleVisible: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  onRenameWidget: (widgetId: string, newLabel: string) => void;
  onResetLayout: () => void;
  onSetAccentColor: (color: string) => void;
  onSetFontSize: (size: "small" | "medium" | "large") => void;
  onSetOpacity: (widgetId: string, opacity: number) => void;
  onAddWidgetInstance: (type: WidgetType) => void;
  onRemoveWidget: (widgetId: string) => void;
  onSetAlwaysOnTop: (value: boolean) => void;
  onSetAutostart: (value: boolean) => void;
  onExportLayout: () => void;
  onImportLayout: () => void;
  onSetWidgetCondition: (widgetId: string, condition: WidgetCondition | null) => void;
  /** คืน true ถ้าบันทึกสำเร็จ, false ถ้า conflict */
  onSetWidgetShortcut: (widgetId: string, shortcut: string | null) => boolean;
  onCreateWidgetStack: (widgetId: string) => void;
  onAddWidgetToStack: (widgetId: string, targetStackId: string) => void;
  onRemoveWidgetFromStack: (widgetId: string) => void;
  onSetClickThrough: (widgetId: string, value: boolean) => void;
  weatherApiKey: string;
  onWeatherApiKeyChange: (key: string) => void;
}

function getDisplayLabel(widget: Widget): string {
  if (widget.type === "clock") {
    try {
      const parsed = JSON.parse(widget.label);
      return parsed.name ?? widget.label;
    } catch {
      const parts = widget.label.split("||");
      return parts[0] || widget.label;
    }
  }
  return widget.label;
}

// แปลง KeyboardEvent → shortcut string (เหมือน App.tsx)
function parseShortcutKey(e: KeyboardEvent): string | null {
  if (!e.ctrlKey && !e.altKey && !e.shiftKey) return null;
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey)  parts.push("Ctrl");
  if (e.altKey)   parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.toUpperCase());
  return parts.join("+");
}

const PRESET_COLORS = [
  "#6C8EF5", "#F56C8E", "#8EF56C", "#F5C86C",
  "#6CF5E8", "#C86CF5", "#F5906C", "#6CF59A",
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop,
  addableEntries,
  onClose, onToggleTheme, onToggleVisible, onToggleLock, onRenameWidget,
  onResetLayout, onSetAccentColor, onSetFontSize, onSetOpacity,
  onAddWidgetInstance, onRemoveWidget, onSetAlwaysOnTop, onSetAutostart,
  onExportLayout, onImportLayout, onSetWidgetCondition, onSetWidgetShortcut,
  onCreateWidgetStack, onAddWidgetToStack, onRemoveWidgetFromStack,
  onSetClickThrough,
  weatherApiKey, onWeatherApiKeyChange,
}) => {
  const [renameValues,      setRenameValues]      = useState<Record<string, string>>({});
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null);
  const [stackTargets,      setStackTargets]      = useState<Record<string, string>>({});
  const [showLicenseModal,  setShowLicenseModal]  = useState(false);
  const [showApiKey,        setShowApiKey]        = useState(false);

  const isPremium = useLicenseStore((s) => s.isPremium);
  const email     = useLicenseStore((s) => s.email);

  // recordingId: widget ที่กำลัง "รอรับ keypress" สำหรับ shortcut
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // ── Shortcut recording: ดัก keydown ขณะ recording ─────────────────────────
  // ทำไม useEffect ใน SettingsPanel แทน App.tsx:
  // recording mode เป็น UI state — App.tsx ไม่ควรรู้ว่ากำลัง record อยู่
  // listener นี้ active เฉพาะตอนมี recordingId เท่านั้น
  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingId(null);
        return;
      }

      const shortcut = parseShortcutKey(e);
      if (!shortcut) return; // กด modifier เดี่ยว ยังไม่บันทึก

      const ok = onSetWidgetShortcut(recordingId, shortcut);
      if (ok) setRecordingId(null);
      // ถ้า conflict (ok = false) → toast ถูก show จาก App.tsx แล้ว อยู่ใน recording mode ต่อ
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingId, onSetWidgetShortcut]);

  // ── Condition helpers ──────────────────────────────────────────────────────
  const handleToggleConditionEnabled = useCallback(
    (widget: Widget) => {
      if (!widget.condition) {
        onSetWidgetCondition(widget.id, { ...DEFAULT_CONDITION });
        setExpandedCondition(widget.id);
      } else {
        onSetWidgetCondition(widget.id, { ...widget.condition, enabled: !widget.condition.enabled });
      }
    },
    [onSetWidgetCondition]
  );

  const handleConditionField = useCallback(
    (widgetId: string, current: WidgetCondition, field: Partial<WidgetCondition>) => {
      onSetWidgetCondition(widgetId, { ...current, ...field });
    },
    [onSetWidgetCondition]
  );

  const handleToggleDay = useCallback(
    (widgetId: string, current: WidgetCondition, day: number) => {
      const days = current.activeDays.includes(day)
        ? current.activeDays.filter((d) => d !== day)
        : [...current.activeDays, day].sort();
      onSetWidgetCondition(widgetId, { ...current, activeDays: days });
    },
    [onSetWidgetCondition]
  );

  // ── Rename helpers ─────────────────────────────────────────────────────────
  const handleRenameFocus = useCallback((widgetId: string, currentLabel: string) => {
    setRenameValues((prev) => ({ ...prev, [widgetId]: currentLabel }));
  }, []);

  const handleRenameChange = useCallback((widgetId: string, value: string) => {
    setRenameValues((prev) => ({ ...prev, [widgetId]: value }));
  }, []);

  const handleRenameCommit = useCallback(
    (widgetId: string) => {
      const draft = (renameValues[widgetId] ?? "").trim();
      if (draft) onRenameWidget(widgetId, draft);
      setRenameValues((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
    },
    [renameValues, onRenameWidget]
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, widgetId: string) => {
      if (e.key === "Enter")  { e.preventDefault(); handleRenameCommit(widgetId); }
      if (e.key === "Escape") {
        setRenameValues((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
      }
    },
    [handleRenameCommit]
  );

  if (!isOpen) return null;

  const hiddenCount = widgets.filter((w) => !w.isVisible).length;
  const stackGroups = widgets.reduce<Record<string, Widget[]>>((groups, widget) => {
    const stackId = widget.stack.stackId;
    if (!stackId) return groups;

    groups[stackId] = [...(groups[stackId] ?? []), widget].sort(
      (a, b) => a.stack.stackOrder - b.stack.stackOrder
    );
    return groups;
  }, {});
  const stackOptions = Object.entries(stackGroups).map(([stackId, stackWidgets]) => ({
    stackId,
    label: stackWidgets[0]?.label ?? stackId,
  }));

  // ── Styles ─────────────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    position: "fixed", top: 0, right: 0,
    width: "300px", height: "100vh",
    background: "var(--widget-bg)",
    borderLeft: "1px solid var(--widget-border)",
    backdropFilter: "blur(16px)",
    zIndex: 9000,
    display: "flex", flexDirection: "column",
    color: "var(--text-primary)", overflowY: "auto",
  };

  const sectionStyle: React.CSSProperties = {
    padding: "16px 18px",
    borderBottom: "1px solid var(--divider)",
    flexShrink: 0,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "10px", fontWeight: "700",
    letterSpacing: "1.5px", textTransform: "uppercase",
    color: "var(--text-secondary)", marginBottom: "12px",
  };

  const baseBtnStyle: React.CSSProperties = {
    padding: "5px 12px", borderRadius: "6px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)", color: "var(--btn-text)",
    fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: "5px 8px", borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "12px", outline: "none", fontFamily: "inherit",
  };

  const subTextStyle: React.CSSProperties = {
    fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", marginBottom: "12px",
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    ...baseBtnStyle,
    borderColor: active ? "var(--accent-color)" : "var(--btn-border)",
    color:       active ? "var(--accent-color)" : "var(--btn-text)",
    background:  active ? "color-mix(in srgb, var(--accent-color) 15%, transparent)" : "var(--btn-bg)",
  });

  const timeInputStyle: React.CSSProperties = {
    padding: "3px 6px", borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "11px", outline: "none", fontFamily: "inherit",
    width: "80px",
  };

  return (
    <div style={panelStyle}>
      {showLicenseModal && <LicenseModal onClose={() => setShowLicenseModal(false)} />}

      {/* Header */}
      <div data-tauri-drag-region style={{ ...sectionStyle, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 16px" }}>
        <div>
          <p style={{ fontSize: "15px", fontWeight: "700" }}>Settings</p>
          <p style={subTextStyle}>Ctrl+, to toggle</p>
        </div>
        <button style={{ ...baseBtnStyle, width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }} onClick={onClose}>✕</button>
      </div>

      {/* License / Premium */}
      <div style={{ ...sectionStyle, padding: "12px 18px" }}>
        {isPremium ? (
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "color-mix(in srgb, #4CAF50 10%, transparent)",
              border: "1px solid color-mix(in srgb, #4CAF50 25%, transparent)",
              borderRadius: "8px", padding: "8px 12px", cursor: "pointer",
            }}
            onClick={() => setShowLicenseModal(true)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px" }}>✓</span>
              <div>
                <p style={{ fontSize: "12px", fontWeight: "600", color: "#4CAF50" }}>Premium Active</p>
                {email && <p style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{email}</p>}
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Manage →</span>
          </div>
        ) : (
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "color-mix(in srgb, var(--accent-color) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-color) 25%, transparent)",
              borderRadius: "8px", padding: "8px 12px", cursor: "pointer",
            }}
            onClick={() => setShowLicenseModal(true)}
          >
            <div>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent-color)" }}>Upgrade to Premium</p>
              <p style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Pomodoro · Habit Tracker · More</p>
            </div>
            <span style={{ fontSize: "11px", color: "var(--accent-color)", fontWeight: "600" }}>$9 →</span>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Appearance</p>
        <div style={{ ...rowStyle, marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "13px" }}>Theme</p>
            <p style={subTextStyle}>{theme === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
          <button style={baseBtnStyle} onClick={onToggleTheme}>{theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", marginBottom: "8px" }}>Font Size</p>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["small", "medium", "large"] as const).map((s) => (
              <button key={s} style={{ ...toggleBtnStyle(fontSize === s), flex: 1, fontSize: "11px", padding: "5px 0" }} onClick={() => onSetFontSize(s)}>
                {s === "small" ? "S" : s === "medium" ? "M" : "L"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: "13px", marginBottom: "8px" }}>Accent Color</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {PRESET_COLORS.map((color) => (
              <button key={color} onClick={() => onSetAccentColor(color)} style={{ width: "24px", height: "24px", borderRadius: "50%", background: color, border: "none", cursor: "pointer", outline: accentColor === color ? "2px solid var(--text-primary)" : "2px solid transparent", outlineOffset: "2px", transition: "outline-color 0.15s ease" }} />
            ))}
            <input type="color" value={accentColor} onChange={(e) => onSetAccentColor(e.target.value)} style={{ width: "24px", height: "24px", border: "none", borderRadius: "50%", cursor: "pointer", padding: 0, background: "none" }} title="Custom color" />
          </div>
          <p style={subTextStyle}>Preview: <span style={{ color: "var(--accent-color)", fontWeight: "700" }}>Accent text</span></p>
        </div>
      </div>

      {/* Desktop */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Desktop</p>
        <div style={rowStyle}>
          <div><p style={{ fontSize: "13px" }}>Always on Top</p><p style={subTextStyle}>Float above all windows</p></div>
          <button style={toggleBtnStyle(alwaysOnTop)} onClick={() => onSetAlwaysOnTop(!alwaysOnTop)}>{alwaysOnTop ? "On" : "Off"}</button>
        </div>
        <div style={{ ...rowStyle, marginBottom: 0 }}>
          <div><p style={{ fontSize: "13px" }}>Start with Windows</p><p style={subTextStyle}>Launch on login</p></div>
          <button style={toggleBtnStyle(autostart)} onClick={() => onSetAutostart(!autostart)}>{autostart ? "On" : "Off"}</button>
        </div>
      </div>

      {/* Integrations */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Integrations</p>
        <p style={{ ...subTextStyle, marginBottom: "8px" }}>OpenWeatherMap API Key</p>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type={showApiKey ? "text" : "password"}
            value={weatherApiKey}
            onChange={(e) => onWeatherApiKeyChange(e.target.value)}
            placeholder="Paste your API key here"
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: "6px",
              border: "1px solid var(--btn-border)",
              background: "var(--btn-bg)",
              color: "var(--text-primary)",
              fontSize: "12px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            style={{ ...baseBtnStyle, padding: "4px 8px", fontSize: "11px" }}
            onClick={() => setShowApiKey((v) => !v)}
          >
            {showApiKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Add Widgets */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Add Widgets</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {addableEntries.map((entry) => {
            const locked = entry.isPremium && !isPremium;
            return (
              <button
                key={entry.type}
                style={{
                  ...baseBtnStyle,
                  flex: 1,
                  fontSize: "11px",
                  opacity: locked ? 0.65 : 1,
                  borderColor: locked ? "color-mix(in srgb, var(--accent-color) 35%, var(--btn-border))" : "var(--btn-border)",
                }}
                onClick={() => {
                  if (locked) { setShowLicenseModal(true); return; }
                  onAddWidgetInstance(entry.type);
                }}
                title={locked ? "Premium feature — click to upgrade" : undefined}
              >
                {locked ? "🔒" : "+"} {entry.displayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Widgets List */}
      <div style={{ padding: "16px 18px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>Widgets</p>
          {hiddenCount > 0 && (
            <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 7px", borderRadius: "999px", background: "color-mix(in srgb, var(--accent-color) 15%, transparent)", color: "var(--accent-color)", border: "1px solid color-mix(in srgb, var(--accent-color) 30%, transparent)", letterSpacing: "0.3px" }}>
              {hiddenCount} hidden
            </span>
          )}
        </div>

        {widgets.map((widget) => {
          const displayLabel  = getDisplayLabel(widget);
          const isEditing     = widget.id in renameValues;
          const inputValue    = isEditing ? renameValues[widget.id] : displayLabel;
          const isDeletable   = !DEFAULT_WIDGET_IDS.includes(widget.id);
          const cond          = widget.condition;
          const condEnabled   = cond?.enabled ?? false;
          const condExpanded  = expandedCondition === widget.id;
          const currentShortcut = typeof widget.data.shortcut === "string" ? widget.data.shortcut : null;
          const isRecording   = recordingId === widget.id;
          const currentStackId = widget.stack.stackId;
          const currentStackWidgets = currentStackId ? stackGroups[currentStackId] ?? [] : [];
          const joinableStacks = stackOptions.filter((option) => option.stackId !== currentStackId);
          const selectedStackTarget =
            stackTargets[widget.id] ?? joinableStacks[0]?.stackId ?? "";

          return (
            <div key={widget.id} style={{ marginBottom: "12px", padding: "11px 12px", borderRadius: "10px", border: "1px solid var(--note-border)", background: "var(--input-bg)" }}>

              {/* Type label + Remove */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <p style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{WIDGET_TYPE_ICON[widget.type]}</p>
                {isDeletable && (
                  <button style={{ ...baseBtnStyle, padding: "2px 8px", fontSize: "10px", borderColor: "var(--accent-red-border)", color: "var(--accent-red)" }} onClick={() => onRemoveWidget(widget.id)}>Remove</button>
                )}
              </div>

              {/* Rename */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <input style={inputStyle} type="text" value={inputValue} placeholder="Widget name" maxLength={50}
                  onFocus={() => handleRenameFocus(widget.id, displayLabel)}
                  onChange={(e) => handleRenameChange(widget.id, e.target.value)}
                  onBlur={() => handleRenameCommit(widget.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, widget.id)}
                />
              </div>

              {/* Visible / Lock */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <button style={{ ...baseBtnStyle, flex: 1, fontSize: "11px", padding: "4px 0", borderColor: widget.isVisible ? "var(--btn-border)" : "var(--accent-red-border)", color: widget.isVisible ? "var(--btn-text)" : "var(--accent-red)" }} onClick={() => onToggleVisible(widget.id)}>
                  {widget.isVisible ? "👁 Visible" : "🙈 Hidden"}
                </button>
                <button style={{ ...baseBtnStyle, flex: 1, fontSize: "11px", padding: "4px 0", borderColor: widget.isLocked ? "var(--accent-blue-border)" : "var(--btn-border)", color: widget.isLocked ? "var(--accent-blue)" : "var(--btn-text)" }} onClick={() => onToggleLock(widget.id)}>
                  {widget.isLocked ? "🔒 Locked" : "🔓 Free"}
                </button>
              </div>

              {/* Click-through */}
              <div style={{ marginBottom: "8px" }}>
                <button
                  style={{ ...baseBtnStyle, width: "100%", fontSize: "11px", padding: "4px 0", borderColor: widget.clickThrough ? "var(--accent-color)" : "var(--btn-border)", color: widget.clickThrough ? "var(--accent-color)" : "var(--btn-text)", background: widget.clickThrough ? "color-mix(in srgb, var(--accent-color) 10%, transparent)" : "var(--btn-bg)" }}
                  onClick={() => onSetClickThrough(widget.id, !widget.clickThrough)}
                >
                  {widget.clickThrough ? "🖱 Click-through: On" : "🖱 Click-through: Off"}
                </button>
              </div>

              {/* Opacity */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Opacity</p>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{Math.round(widget.opacity * 100)}%</p>
                </div>
                <input type="range" min={20} max={100} step={5} value={Math.round(widget.opacity * 100)}
                  onChange={(e) => onSetOpacity(widget.id, parseInt(e.target.value, 10) / 100)}
                  style={{ width: "100%", cursor: "pointer", accentColor: "var(--accent-color)" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--divider)", paddingTop: "8px", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Stack / Tabs</span>
                  {currentStackId && (
                    <span style={{ fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "999px", background: "color-mix(in srgb, var(--accent-color) 20%, transparent)", color: "var(--accent-color)", border: "1px solid color-mix(in srgb, var(--accent-color) 40%, transparent)" }}>
                      {currentStackWidgets.length} tabs
                    </span>
                  )}
                </div>

                {currentStackId ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      Current stack: {currentStackWidgets[0]?.label ?? "Stack"}
                    </p>
                    <button
                      style={{ ...baseBtnStyle, width: "100%", fontSize: "11px", color: "var(--accent-red)", borderColor: "var(--accent-red-border)" }}
                      onClick={() => onRemoveWidgetFromStack(widget.id)}
                    >
                      Remove from Stack
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button
                      style={{ ...baseBtnStyle, width: "100%", fontSize: "11px", borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
                      onClick={() => onCreateWidgetStack(widget.id)}
                    >
                      Create Stack
                    </button>

                    {joinableStacks.length > 0 && (
                      <>
                        <select
                          value={selectedStackTarget}
                          onChange={(e) =>
                            setStackTargets((prev) => ({ ...prev, [widget.id]: e.target.value }))
                          }
                          style={{ ...inputStyle, width: "100%" }}
                        >
                          {joinableStacks.map((option) => (
                            <option key={option.stackId} value={option.stackId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          style={{ ...baseBtnStyle, width: "100%", fontSize: "11px" }}
                          onClick={() => {
                            if (!selectedStackTarget) return;
                            onAddWidgetToStack(widget.id, selectedStackTarget);
                          }}
                        >
                          Join Existing Stack
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Keyboard Shortcut ─────────────────────────────────────── */}
              <div style={{ borderTop: "1px solid var(--divider)", paddingTop: "8px", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>⌨ Shortcut</span>
                  {currentShortcut && !isRecording && (
                    <button
                      style={{ ...baseBtnStyle, padding: "1px 6px", fontSize: "10px", borderColor: "var(--accent-red-border)", color: "var(--accent-red)" }}
                      onClick={() => onSetWidgetShortcut(widget.id, null)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {isRecording ? (
                  // Recording mode — แสดง pulsing box รอรับ key
                  <div
                    style={{
                      padding: "8px 10px", borderRadius: "6px",
                      border: "1px solid var(--accent-color)",
                      background: "color-mix(in srgb, var(--accent-color) 10%, transparent)",
                      textAlign: "center",
                      animation: "pulse 1s ease infinite",
                    }}
                  >
                    <p style={{ fontSize: "11px", color: "var(--accent-color)", fontWeight: "700" }}>
                      Press shortcut key…
                    </p>
                    <p style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Esc to cancel
                    </p>
                  </div>
                ) : (
                  <button
                    style={{
                      ...baseBtnStyle, width: "100%", padding: "6px 0", fontSize: "11px",
                      borderColor: currentShortcut ? "var(--accent-color)" : "var(--btn-border)",
                      color:       currentShortcut ? "var(--accent-color)" : "var(--text-secondary)",
                      background:  currentShortcut
                        ? "color-mix(in srgb, var(--accent-color) 10%, transparent)"
                        : "var(--btn-bg)",
                      fontWeight:  currentShortcut ? "700" : "400",
                    }}
                    onClick={() => setRecordingId(widget.id)}
                  >
                    {currentShortcut ?? "Click to set shortcut"}
                  </button>
                )}
              </div>

              {/* ── Conditional Display ───────────────────────────────────── */}
              <div style={{ borderTop: "1px solid var(--divider)", paddingTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>⏰ Schedule</span>
                    {condEnabled && (
                      <span style={{ fontSize: "9px", fontWeight: "700", padding: "1px 5px", borderRadius: "999px", background: "color-mix(in srgb, var(--accent-color) 20%, transparent)", color: "var(--accent-color)", border: "1px solid color-mix(in srgb, var(--accent-color) 40%, transparent)" }}>ON</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      style={{ ...baseBtnStyle, padding: "2px 8px", fontSize: "10px", borderColor: condEnabled ? "var(--accent-color)" : "var(--btn-border)", color: condEnabled ? "var(--accent-color)" : "var(--btn-text)" }}
                      onClick={() => handleToggleConditionEnabled(widget)}
                    >
                      {condEnabled ? "On" : "Off"}
                    </button>
                    {cond && (
                      <button
                        style={{ ...baseBtnStyle, padding: "2px 7px", fontSize: "11px" }}
                        onClick={() => setExpandedCondition(condExpanded ? null : widget.id)}
                      >
                        {condExpanded ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                </div>

                {cond && condExpanded && (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>
                      <p style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>Active hours</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="time" value={cond.timeStart} style={timeInputStyle}
                          onChange={(e) => handleConditionField(widget.id, cond, { timeStart: e.target.value })} />
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>–</span>
                        <input type="time" value={cond.timeEnd} style={timeInputStyle}
                          onChange={(e) => handleConditionField(widget.id, cond, { timeEnd: e.target.value })} />
                      </div>
                      {cond.timeStart > cond.timeEnd && (
                        <p style={{ fontSize: "10px", color: "var(--accent-color)", marginTop: "3px" }}>↪ Overnight schedule</p>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600" }}>
                        Active days
                        <span style={{ marginLeft: "4px", fontWeight: "400" }}>{cond.activeDays.length === 0 ? "(every day)" : ""}</span>
                      </p>
                      <div style={{ display: "flex", gap: "3px" }}>
                        {DAY_LABELS.map((label, idx) => {
                          const active = cond.activeDays.includes(idx);
                          return (
                            <button key={idx}
                              style={{ flex: 1, padding: "3px 0", fontSize: "10px", borderRadius: "4px", border: "1px solid", borderColor: active ? "var(--accent-color)" : "var(--btn-border)", background: active ? "color-mix(in srgb, var(--accent-color) 20%, transparent)" : "var(--btn-bg)", color: active ? "var(--accent-color)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", fontWeight: active ? "700" : "400", transition: "all 0.12s" }}
                              onClick={() => handleToggleDay(widget.id, cond, idx)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      style={{ ...baseBtnStyle, fontSize: "10px", padding: "3px 0", width: "100%", color: "var(--accent-red)", borderColor: "var(--accent-red-border)" }}
                      onClick={() => { onSetWidgetCondition(widget.id, null); setExpandedCondition(null); }}
                    >
                      Remove Schedule
                    </button>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Layout — Export / Import / Reset */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--divider)", flexShrink: 0 }}>
        <p style={sectionTitleStyle}>Layout</p>
        <button style={{ ...baseBtnStyle, width: "100%", padding: "7px 0", fontSize: "12px", marginBottom: "8px" }} onClick={onExportLayout}>
          ⬆ Export Layout
        </button>
        {showImportConfirm ? (
          <div style={{ marginBottom: "8px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-primary)", marginBottom: "10px", lineHeight: "1.5" }}>This will replace all widgets and settings. Continue?</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ ...baseBtnStyle, flex: 1, padding: "7px 0", fontSize: "12px" }} onClick={() => setShowImportConfirm(false)}>Cancel</button>
              <button style={{ ...baseBtnStyle, flex: 1, padding: "7px 0", fontSize: "12px", borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
                onClick={() => { onImportLayout(); setShowImportConfirm(false); }}>⬇ Import</button>
            </div>
          </div>
        ) : (
          <button style={{ ...baseBtnStyle, width: "100%", padding: "7px 0", fontSize: "12px", marginBottom: "8px" }} onClick={() => setShowImportConfirm(true)}>
            ⬇ Import Layout
          </button>
        )}
        {showResetConfirm ? (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-primary)", marginBottom: "10px", lineHeight: "1.5" }}>Reset all widgets to their default positions and sizes?</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ ...baseBtnStyle, flex: 1, padding: "7px 0", fontSize: "12px" }} onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={{ ...baseBtnStyle, flex: 1, padding: "7px 0", fontSize: "12px", borderColor: "var(--accent-red-border)", color: "var(--accent-red)", background: "color-mix(in srgb, var(--accent-red) 10%, transparent)" }}
                onClick={() => { onResetLayout(); setShowResetConfirm(false); }}>↺ Reset</button>
            </div>
          </div>
        ) : (
          <div>
            <button style={{ ...baseBtnStyle, width: "100%", padding: "8px", borderColor: "var(--accent-red-border)", color: "var(--accent-red)" }} onClick={() => setShowResetConfirm(true)}>↺ Reset Layout</button>
            <p style={{ ...subTextStyle, textAlign: "center", marginTop: "6px" }}>Resets position and size of all widgets</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
