import React, { useState, useCallback, useEffect, useRef } from "react";
import { RichTextSpan, Widget } from "../../types/widget";
import {
  createPlainTextNoteDocument,
  getNotePreviewLines,
  getPlainTextFromNoteDocument,
  isNoteDocumentEmpty,
} from "../../utils/notes";

interface NotesWidgetProps {
  widget: Widget;
  onAdd: () => void;
  onUpdate: (
    noteId: string,
    changes: { title?: string; document?: Widget["notes"][number]["document"] }
  ) => void;
  onDelete: (noteId: string) => void;
}

const CONTENT_MAX = 500;
const CONTENT_WARN_THRESHOLD = 50;
const TOOLBAR_BUTTONS = [
  { key: "bullet", label: "• List" },
  { key: "bold", label: "Bold" },
  { key: "italic", label: "Italic" },
  { key: "link", label: "Link" },
] as const;

type ToolbarAction = (typeof TOOLBAR_BUTTONS)[number]["key"];

function renderRichText(spans: RichTextSpan[], keyPrefix: string): React.ReactNode[] {
  return spans.map((span, index) => {
    const style: React.CSSProperties = {
      fontWeight: span.bold ? "700" : undefined,
      fontStyle: span.italic ? "italic" : undefined,
    };

    if (span.link) {
      return (
        <a
          key={`${keyPrefix}-${index}`}
          href={span.link}
          target="_blank"
          rel="noreferrer"
          style={{ ...style, color: "var(--accent-color)", textDecoration: "underline" }}
          onClick={(e) => e.stopPropagation()}
        >
          {span.text}
        </a>
      );
    }

    return (
      <span key={`${keyPrefix}-${index}`} style={style}>
        {span.text}
      </span>
    );
  });
}

