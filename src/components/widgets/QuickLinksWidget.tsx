// src/components/widgets/QuickLinksWidget.tsx

import React, { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Widget } from "../../types/widget";

interface QuickLink {
  id: string;
  label: string;
  url: string;
}

interface QuickLinksWidgetProps {
  widget: Widget;
  onUpdateData: (widgetId: string, data: Record<string, unknown>) => void;
}

function getLinks(widget: Widget): QuickLink[] {
  const raw = widget.data.links;
  if (!Array.isArray(raw)) return [];
  return raw as QuickLink[];
}

const QuickLinksWidget: React.FC<QuickLinksWidgetProps> = ({ widget, onUpdateData }) => {
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl]     = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError]       = useState("");

  const links = getLinks(widget);

  const handleOpen = useCallback(async (url: string) => {
    try {
      let target = url.trim();
      if (!target.startsWith("http://") && !target.startsWith("https://")) {
        target = `https://${target}`;
      }
      await open(target);
    } catch (e) {
      console.error("[QuickLinks] failed to open:", e);
    }
  }, []);

  const handleAdd = useCallback(() => {
    const trimLabel = newLabel.trim();
    const trimUrl   = newUrl.trim();

    if (!trimLabel) { setError("Label is required"); return; }
    if (!trimUrl)   { setError("URL is required");   return; }

    const newLink: QuickLink = {
      id:    crypto.randomUUID(),
      label: trimLabel,
      url:   trimUrl,
    };

    const updated = [...links, newLink];
    onUpdateData(widget.id, { ...widget.data, links: updated });

    setNewLabel("");
    setNewUrl("");
    setError("");
    setIsAdding(false);
  }, [newLabel, newUrl, links, widget.id, widget.data, onUpdateData]);

  const handleDelete = useCallback((id: string) => {
    const updated = links.filter((l) => l.id !== id);
    onUpdateData(widget.id, { ...widget.data, links: updated });
  }, [links, widget.id, widget.data, onUpdateData]);

  const handleCancelAdd = useCallback(() => {
    setNewLabel("");
    setNewUrl("");
    setError("");
    setIsAdding(false);
  }, []);

  const containerStyle: React.CSSProperties = {
    width:          "100%",
    height:         "100%",
    background:     "var(--widget-bg)",
    borderRadius:   "14px",
    border:         "1px solid var(--widget-border)",
    backdropFilter: "blur(12px)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
  };

  const headerStyle: React.CSSProperties = {
    padding:        "10px 12px 8px",
    borderBottom:   "1px solid var(--divider)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexShrink:     0,
  };

  const inputStyle: React.CSSProperties = {
    width:       "100%",
    padding:     "5px 8px",
    borderRadius:"5px",
    border:      "1px solid var(--input-border)",
    background:  "var(--input-bg)",
    color:       "var(--text-primary)",
    fontSize:    "12px",
    outline:     "none",
    fontFamily:  "inherit",
    boxSizing:   "border-box",
  };

  const btnStyle: React.CSSProperties = {
    padding:     "4px 10px",
    borderRadius:"5px",
    border:      "1px solid var(--btn-border)",
    background:  "var(--btn-bg)",
    color:       "var(--btn-text)",
    fontSize:    "11px",
    cursor:      "pointer",
    fontFamily:  "inherit",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
          🔗 {widget.label}
        </span>
        {!isAdding && (
          <button
            style={{ ...btnStyle, borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
            onClick={() => setIsAdding(true)}
          >
            + Add
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
          <input
            style={{ ...inputStyle, marginBottom: "6px" }}
            type="text"
            placeholder="Label (e.g. GitHub)"
            value={newLabel}
            maxLength={40}
            onChange={(e) => { setNewLabel(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") handleCancelAdd(); }}
            autoFocus
          />
          <input
            style={{ ...inputStyle, marginBottom: "6px" }}
            type="text"
            placeholder="URL (e.g. github.com)"
            value={newUrl}
            maxLength={200}
            onChange={(e) => { setNewUrl(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") handleCancelAdd(); }}
          />
          {error && (
            <p style={{ fontSize: "11px", color: "var(--accent-red)", marginBottom: "6px" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={{ ...btnStyle, flex: 1 }} onClick={handleCancelAdd}>Cancel</button>
            <button
              style={{ ...btnStyle, flex: 1, borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
              onClick={handleAdd}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Links List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {links.length === 0 && (
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", marginTop: "16px" }}>
            No links yet.{"\n"}Click + Add to get started.
          </p>
        )}
        {links.map((link) => (
          <div
            key={link.id}
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "7px 8px",
              borderRadius:   "7px",
              marginBottom:   "5px",
              border:         "1px solid var(--note-border)",
              background:     "var(--input-bg)",
              gap:            "8px",
            }}
          >
            {/* Link Button */}
            <button
              style={{
                flex:            1,
                background:      "none",
                border:          "none",
                color:           "var(--accent-color)",
                fontSize:        "12px",
                fontWeight:      "600",
                cursor:          "pointer",
                textAlign:       "left",
                padding:         0,
                fontFamily:      "inherit",
                overflow:        "hidden",
                textOverflow:    "ellipsis",
                whiteSpace:      "nowrap",
              }}
              onClick={() => handleOpen(link.url)}
              title={link.url}
            >
              {link.label}
            </button>

            {/* Delete Button */}
            <button
              style={{
                ...btnStyle,
                padding:     "2px 7px",
                fontSize:    "10px",
                borderColor: "var(--accent-red-border)",
                color:       "var(--accent-red)",
                flexShrink:  0,
              }}
              onClick={() => handleDelete(link.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickLinksWidget;