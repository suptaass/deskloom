// src/components/widgets/NotesWidget.tsx

import React, { useState, useCallback, useRef } from "react";
import { Widget } from "../../types/widget";

interface NotesWidgetProps {
  widget: Widget;
  onAdd: () => void;
  onUpdate: (noteId: string, changes: { title?: string; content?: string }) => void;
  onDelete: (noteId: string) => void;
}

const CONTENT_MAX = 500;
const CONTENT_WARN_THRESHOLD = 50;

const NotesWidget: React.FC<NotesWidgetProps> = ({ widget, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [draftTitle, setDraftTitle]       = useState("");
  const [draftContent, setDraftContent]   = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const noteCount = widget.notes.length;

  const handleStartEdit = useCallback((noteId: string) => {
    const note = widget.notes.find((n) => n.id === noteId);
    if (!note) return;
    setEditingId(noteId); setDraftTitle(note.title); setDraftContent(note.content);
  }, [widget.notes]);

  const handleSave = useCallback((noteId: string) => {
    onUpdate(noteId, { title: draftTitle.trim() || "Untitled", content: draftContent });
    setEditingId(null);
  }, [onUpdate, draftTitle, draftContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null); setDraftTitle(""); setDraftContent("");
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") { e.preventDefault(); contentRef.current?.focus(); }
      if (e.key === "Escape") handleCancelEdit();
    }, [handleCancelEdit]);

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: string) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSave(noteId); }
      if (e.key === "Escape") handleCancelEdit();
    }, [handleSave, handleCancelEdit]);

  const charsLeft       = CONTENT_MAX - draftContent.length;
  const showCharWarning = editingId !== null && charsLeft <= CONTENT_WARN_THRESHOLD;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "5px 8px", borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "var(--font-size-base)", outline: "none", fontFamily: "inherit",  // ← เปลี่ยน
  };

  const actionBtnStyle: React.CSSProperties = {
    fontSize: "10px", padding: "3px 9px", borderRadius: "4px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)", color: "var(--btn-text)",
    cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--widget-bg)", borderRadius: "14px",
      border: "1px solid var(--widget-border)",
      display: "flex", flexDirection: "column",
      color: "var(--text-primary)", padding: "14px",
      backdropFilter: "blur(8px)", overflow: "hidden",
      fontSize: "var(--font-size-base)",  // ← เพิ่ม
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: "10px", flexShrink: 0,
      }}>
        <div>
          <p style={{ fontSize: "var(--font-size-base)", fontWeight: "700" }}>
            {widget.label}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </p>
        </div>
        <button
          style={{
            ...actionBtnStyle,
            borderColor: "var(--accent-color)",   // ← เปลี่ยนจาก --accent-blue
            color: "var(--accent-color)",          // ← เปลี่ยน
          }}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >+ New</button>
      </div>

      <div style={{
        height: "1px", background: "var(--divider)",
        marginBottom: "10px", flexShrink: 0,
      }} />

      {/* Notes list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {noteCount === 0 ? (
          <p style={{
            fontSize: "12px", color: "var(--text-dim)",
            textAlign: "center", paddingTop: "16px",
          }}>
            No notes yet — press "+ New" to create one
          </p>
        ) : (
          widget.notes.map((note) =>
            editingId === note.id ? (
              <div key={note.id} style={{
                border: "1px solid var(--accent-color)",           // ← เปลี่ยน
                borderRadius: "8px", padding: "10px",
                background: "color-mix(in srgb, var(--accent-color) 8%, transparent)",  // ← เปลี่ยน
                display: "flex", flexDirection: "column", gap: "6px",
              }}>
                <input
                  style={{ ...inputStyle, fontWeight: "600" }}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Title"
                  maxLength={100}
                />
                <textarea
                  ref={contentRef}
                  style={{ ...inputStyle, resize: "vertical", minHeight: "70px", lineHeight: "1.5" }}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value.slice(0, CONTENT_MAX))}
                  onKeyDown={(e) => handleContentKeyDown(e, note.id)}
                  placeholder="Content (Ctrl+Enter to save)"
                  rows={3}
                />
                {showCharWarning && editingId === note.id && (
                  <p style={{
                    fontSize: "10px", textAlign: "right",
                    color: charsLeft <= 10 ? "var(--accent-red)" : "rgba(255,200,80,0.8)",
                  }}>
                    {charsLeft} characters left
                  </p>
                )}
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    style={actionBtnStyle}
                    onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                  >Cancel</button>
                  <button
                    style={{
                      ...actionBtnStyle,
                      borderColor: "var(--accent-color)",   // ← เปลี่ยน
                      color: "var(--accent-color)",          // ← เปลี่ยน
                    }}
                    onClick={(e) => { e.stopPropagation(); handleSave(note.id); }}
                  >Save</button>
                </div>
              </div>
            ) : (
              <div key={note.id} style={{
                border: "1px solid var(--note-border)", borderRadius: "8px", padding: "9px 10px",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: "8px",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "var(--font-size-base)", fontWeight: "600", marginBottom: "3px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: "var(--text-primary)",
                    }}>{note.title}</p>
                    {note.content && (
                      <p style={{
                        fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4",
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      }}>
                        {note.content}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      style={actionBtnStyle}
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(note.id); }}
                    >Edit</button>
                    <button
                      style={{ ...actionBtnStyle, borderColor: "var(--accent-red-border)", color: "var(--accent-red)" }}
                      onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                    >×</button>
                  </div>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
};

export default NotesWidget;