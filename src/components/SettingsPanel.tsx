// src/components/SettingsPanel.tsx

import React, { useState, useCallback } from "react";
import { Widget } from "../types/widget";

const DEFAULT_WIDGET_IDS = ["clock-1", "todo-1", "notes-1"];

interface SettingsPanelProps {
  isOpen: boolean;
  widgets: Widget[];
  theme: "dark" | "light";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  autostart: boolean;
  alwaysOnTop: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleVisible: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  onRenameWidget: (widgetId: string, newLabel: string) => void;
  onResetLayout: () => void;
  onSetAccentColor: (color: string) => void;
  onSetFontSize: (size: "small" | "medium" | "large") => void;
  onSetOpacity: (widgetId: string, opacity: number) => void;
  onAddWidgetInstance: (type: "todo" | "notes") => void;
  onRemoveWidget: (widgetId: string) => void;
  onSetAlwaysOnTop: (value: boolean) => void;
  onSetAutostart: (value: boolean) => void;
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

const WIDGET_TYPE_ICON: Record<Widget["type"], string> = {
  clock: "🕐 Clock",
  todo: "✅ Todo",
  notes: "📝 Notes",
};

const PRESET_COLORS = [
  "#6C8EF5",
  "#F56C8E",
  "#8EF56C",
  "#F5C86C",
  "#6CF5E8",
  "#C86CF5",
  "#F5906C",
  "#6CF59A",
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  widgets,
  theme,
  accentColor,
  fontSize,
  autostart,
  alwaysOnTop,
  onClose,
  onToggleTheme,
  onToggleVisible,
  onToggleLock,
  onRenameWidget,
  onResetLayout,
  onSetAccentColor,
  onSetFontSize,
  onSetOpacity,
  onAddWidgetInstance,
  onRemoveWidget,
  onSetAlwaysOnTop,
  onSetAutostart,
}) => {
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

      setRenameValues((prev) => {
        const next = { ...prev };
        delete next[widgetId];
        return next;
      });
    },
    [renameValues, onRenameWidget]
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, widgetId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameCommit(widgetId);
      }

      if (e.key === "Escape") {
        setRenameValues((prev) => {
          const next = { ...prev };
          delete next[widgetId];
          return next;
        });
      }
    },
    [handleRenameCommit]
  );

  if (!isOpen) return null;

  const hiddenCount = widgets.filter((w) => !w.isVisible).length;

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    width: "300px",
    height: "100vh",
    background: "var(--widget-bg)",
    borderLeft: "1px solid var(--widget-border)",
    backdropFilter: "blur(16px)",
    zIndex: 9000,
    display: "flex",
    flexDirection: "column",
    color: "var(--text-primary)",
    overflowY: "auto",
  };

  const sectionStyle: React.CSSProperties = {
    padding: "16px 18px",
    borderBottom: "1px solid var(--divider)",
    flexShrink: 0,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    marginBottom: "12px",
  };

  const baseBtnStyle: React.CSSProperties = {
    padding: "5px 12px",
    borderRadius: "6px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)",
    color: "var(--btn-text)",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "5px 8px",
    borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "12px",
    outline: "none",
    fontFamily: "inherit",
  };

  const subTextStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--text-secondary)",
    marginTop: "2px",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    ...baseBtnStyle,
    borderColor: active ? "var(--accent-color)" : "var(--btn-border)",
    color: active ? "var(--accent-color)" : "var(--btn-text)",
    background: active
      ? "color-mix(in srgb, var(--accent-color) 15%, transparent)"
      : "var(--btn-bg)",
  });

  return (
    <div style={panelStyle}>
      <div
        style={{
          ...sectionStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 18px 16px",
        }}
      >
        <div>
          <p style={{ fontSize: "15px", fontWeight: "700" }}>Settings</p>
          <p style={subTextStyle}>Ctrl+, to toggle</p>
        </div>
        <button
          style={{
            ...baseBtnStyle,
            width: "30px",
            height: "30px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
          }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Appearance</p>

        <div style={{ ...rowStyle, marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "13px" }}>Theme</p>
            <p style={subTextStyle}>{theme === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
          <button style={baseBtnStyle} onClick={onToggleTheme}>
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", marginBottom: "8px" }}>Font Size</p>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["small", "medium", "large"] as const).map((s) => (
              <button
                key={s}
                style={{ ...toggleBtnStyle(fontSize === s), flex: 1, fontSize: "11px", padding: "5px 0" }}
                onClick={() => onSetFontSize(s)}
              >
                {s === "small" ? "S" : s === "medium" ? "M" : "L"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: "13px", marginBottom: "8px" }}>Accent Color</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onSetAccentColor(color)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: color,
                  border: "none",
                  cursor: "pointer",
                  outline: accentColor === color ? "2px solid var(--text-primary)" : "2px solid transparent",
                  outlineOffset: "2px",
                  transition: "outline-color 0.15s ease",
                }}
              />
            ))}
            <input
              type="color"
              value={accentColor}
              onChange={(e) => onSetAccentColor(e.target.value)}
              style={{
                width: "24px",
                height: "24px",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                padding: 0,
                background: "none",
              }}
              title="Custom color"
            />
          </div>
          <p style={subTextStyle}>
            Preview: <span style={{ color: "var(--accent-color)", fontWeight: "700" }}>Accent text</span>
          </p>
        </div>
      </div>

      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Desktop</p>

        <div style={rowStyle}>
          <div>
            <p style={{ fontSize: "13px" }}>Always on Top</p>
            <p style={subTextStyle}>Float above all windows</p>
          </div>
          <button style={toggleBtnStyle(alwaysOnTop)} onClick={() => onSetAlwaysOnTop(!alwaysOnTop)}>
            {alwaysOnTop ? "On" : "Off"}
          </button>
        </div>

        <div style={{ ...rowStyle, marginBottom: 0 }}>
          <div>
            <p style={{ fontSize: "13px" }}>Start with Windows</p>
            <p style={subTextStyle}>Launch on login</p>
          </div>
          <button style={toggleBtnStyle(autostart)} onClick={() => onSetAutostart(!autostart)}>
            {autostart ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Add Widgets</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={{ ...baseBtnStyle, flex: 1, fontSize: "11px" }} onClick={() => onAddWidgetInstance("todo")}>
            + Todo
          </button>
          <button style={{ ...baseBtnStyle, flex: 1, fontSize: "11px" }} onClick={() => onAddWidgetInstance("notes")}>
            + Notes
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 18px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <p style={{ ...sectionTitleStyle, marginBottom: 0 }}>Widgets</p>
          {hiddenCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                padding: "1px 7px",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--accent-color) 15%, transparent)",
                color: "var(--accent-color)",
                border: "1px solid color-mix(in srgb, var(--accent-color) 30%, transparent)",
                letterSpacing: "0.3px",
              }}
            >
              {hiddenCount} hidden
            </span>
          )}
        </div>

        {widgets.map((widget) => {
          const displayLabel = getDisplayLabel(widget);
          const isEditing = widget.id in renameValues;
          const inputValue = isEditing ? renameValues[widget.id] : displayLabel;
          const isDeletable = !DEFAULT_WIDGET_IDS.includes(widget.id);

          return (
            <div
              key={widget.id}
              style={{
                marginBottom: "12px",
                padding: "11px 12px",
                borderRadius: "10px",
                border: "1px solid var(--note-border)",
                background: "var(--input-bg)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <p style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{WIDGET_TYPE_ICON[widget.type]}</p>
                {isDeletable && (
                  <button
                    style={{
                      ...baseBtnStyle,
                      padding: "2px 8px",
                      fontSize: "10px",
                      borderColor: "var(--accent-red-border)",
                      color: "var(--accent-red)",
                    }}
                    onClick={() => onRemoveWidget(widget.id)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <input
                  style={inputStyle}
                  type="text"
                  value={inputValue}
                  placeholder="Widget name"
                  maxLength={50}
                  onFocus={() => handleRenameFocus(widget.id, displayLabel)}
                  onChange={(e) => handleRenameChange(widget.id, e.target.value)}
                  onBlur={() => handleRenameCommit(widget.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, widget.id)}
                />
              </div>

              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <button
                  style={{
                    ...baseBtnStyle,
                    flex: 1,
                    fontSize: "11px",
                    padding: "4px 0",
                    borderColor: widget.isVisible ? "var(--btn-border)" : "var(--accent-red-border)",
                    color: widget.isVisible ? "var(--btn-text)" : "var(--accent-red)",
                  }}
                  onClick={() => onToggleVisible(widget.id)}
                >
                  {widget.isVisible ? "👁 Visible" : "🙈 Hidden"}
                </button>
                <button
                  style={{
                    ...baseBtnStyle,
                    flex: 1,
                    fontSize: "11px",
                    padding: "4px 0",
                    borderColor: widget.isLocked ? "var(--accent-blue-border)" : "var(--btn-border)",
                    color: widget.isLocked ? "var(--accent-blue)" : "var(--btn-text)",
                  }}
                  onClick={() => onToggleLock(widget.id)}
                >
                  {widget.isLocked ? "🔒 Locked" : "🔓 Free"}
                </button>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Opacity</p>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{Math.round(widget.opacity * 100)}%</p>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={Math.round(widget.opacity * 100)}
                  onChange={(e) => onSetOpacity(widget.id, parseInt(e.target.value, 10) / 100)}
                  style={{ width: "100%", cursor: "pointer", accentColor: "var(--accent-color)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid var(--divider)",
          flexShrink: 0,
        }}
      >
        <p style={sectionTitleStyle}>Layout</p>

        {showResetConfirm ? (
          <div>
            <p style={{ fontSize: "12px", color: "var(--text-primary)", marginBottom: "10px", lineHeight: "1.5" }}>
              Reset all widgets to their default positions and sizes?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ ...baseBtnStyle, flex: 1, padding: "7px 0", fontSize: "12px" }} onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...baseBtnStyle,
                  flex: 1,
                  padding: "7px 0",
                  fontSize: "12px",
                  borderColor: "var(--accent-red-border)",
                  color: "var(--accent-red)",
                  background: "color-mix(in srgb, var(--accent-red) 10%, transparent)",
                }}
                onClick={() => {
                  onResetLayout();
                  setShowResetConfirm(false);
                }}
              >
                ↺ Reset
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              style={{
                ...baseBtnStyle,
                width: "100%",
                padding: "8px",
                borderColor: "var(--accent-red-border)",
                color: "var(--accent-red)",
              }}
              onClick={() => setShowResetConfirm(true)}
            >
              ↺ Reset Layout
            </button>
            <p style={{ ...subTextStyle, textAlign: "center", marginTop: "6px" }}>Resets position and size of all widgets</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;