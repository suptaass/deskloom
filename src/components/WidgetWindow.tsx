// src/components/WidgetWindow.tsx
// Phase 9 — thin client สำหรับ per-widget OS window
// ไม่มี store ของตัวเอง — รับ state จาก controller ผ่าน "widget:state" event เท่านั้น

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { Widget } from "../types/widget";
import ClockWidget from "./widgets/ClockWidget";
import TodoWidget from "./widgets/TodoWidget";
import NotesWidget from "./widgets/NotesWidget";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WidgetStatePayload {
  widget:            Widget;
  theme:             "dark" | "light";
  accentColor:       string;
  fontSize:          "small" | "medium" | "large";
  globalAlwaysOnTop: boolean;
}

interface WidgetWindowProps {
  widgetId: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FONT_SIZE_MAP: Record<"small" | "medium" | "large", string> = {
  small: "12px", medium: "14px", large: "16px",
};

const MIN_WIDTH  = 150;
const MIN_HEIGHT = 100;

// ── WidgetWindow ───────────────────────────────────────────────────────────

const WidgetWindow: React.FC<WidgetWindowProps> = ({ widgetId }) => {
  const [widget,      setWidget]      = useState<Widget | null>(null);
  const [theme,       setTheme]       = useState<"dark" | "light">("dark");
  const [accentColor, setAccentColor] = useState("#6C8EF5");
  const [fontSize,    setFontSize]    = useState<"small" | "medium" | "large">("medium");

  const scaleFactorRef  = useRef<number>(1);
  const containerRef    = useRef<HTMLDivElement>(null);
  const hasShownRef     = useRef<boolean>(false);

  // ── Bootstrap: ขอ state จาก controller แล้วรอรับ ──────────────────────
  useEffect(() => {
    const win = getCurrentWindow();

    // เก็บ scale factor ไว้แปลง physical → logical px ตอนรับ position จาก OS
    win.scaleFactor().then((sf) => { scaleFactorRef.current = sf; });

    // รับ state จาก controller (push ทุกครั้งที่ widget เปลี่ยน)
    const unlistenState = listen<WidgetStatePayload>("widget:state", (event) => {
      const { widget: w, theme: t, accentColor: ac, fontSize: fs } = event.payload;
      if (w.id !== widgetId) return;
      setWidget(w);
      setTheme(t);
      setAccentColor(ac);
      setFontSize(fs);
      if (!hasShownRef.current) {
        hasShownRef.current = true;
        void win.show();
      }
    });

    // รับ position จาก OS หลัง drag (tauri://move ให้ physical px)
    const unlistenMove = win.listen("tauri://move", (event) => {
      const { x, y } = event.payload as { x: number; y: number };
      const sf = scaleFactorRef.current;
      emit("widget:position-change", {
        id: widgetId,
        x:  Math.round(x / sf),
        y:  Math.round(y / sf),
      });
    });

    // แจ้ง controller ว่าพร้อมรับ state (React mount เสร็จแล้ว)
    emit("widget:request-state", { widgetId });

    return () => {
      unlistenState.then((fn) => fn());
      unlistenMove.then((fn) => fn());
    };
  }, [widgetId]);

  // ── Drag: ใช้ Tauri OS-level drag แทน DOM mousemove ───────────────────
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (!widget || widget.isLocked) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT"    ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "BUTTON"   ||
      target.tagName === "SELECT"
    ) return;
    if (target.closest("[data-resize-handle]")) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, [widget]);

  // ── Resize: DOM mousemove สำหรับ real-time feedback + Tauri API ตอน mouseup ──
  const handleResizeMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    direction: "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"
  ) => {
    if (!widget || widget.isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const startX      = e.clientX;
    const startY      = e.clientY;
    const startLeft   = widget.position.x;
    const startTop    = widget.position.y;
    const startWidth  = widget.size.width;
    const startHeight = widget.size.height;

    const compute = (mx: number, my: number) => {
      const dx = mx - startX;
      const dy = my - startY;
      let newLeft   = startLeft;
      let newTop    = startTop;
      let newWidth  = startWidth;
      let newHeight = startHeight;

      if (direction.includes("e")) newWidth  = Math.max(MIN_WIDTH,  startWidth  + dx);
      if (direction.includes("w")) {
        const pw = startWidth - dx;
        newWidth = Math.max(MIN_WIDTH, pw);
        newLeft  = pw >= MIN_WIDTH ? startLeft + dx : startLeft + (startWidth - MIN_WIDTH);
      }
      if (direction.includes("s")) newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
      if (direction.includes("n")) {
        const ph = startHeight - dy;
        newHeight = Math.max(MIN_HEIGHT, ph);
        newTop    = ph >= MIN_HEIGHT ? startTop + dy : startTop + (startHeight - MIN_HEIGHT);
      }
      return { newLeft, newTop, newWidth, newHeight };
    };

    const handleMouseMove = (mv: MouseEvent) => {
      if (!containerRef.current) return;
      const { newWidth, newHeight } = compute(mv.clientX, mv.clientY);
      containerRef.current.style.width  = `${newWidth}px`;
      containerRef.current.style.height = `${newHeight}px`;
    };

    const handleMouseUp = async (up: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup",   handleMouseUp);
      const { newLeft, newTop, newWidth, newHeight } = compute(up.clientX, up.clientY);
      const win = getCurrentWindow();
      try {
        const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/window");
        await win.setSize(new LogicalSize(newWidth, newHeight));
        await win.setPosition(new LogicalPosition(newLeft, newTop));
      } catch (err) {
        console.error("[WidgetWindow] resize failed:", err);
      }
      emit("widget:size-change", { id: widgetId, width: newWidth, height: newHeight });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup",   handleMouseUp);
  }, [widget, widgetId]);

  // ── Render content (Phase 9-2: Clock + Todo + Notes) ─────────────────
  const renderContent = () => {
    if (!widget) return null;
    switch (widget.type) {
      case "clock":
        return (
          <ClockWidget
            widget={widget}
            onConfigChange={(changes) => {
              if (changes.newLabel) {
                emit("widget:data-change", {
                  id:      widget.id,
                  changes: { label: changes.newLabel },
                });
              }
            }}
          />
        );
      case "todo":
        return (
          <TodoWidget
            widget={widget}
            onAdd={(text) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  todoItems: [
                    ...widget.todoItems,
                    { id: crypto.randomUUID(), text: text.trim(), completed: false, createdAt: Date.now() },
                  ],
                },
              });
            }}
            onToggle={(todoId) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  todoItems: widget.todoItems.map((item) =>
                    item.id === todoId ? { ...item, completed: !item.completed } : item
                  ),
                },
              });
            }}
            onDelete={(todoId) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  todoItems: widget.todoItems.filter((item) => item.id !== todoId),
                },
              });
            }}
            onClearCompleted={() => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  todoItems: widget.todoItems.filter((item) => !item.completed),
                },
              });
            }}
          />
        );
      case "notes":
        return (
          <NotesWidget
            widget={widget}
            onAdd={() => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  notes: [
                    ...widget.notes,
                    { id: crypto.randomUUID(), title: "Untitled", content: "", createdAt: Date.now(), updatedAt: Date.now() },
                  ],
                },
              });
            }}
            onUpdate={(noteId, changes) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  notes: widget.notes.map((note) =>
                    note.id === noteId ? { ...note, ...changes, updatedAt: Date.now() } : note
                  ),
                },
              });
            }}
            onDelete={(noteId) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  notes: widget.notes.filter((note) => note.id !== noteId),
                },
              });
            }}
          />
        );
      default:
        return (
          <div style={{ color: "var(--text-primary)", padding: "12px", fontSize: "12px" }}>
            Widget type "{widget.type}" — not yet supported
          </div>
        );
    }
  };

  // ── Resize handles (8 จุด เหมือน WidgetContainer) ─────────────────────
  const resizeHandles: Array<{
    direction: "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
    style: React.CSSProperties;
  }> = [
    { direction: "nw", style: { top: 0,    left: 0,    width: 10, height: 10, cursor: "nwse-resize" } },
    { direction: "ne", style: { top: 0,    right: 0,   width: 10, height: 10, cursor: "nesw-resize" } },
    { direction: "sw", style: { bottom: 0, left: 0,    width: 10, height: 10, cursor: "nesw-resize" } },
    { direction: "se", style: { bottom: 0, right: 0,   width: 10, height: 10, cursor: "nwse-resize" } },
    { direction: "n",  style: { top: 0,    left: 10, right: 10,   height: 6,  cursor: "ns-resize"   } },
    { direction: "s",  style: { bottom: 0, left: 10, right: 10,   height: 6,  cursor: "ns-resize"   } },
    { direction: "w",  style: { top: 6,    left: 0,  bottom: 6,   width: 6,   cursor: "ew-resize"   } },
    { direction: "e",  style: { top: 6,    right: 0, bottom: 6,   width: 6,   cursor: "ew-resize"   } },
  ];

  // ── ยังไม่มี state: render ว่างเปล่า (window ยังซ่อนอยู่) ─────────────
  if (!widget) return null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleDragMouseDown}
      style={{
        position:   "fixed",
        inset:      0,
        opacity:    widget.opacity,
        cursor:     widget.isLocked ? "default" : "grab",
        userSelect: "none",
        fontSize:   FONT_SIZE_MAP[fontSize],
        // CSS variables สำหรับ theme (ส่งต่อให้ widget components ข้างใน)
        ["--accent-color" as string]: accentColor,
      }}
      data-theme={theme}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "14px", display: "flex", flexDirection: "column" }}>
        {renderContent()}
      </div>

      {!widget.isLocked && resizeHandles.map(({ direction, style }) => (
        <div
          key={direction}
          data-resize-handle="true"
          onMouseDown={(e) => handleResizeMouseDown(e, direction)}
          style={{ position: "absolute", zIndex: 3, ...style }}
        />
      ))}
    </div>
  );
};

export default WidgetWindow;
