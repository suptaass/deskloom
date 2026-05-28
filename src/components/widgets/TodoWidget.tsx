import React, { useState, useCallback, useMemo, useRef } from "react";
import { Widget } from "../../types/widget";

interface TodoWidgetProps {
  widget: Widget;
  onAdd: (text: string) => void;
  onToggle: (todoId: string) => void;
  onUpdate: (
    todoId: string,
    changes: { text?: string; dueDate?: string | null; note?: string }
  ) => void;
  onDelete: (todoId: string) => void;
  onClearCompleted: () => void;
}

const TODO_REMOVE_DELAY_MS = 250;

function formatDueDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TodoWidget: React.FC<TodoWidgetProps> = ({
  widget,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
  onClearCompleted,
}) => {
  const [inputText, setInputText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const editTextRef = useRef<HTMLInputElement>(null);

  const totalCount = widget.todoItems.length;
  const completedCount = widget.todoItems.filter((t) => t.completed).length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const sortedItems = useMemo(
    () =>
      [...widget.todoItems].sort((a, b) => {
        if (a.completed === b.completed) return a.createdAt - b.createdAt;
        return a.completed ? 1 : -1;
      }),
    [widget.todoItems]
  );

  const handleAdd = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputText("");
  }, [inputText, onAdd]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
      if (e.key === "Escape") {
        setInputText("");
        inputRef.current?.blur();
      }
    },
    [handleAdd]
  );

  const handleStartEdit = useCallback(
    (todoId: string) => {
      const item = widget.todoItems.find((todo) => todo.id === todoId);
      if (!item) return;
      setEditingId(todoId);
      setDraftText(item.text);
      setDraftDueDate(item.dueDate ?? "");
      setDraftNote(item.note);
      requestAnimationFrame(() => editTextRef.current?.focus());
    },
    [widget.todoItems]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftText("");
    setDraftDueDate("");
    setDraftNote("");
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = draftText.trim();
    if (!trimmed) return;

    onUpdate(editingId, {
      text: trimmed,
      dueDate: draftDueDate.trim() || null,
      note: draftNote.trim(),
    });

    handleCancelEdit();
  }, [editingId, draftText, draftDueDate, draftNote, onUpdate, handleCancelEdit]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSaveEdit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const handleDelete = useCallback(
    (todoId: string) => {
      setRemovingIds((prev) => new Set([...prev, todoId]));
      setTimeout(() => {
        onDelete(todoId);
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(todoId);
          return next;
        });
      }, TODO_REMOVE_DELAY_MS);
    },
    [onDelete]
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: "7px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "var(--font-size-base)",
    outline: "none",
    fontFamily: "inherit",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    minHeight: "64px",
    lineHeight: "1.5",
  };

  const actionBtnStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid var(--btn-border)",
    color: "var(--btn-text)",
    cursor: "pointer",
    fontSize: "11px",
    lineHeight: 1.2,
    padding: "4px 8px",
    borderRadius: "6px",
    fontFamily: "inherit",
    flexShrink: 0,
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
      <div style={{ marginBottom: "10px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontSize: "var(--font-size-base)", fontWeight: "700" }}>{widget.label}</p>
          {completedCount > 0 && (
            <button
              data-widget-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                onClearCompleted();
              }}
              style={{
                fontSize: "10px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              Clear done
            </button>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {completedCount} / {totalCount} completed
        </p>
      </div>

      {totalCount > 0 && (
        <div
          style={{
            height: "3px",
            background: "var(--progress-bg)",
            borderRadius: "2px",
            marginBottom: "10px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "var(--accent-color)",
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: "10px", flexShrink: 0 }}>
        <input
          ref={inputRef}
          data-widget-interactive="true"
          style={inputStyle}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Add task (Enter to add)"
          maxLength={200}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: "2px" }}>
        {totalCount === 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-dim)",
              textAlign: "center",
              paddingTop: "16px",
            }}
          >
            No tasks yet - type above to add one
          </p>
        ) : (
          sortedItems.map((item) => {
            const isRemoving = removingIds.has(item.id);
            const isEditing = editingId === item.id;
            const dueLabel = formatDueDate(item.dueDate);

            return (
              <div
                key={item.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid var(--item-border)",
                  animation: isRemoving ? `todoItemRemove ${TODO_REMOVE_DELAY_MS}ms ease forwards` : "none",
                }}
              >
                {isEditing ? (
                  <div
                    data-widget-interactive="true"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      border: "1px solid var(--accent-color)",
                      background: "color-mix(in srgb, var(--accent-color) 8%, transparent)",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <input
                      ref={editTextRef}
                      style={inputStyle}
                      type="text"
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      placeholder="Task name"
                      maxLength={200}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Deadline</span>
                      <input
                        data-widget-interactive="true"
                        style={inputStyle}
                        type="date"
                        value={draftDueDate}
                        onChange={(e) => setDraftDueDate(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Additional note</span>
                      <textarea
                        data-widget-interactive="true"
                        style={textareaStyle}
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        placeholder="Context, details, checklist, or reminder"
                        maxLength={500}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                      <button data-widget-interactive="true" style={actionBtnStyle} onClick={handleCancelEdit}>
                        Cancel
                      </button>
                      <button
                        data-widget-interactive="true"
                        style={{
                          ...actionBtnStyle,
                          borderColor: "var(--accent-color)",
                          color: "var(--accent-color)",
                        }}
                        onClick={handleSaveEdit}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div
                      data-widget-interactive="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(item.id);
                      }}
                      style={{
                        width: "15px",
                        height: "15px",
                        borderRadius: "3px",
                        flexShrink: 0,
                        marginTop: "3px",
                        cursor: "pointer",
                        border: item.completed
                          ? "2px solid var(--accent-color)"
                          : "2px solid var(--checkbox-border)",
                        background: item.completed
                          ? "color-mix(in srgb, var(--accent-color) 30%, transparent)"
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "9px",
                        color: "var(--accent-color)",
                      }}
                    >
                      {item.completed ? "✓" : ""}
                    </div>

                    <div
                      data-widget-interactive="true"
                      style={{ flex: 1, minWidth: 0, cursor: "text" }}
                      onDoubleClick={() => handleStartEdit(item.id)}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "var(--font-size-base)",
                            lineHeight: "1.5",
                            textDecoration: item.completed ? "line-through" : "none",
                            opacity: item.completed ? 0.45 : 0.95,
                            wordBreak: "break-word",
                            color: "var(--text-primary)",
                          }}
                        >
                          {item.text}
                        </span>
                        {dueLabel && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "999px",
                              border: "1px solid color-mix(in srgb, var(--accent-color) 35%, transparent)",
                              background: "color-mix(in srgb, var(--accent-color) 10%, transparent)",
                              color: "var(--accent-color)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dueLabel}
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <p
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            lineHeight: "1.45",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.note}
                        </p>
                      )}
                    </div>

                    <div data-widget-interactive="true" style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button style={actionBtnStyle} onClick={() => handleStartEdit(item.id)}>
                        Edit
                      </button>
                      <button
                        style={{
                          ...actionBtnStyle,
                          borderColor: "var(--accent-red-border)",
                          color: "var(--accent-red)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TodoWidget;
