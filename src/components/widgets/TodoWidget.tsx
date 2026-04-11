// src/components/widgets/TodoWidget.tsx

import React, { useState, useCallback, useRef } from "react";
import { Widget } from "../../types/widget";

interface TodoWidgetProps {
  widget: Widget;
  onAdd: (text: string) => void;
  onToggle: (todoId: string) => void;
  onDelete: (todoId: string) => void;
  onClearCompleted: () => void;
}

const TODO_REMOVE_DELAY_MS = 250; // ต้องตรงกับ duration ของ @keyframes todoItemRemove

const TodoWidget: React.FC<TodoWidgetProps> = ({
  widget, onAdd, onToggle, onDelete, onClearCompleted,
}) => {
  const [inputText, setInputText]   = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set()); // Step 7-6
  const inputRef = useRef<HTMLInputElement>(null);

  const totalCount      = widget.todoItems.length;
  const completedCount  = widget.todoItems.filter((t) => t.completed).length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const sortedItems = [...widget.todoItems].sort((a, b) => {
    if (a.completed === b.completed) return a.createdAt - b.createdAt;
    return a.completed ? 1 : -1;
  });

  const handleAdd = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputText("");
  }, [inputText, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
      if (e.key === "Escape") { setInputText(""); inputRef.current?.blur(); }
    },
    [handleAdd]
  );

  // Step 7-6: animate ก่อน delete จริง
  const handleDelete = useCallback(
    (todoId: string) => {
      // เพิ่มใน removingIds เพื่อ trigger animation
      setRemovingIds((prev) => new Set([...prev, todoId]));
      // รอให้ animation จบแล้วค่อย delete จริง
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
    width: "100%", padding: "7px 10px", borderRadius: "7px",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)", color: "var(--text-primary)",
    fontSize: "var(--font-size-base)", outline: "none", fontFamily: "inherit",
  };

  const deleteBtnStyle: React.CSSProperties = {
    background: "none", border: "none",
    color: "var(--text-dim)", cursor: "pointer",
    fontSize: "14px", lineHeight: 1, padding: "0 2px",
    flexShrink: 0, fontFamily: "inherit",
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--widget-bg)", borderRadius: "14px",
      border: "1px solid var(--widget-border)",
      display: "flex", flexDirection: "column",
      color: "var(--text-primary)", padding: "14px",
      backdropFilter: "blur(8px)", overflow: "hidden",
      fontSize: "var(--font-size-base)",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "10px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontSize: "var(--font-size-base)", fontWeight: "700" }}>
            {widget.label}
          </p>
          {completedCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearCompleted(); }}
              style={{
                fontSize: "10px", background: "none", border: "none",
                color: "var(--text-secondary)", cursor: "pointer",
                padding: 0, fontFamily: "inherit",
              }}
            >Clear done</button>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {completedCount} / {totalCount} completed
        </p>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{
          height: "3px", background: "var(--progress-bg)",
          borderRadius: "2px", marginBottom: "10px", flexShrink: 0,
        }}>
          <div style={{
            height: "100%", width: `${progressPercent}%`,
            background: "var(--accent-color)",
            borderRadius: "2px", transition: "width 0.3s ease",
          }} />
        </div>
      )}

      {/* Input */}
      <div style={{ marginBottom: "10px", flexShrink: 0 }}>
        <input
          ref={inputRef}
          style={inputStyle}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add task… (Enter to add)"
          maxLength={200}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {totalCount === 0 ? (
          <p style={{
            fontSize: "12px", color: "var(--text-dim)",
            textAlign: "center", paddingTop: "16px",
          }}>
            No tasks yet — type above to add one
          </p>
        ) : (
          sortedItems.map((item) => {
            const isRemoving = removingIds.has(item.id); // Step 7-6
            return (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "8px",
                  padding: "6px 0", borderBottom: "1px solid var(--item-border)",
                  // Step 7-6: ถ้า isRemoving → play animation ก่อนหาย
                  animation: isRemoving
                    ? `todoItemRemove ${TODO_REMOVE_DELAY_MS}ms ease forwards`
                    : "none",
                }}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
                  style={{
                    width: "15px", height: "15px", borderRadius: "3px",
                    flexShrink: 0, marginTop: "1px", cursor: "pointer",
                    border: item.completed
                      ? "2px solid var(--accent-color)"
                      : "2px solid var(--checkbox-border)",
                    background: item.completed
                      ? "color-mix(in srgb, var(--accent-color) 30%, transparent)"
                      : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px",
                    color: "var(--accent-color)",
                  }}
                >{item.completed ? "✓" : ""}</div>

                <span style={{
                  flex: 1, fontSize: "var(--font-size-base)", lineHeight: "1.5",
                  textDecoration: item.completed ? "line-through" : "none",
                  opacity: item.completed ? 0.4 : 0.9,
                  wordBreak: "break-word", color: "var(--text-primary)",
                }}>
                  {item.text}
                </span>

                <button
                  style={deleteBtnStyle}
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                >×</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TodoWidget;