// src/components/WidgetWindow.tsx
// Phase 9 — thin client สำหรับ per-widget OS window
// ไม่มี store ของตัวเอง — รับ state จาก controller ผ่าน "widget:state" event เท่านั้น

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { Widget } from "../types/widget";
import ClockWidget        from "./widgets/ClockWidget";
import TodoWidget         from "./widgets/TodoWidget";
import NotesWidget        from "./widgets/NotesWidget";
import QuickLinksWidget   from "./widgets/QuickLinksWidget";
import CalendarWidget     from "./widgets/CalendarWidget";
import WeatherWidget      from "./widgets/WeatherWidget";
import PomodoroWidget     from "./widgets/PomodoroWidget";
import HabitTrackerWidget from "./widgets/HabitTrackerWidget";
import { getRegistryEntry } from "../registry/widgetRegistry";
import { createEmptyNote } from "../utils/notes";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WidgetStatePayload {
  widget:            Widget;
  theme:             "dark" | "light";
  accentColor:       string;
  fontSize:          "small" | "medium" | "large";
  globalAlwaysOnTop: boolean;
  stackSiblings:     { id: string; label: string; stackOrder: number }[];
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

function getTabLabel(widget: Widget): string {
  if (widget.type === "clock") {
    try {
      const parsed = JSON.parse(widget.label) as { name?: string };
      return parsed.name ?? widget.label;
    } catch { return widget.label; }
  }
  return widget.label;
}

const WidgetWindow: React.FC<WidgetWindowProps> = ({ widgetId }) => {
  const [widget,        setWidget]        = useState<Widget | null>(null);
  const [theme,         setTheme]         = useState<"dark" | "light">("dark");
  const [accentColor,   setAccentColor]   = useState("#6C8EF5");
  const [fontSize,      setFontSize]      = useState<"small" | "medium" | "large">("medium");
  const [stackSiblings, setStackSiblings] = useState<{ id: string; label: string; stackOrder: number }[]>([]);

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
      const { widget: w, theme: t, accentColor: ac, fontSize: fs, stackSiblings: ss } = event.payload;
      if (w.id !== widgetId) return;
      setWidget(w);
      setTheme(t);
      setAccentColor(ac);
      setFontSize(fs);
      setStackSiblings(ss ?? []);
      if (!hasShownRef.current && w.isVisible) {
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
    if (target.closest("[data-widget-interactive='true']")) return;
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

  // ── Data update callback — ส่ง widget.data ใหม่กลับไป controller ───────
  const handleUpdateData = useCallback((widgetId: string, data: Record<string, unknown>) => {
    void emit("widget:data-change", { id: widgetId, changes: { data } });
  }, []);

  // ── Render content ─────────────────────────────────────────────────────
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
                    {
                      id: crypto.randomUUID(),
                      text: text.trim(),
                      completed: false,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      dueDate: null,
                      note: "",
                    },
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
            onUpdate={(todoId, changes) => {
              emit("widget:data-change", {
                id: widget.id,
                changes: {
                  todoItems: widget.todoItems.map((item) =>
                    item.id === todoId
                      ? { ...item, ...changes, updatedAt: Date.now() }
                      : item
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
                    createEmptyNote(),
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
      case "quicklinks":
        return (
          <QuickLinksWidget widget={widget} onUpdateData={handleUpdateData} />
        );
      case "calendar":
        return <CalendarWidget widget={widget} />;
      case "weather":
        return (
          <WeatherWidget widget={widget} onUpdateData={handleUpdateData} />
        );
      case "pomodoro":
        return (
          <PomodoroWidget widget={widget} onUpdateData={handleUpdateData} />
        );
      case "habittracker":
        return (
          <HabitTrackerWidget widget={widget} onUpdateData={handleUpdateData} />
        );
      default:
        return (
          <div style={{ color: "var(--text-primary)", padding: "12px", fontSize: "12px" }}>
            Unknown widget type: {widget.type}
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

  // ── Stack tab bar ─────────────────────────────────────────────────────────
  // รวม self + siblings เรียงตาม stackOrder เพื่อแสดง tab bar
  const allTabs = widget.stack.stackId && stackSiblings.length > 0
    ? [...stackSiblings, { id: widgetId, label: getTabLabel(widget), stackOrder: widget.stack.stackOrder }]
        .sort((a, b) => a.stackOrder - b.stackOrder)
    : [];
  const baseFontSize = FONT_SIZE_MAP[fontSize];
  const baseFontSizeNumber = Number.parseInt(baseFontSize, 10);
  const registryEntry = getRegistryEntry(widget.type);
  const widthScale = widget.size.width / registryEntry.defaultSize.width;
  const heightScale = widget.size.height / registryEntry.defaultSize.height;
  const widgetScale = Math.min(1, Math.max(0.78, Math.min(widthScale, heightScale)));
  const scaledFontSize = `${Math.max(10, Math.round(baseFontSizeNumber * widgetScale))}px`;

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
        fontSize:   scaledFontSize,
        // CSS variables สำหรับ theme + font size (ส่งต่อให้ widget components)
        ["--accent-color"   as string]: accentColor,
        ["--font-size-base" as string]: scaledFontSize,
        ["--widget-ui-scale" as string]: widgetScale.toString(),
      }}
      data-theme={theme}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "14px", display: "flex", flexDirection: "column" }}>
        {/* ── Tab bar — แสดงเมื่ออยู่ใน stack ─────────────────────────────── */}
        {allTabs.length > 1 && (
          <div
            data-tauri-drag-region
            style={{
              display: "flex", flexShrink: 0,
              background: "var(--widget-bg)",
              borderBottom: "1px solid var(--divider)",
              borderRadius: "14px 14px 0 0",
              overflow: "hidden",
            }}
          >
            {allTabs.map((tab) => {
              const isActive = tab.id === widgetId;
              return (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isActive) {
                      void import("@tauri-apps/api/event").then(({ emit }) =>
                        emit("widget:stack-switch", {
                          stackId:       widget.stack.stackId,
                          targetWidgetId: tab.id,
                        })
                      );
                    }
                  }}
                  style={{
                    flex: 1, padding: "5px 8px",
                    fontSize: "10px", fontWeight: isActive ? "700" : "400",
                    color: isActive ? "var(--accent-color)" : "var(--text-secondary)",
                    background: isActive
                      ? "color-mix(in srgb, var(--accent-color) 12%, var(--widget-bg))"
                      : "transparent",
                    border: "none", borderBottom: isActive ? "2px solid var(--accent-color)" : "2px solid transparent",
                    cursor: isActive ? "default" : "pointer",
                    fontFamily: "inherit",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    transition: "color 0.15s, background 0.15s",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
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