const NotesWidget: React.FC<NotesWidgetProps> = ({ widget, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const prevNoteIdsRef = useRef<string[]>(widget.notes.map((note) => note.id));
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const noteCount = widget.notes.length;
  const charsLeft = CONTENT_MAX - draftContent.length;
  const showCharWarning = editingId !== null && charsLeft <= CONTENT_WARN_THRESHOLD;

  const handleStartEdit = useCallback(
    (noteId: string) => {
      const note = widget.notes.find((item) => item.id === noteId);
      if (!note) return;

      setEditingId(noteId);
      setDraftTitle(note.title);
      setDraftContent(getPlainTextFromNoteDocument(note.document));
    },
    [widget.notes]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
  }, []);

  const handleSave = useCallback(
    (noteId: string) => {
      onUpdate(noteId, {
        title: draftTitle.trim() || "Untitled",
        document: createPlainTextNoteDocument(draftContent),
      });
      handleCancelEdit();
    },
    [draftContent, draftTitle, handleCancelEdit, onUpdate]
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        contentRef.current?.focus();
      }
      if (e.key === "Escape") handleCancelEdit();
    },
    [handleCancelEdit]
  );

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: string) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave(noteId);
      }
      if (e.key === "Escape") handleCancelEdit();
    },
    [handleCancelEdit, handleSave]
  );

  const applyDraftContent = useCallback(
    (
      transform: (
        text: string,
        selectionStart: number,
        selectionEnd: number
      ) => { nextText: string; nextSelectionStart: number; nextSelectionEnd: number }
    ) => {
      const textarea = contentRef.current;
      if (!textarea) return;

      const { nextText, nextSelectionStart, nextSelectionEnd } = transform(
        draftContent,
        textarea.selectionStart,
        textarea.selectionEnd
      );

      setDraftContent(nextText.slice(0, CONTENT_MAX));

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      });
    },
    [draftContent]
  );

  const handleToolbarAction = useCallback(
    (action: ToolbarAction) => {
      if (action === "bold") {
        applyDraftContent((text, start, end) => {
          const selected = text.slice(start, end) || "bold text";
          const replacement = `**${selected}**`;
          return {
            nextText: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
            nextSelectionStart: start + 2,
            nextSelectionEnd: start + 2 + selected.length,
          };
        });
        return;
      }

      if (action === "italic") {
        applyDraftContent((text, start, end) => {
          const selected = text.slice(start, end) || "italic text";
          const replacement = `*${selected}*`;
          return {
            nextText: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
            nextSelectionStart: start + 1,
            nextSelectionEnd: start + 1 + selected.length,
          };
        });
        return;
      }

      if (action === "link") {
        const textarea = contentRef.current;
        if (!textarea) return;

        const selected = draftContent.slice(textarea.selectionStart, textarea.selectionEnd).trim();
        const suggestedUrl =
          selected.startsWith("http://") ||
          selected.startsWith("https://") ||
          selected.startsWith("www.")
            ? selected
            : "https://";
        const url = window.prompt("Enter link URL", suggestedUrl);
        if (!url || !url.trim()) return;

        applyDraftContent((text, start, end) => {
          const label = text.slice(start, end) || "link text";
          const replacement = `[${label}](${url.trim()})`;
          return {
            nextText: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
            nextSelectionStart: start + 1,
            nextSelectionEnd: start + 1 + label.length,
          };
        });
        return;
      }

      applyDraftContent((text, start, end) => {
        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = text.indexOf("\n", end);
        const targetEnd = lineEnd === -1 ? text.length : lineEnd;
        const block = text.slice(lineStart, targetEnd);
        const updatedBlock = block
          .split("\n")
          .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
          .join("\n");

        return {
          nextText: `${text.slice(0, lineStart)}${updatedBlock}${text.slice(targetEnd)}`,
          nextSelectionStart: lineStart,
          nextSelectionEnd: lineStart + updatedBlock.length,
        };
      });
    },
    [applyDraftContent, draftContent]
  );

  useEffect(() => {
    const previousIds = prevNoteIdsRef.current;
    const currentIds = widget.notes.map((note) => note.id);
    prevNoteIdsRef.current = currentIds;

    if (currentIds.length <= previousIds.length || editingId !== null) return;

    const newNote = widget.notes.find((note) => !previousIds.includes(note.id));
    if (!newNote) return;
    if (newNote.title !== "Untitled" || !isNoteDocumentEmpty(newNote.document)) return;

    setEditingId(newNote.id);
    setDraftTitle(newNote.title);
    setDraftContent("");
  }, [editingId, widget.notes]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    borderRadius: "5px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "var(--font-size-base)",
    outline: "none",
    fontFamily: "inherit",
  };

  const actionBtnStyle: React.CSSProperties = {
    fontSize: "10px",
    padding: "3px 9px",
    borderRadius: "4px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)",
    color: "var(--btn-text)",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--widget-bg)",
        borderRadius: "14px",
        border: "1px solid var(--widget-border)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text-primary)",
        padding: "14px",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        fontSize: "var(--font-size-base)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ fontSize: "var(--font-size-base)", fontWeight: "700" }}>{widget.label}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </p>
        </div>
        <button
          data-widget-interactive="true"
          style={{
            ...actionBtnStyle,
            borderColor: "var(--accent-color)",
            color: "var(--accent-color)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          + New
        </button>
      </div>

      <div
        style={{
          height: "1px",
          background: "var(--divider)",
          marginBottom: "10px",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {noteCount === 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-dim)",
              textAlign: "center",
              paddingTop: "16px",
            }}
          >
            No notes yet - press "+ New" to create one
          </p>
        ) : (
          widget.notes.map((note) => {
            const previewLines = getNotePreviewLines(note.document);

            if (editingId === note.id) {
              return (
                <div
                  key={note.id}
                  style={{
                    border: "1px solid var(--accent-color)",
                    borderRadius: "8px",
                    padding: "10px",
                    background: "color-mix(in srgb, var(--accent-color) 8%, transparent)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <input
                    data-widget-interactive="true"
                    style={{ ...inputStyle, fontWeight: "600" }}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    placeholder="Title"
                    maxLength={100}
                  />
                  <div
                    data-widget-interactive="true"
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
                    {TOOLBAR_BUTTONS.map((button) => (
                      <button
                        key={button.key}
                        data-widget-interactive="true"
                        style={{
                          ...actionBtnStyle,
                          borderColor: "var(--accent-color)",
                          color: "var(--accent-color)",
                          background: "color-mix(in srgb, var(--accent-color) 8%, transparent)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToolbarAction(button.key);
                        }}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={contentRef}
                    data-widget-interactive="true"
                    style={{ ...inputStyle, resize: "vertical", minHeight: "70px", lineHeight: "1.5" }}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value.slice(0, CONTENT_MAX))}
                    onKeyDown={(e) => handleContentKeyDown(e, note.id)}
                    placeholder="Content (Ctrl+Enter to save)"
                    rows={3}
                  />
                  <p
                    data-widget-interactive="true"
                    style={{ fontSize: "10px", color: "var(--text-secondary)" }}
                  >
                    Tip: use the toolbar or type `-`, `**bold**`, `*italic*`, or `[text](url)`.
                  </p>
                  {showCharWarning && (
                    <p
                      data-widget-interactive="true"
                      style={{
                        fontSize: "10px",
                        textAlign: "right",
                        color: charsLeft <= 10 ? "var(--accent-red)" : "rgba(255,200,80,0.8)",
                      }}
                    >
                      {charsLeft} characters left
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      data-widget-interactive="true"
                      style={actionBtnStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      data-widget-interactive="true"
                      style={{
                        ...actionBtnStyle,
                        borderColor: "var(--accent-color)",
                        color: "var(--accent-color)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(note.id);
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={note.id}
                style={{
                  border: "1px solid var(--note-border)",
                  borderRadius: "8px",
                  padding: "9px 10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "var(--font-size-base)",
                        fontWeight: "600",
                        marginBottom: "3px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "var(--text-primary)",
                      }}
                    >
                      {note.title}
                    </p>
                    {previewLines.length > 0 && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          lineHeight: "1.4",
                          maxHeight: "4.2em",
                          overflow: "hidden",
                        }}
                      >
                        {previewLines.map((line, index) => (
                          <p
                            key={`${note.id}-preview-${index}`}
                            style={{
                              margin: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {line.prefix && <span>&bull; </span>}
                            {renderRichText(line.text, `${note.id}-preview-line-${index}`)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      data-widget-interactive="true"
                      style={actionBtnStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(note.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      data-widget-interactive="true"
                      style={{
                        ...actionBtnStyle,
                        borderColor: "var(--accent-red-border)",
                        color: "var(--accent-red)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotesWidget;
