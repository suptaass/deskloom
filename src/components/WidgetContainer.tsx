// src/components/WidgetContainer.tsx

import React, { useRef, useCallback } from "react";
import { Widget } from "../types/widget";
import type { WidgetCallbacks, ContentCallbacks } from "./DesktopCanvas";
import ClockWidget        from "./widgets/ClockWidget";
import TodoWidget         from "./widgets/TodoWidget";
import NotesWidget        from "./widgets/NotesWidget";
import QuickLinksWidget   from "./widgets/QuickLinksWidget";
import CalendarWidget     from "./widgets/CalendarWidget";
import WeatherWidget      from "./widgets/WeatherWidget";
import PomodoroWidget     from "./widgets/PomodoroWidget";
import HabitTrackerWidget from "./widgets/HabitTrackerWidget";

const MIN_WIDTH  = 150;
const MIN_HEIGHT = 100;

type ResizeDirection = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface WidgetContainerProps {
  widget: Widget;
  stackWidgets?: Widget[];
  zIndex: number;
  gridSize: number;
  onActivate: (id: string) => void;
  onSelectStackTab?: (widgetId: string) => void;
  widgetCallbacks: WidgetCallbacks;
  contentCallbacks: ContentCallbacks;
}

function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function clampPosition(
  x: number, y: number, width: number, height: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, window.innerWidth  - width)),
    y: Math.max(0, Math.min(y, window.innerHeight - height)),
  };
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  stackWidgets = [],
  zIndex,
  gridSize,
  onActivate,
  onSelectStackTab,
  widgetCallbacks,
  contentCallbacks,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef<boolean>(false);
  const dragOffset   = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { onPositionChange, onSizeChange } = widgetCallbacks;
  const isStacked = stackWidgets.length > 1;

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onActivate(widget.id);
      if (widget.isLocked) return;
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
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - widget.position.x,
        y: e.clientY - widget.position.y,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const rawX    = moveEvent.clientX - dragOffset.current.x;
        const rawY    = moveEvent.clientY - dragOffset.current.y;
        const clamped = clampPosition(rawX, rawY, widget.size.width, widget.size.height);
        containerRef.current.style.left = `${clamped.x}px`;
        containerRef.current.style.top  = `${clamped.y}px`;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        isDragging.current = false;
        const rawX    = upEvent.clientX - dragOffset.current.x;
        const rawY    = upEvent.clientY - dragOffset.current.y;
        const clamped = clampPosition(rawX, rawY, widget.size.width, widget.size.height);
        onPositionChange(widget.id, {
          x: snapToGrid(clamped.x, gridSize),
          y: snapToGrid(clamped.y, gridSize),
        });
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup",   handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup",   handleMouseUp);
    },
    [
      widget.id, widget.isLocked,
      widget.position.x, widget.position.y,
      widget.size.width, widget.size.height,
      gridSize, onActivate, onPositionChange,
    ]
  );

  // ── Resize ─────────────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, direction: ResizeDirection) => {
      if (widget.isLocked) return;
      e.preventDefault();
      e.stopPropagation();
      onActivate(widget.id);

      const startX      = e.clientX;
      const startY      = e.clientY;
      const startLeft   = widget.position.x;
      const startTop    = widget.position.y;
      const startWidth  = widget.size.width;
      const startHeight = widget.size.height;

      const compute = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
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

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const { newLeft, newTop, newWidth, newHeight } = compute(moveEvent);
        const clamped = clampPosition(newLeft, newTop, newWidth, newHeight);
        containerRef.current.style.left   = `${clamped.x}px`;
        containerRef.current.style.top    = `${clamped.y}px`;
        containerRef.current.style.width  = `${newWidth}px`;
        containerRef.current.style.height = `${newHeight}px`;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const { newLeft, newTop, newWidth, newHeight } = compute(upEvent);
        const clamped = clampPosition(newLeft, newTop, newWidth, newHeight);
        onPositionChange(widget.id, {
          x: snapToGrid(clamped.x, gridSize),
          y: snapToGrid(clamped.y, gridSize),
        });
        onSizeChange(widget.id, {
          width:  snapToGrid(newWidth,  gridSize),
          height: snapToGrid(newHeight, gridSize),
        });
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup",   handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup",   handleMouseUp);
    },
    [
      widget.id, widget.isLocked,
      widget.position.x, widget.position.y,
      widget.size.width, widget.size.height,
      gridSize, onActivate, onPositionChange, onSizeChange,
    ]
  );

  // ── Render Content ─────────────────────────────────────────────────────────
  function renderContent() {
    const { onClockConfigChange } = widgetCallbacks;
    const {
      onAddTodo, onToggleTodo, onUpdateTodo, onDeleteTodo, onClearCompleted,
      onAddNote, onUpdateNote, onDeleteNote,
      onUpdateWidgetData,
    } = contentCallbacks;

    switch (widget.type) {
      case "clock":
        return (
          <ClockWidget
            widget={widget}
            onConfigChange={(changes) => onClockConfigChange(widget.id, changes)}
          />
        );
      case "todo":
        return (
          <TodoWidget
            widget={widget}
            onAdd={(text) => onAddTodo(widget.id, text)}
            onToggle={(id) => onToggleTodo(widget.id, id)}
            onUpdate={(id, changes) => onUpdateTodo(widget.id, id, changes)}
            onDelete={(id) => onDeleteTodo(widget.id, id)}
            onClearCompleted={() => onClearCompleted(widget.id)}
          />
        );
      case "notes":
        return (
          <NotesWidget
            widget={widget}
            onAdd={() => onAddNote(widget.id)}
            onUpdate={(id, changes) => onUpdateNote(widget.id, id, changes)}
            onDelete={(id) => onDeleteNote(widget.id, id)}
          />
        );
      case "quicklinks":
        return (
          <QuickLinksWidget
            widget={widget}
            onUpdateData={onUpdateWidgetData}
          />
        );
      case "calendar":
        return <CalendarWidget widget={widget} />;
      case "weather":
        return (
          <WeatherWidget
            widget={widget}
            onUpdateData={onUpdateWidgetData}
          />
        );
      case "pomodoro":
        return (
          <PomodoroWidget
            widget={widget}
            onUpdateData={onUpdateWidgetData}
          />
        );
      case "habittracker":
        return (
          <HabitTrackerWidget
            widget={widget}
            onUpdateData={onUpdateWidgetData}
          />
        );
      default:
        return (
          <div style={{ color: "white", padding: "8px" }}>
            Unknown widget type: {widget.type}
          </div>
        );
    }
  }

  const resizeHandles: Array<{ direction: ResizeDirection; style: React.CSSProperties }> = [
    { direction: "nw", style: { top: 0,    left: 0,    width: 10, height: 10, cursor: "nwse-resize" } },
    { direction: "ne", style: { top: 0,    right: 0,   width: 10, height: 10, cursor: "nesw-resize" } },
    { direction: "sw", style: { bottom: 0, left: 0,    width: 10, height: 10, cursor: "nesw-resize" } },
    { direction: "se", style: { bottom: 0, right: 0,   width: 10, height: 10, cursor: "nwse-resize" } },
    { direction: "n",  style: { top: 0,    left: 10, right: 10,  height: 6, cursor: "ns-resize" } },
    { direction: "s",  style: { bottom: 0, left: 10, right: 10,  height: 6, cursor: "ns-resize" } },
    { direction: "w",  style: { top: 6,    left: 0,  bottom: 6,  width: 6,  cursor: "ew-resize" } },
    { direction: "e",  style: { top: 6,    right: 0, bottom: 6,  width: 6,  cursor: "ew-resize" } },
  ];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position:   "absolute",
        left:       widget.position.x,
        top:        widget.position.y,
        width:      widget.size.width,
        height:     widget.size.height,
        zIndex,
        opacity:    widget.opacity,
        cursor:     widget.isLocked ? "default" : "grab",
        userSelect: "none",
        animation:  "widgetFadeIn 0.35s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isStacked && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "8px 10px 0",
              position: "relative",
              zIndex: 2,
            }}
          >
            {stackWidgets.map((stackWidget) => {
              const isActiveTab = stackWidget.id === widget.id;

              return (
                <button
                  key={stackWidget.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onActivate(stackWidget.id);
                  }}
                  onClick={() => onSelectStackTab?.(stackWidget.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: `1px solid ${isActiveTab ? "var(--accent-color)" : "var(--btn-border)"}`,
                    background: isActiveTab
                      ? "color-mix(in srgb, var(--accent-color) 18%, transparent)"
                      : "var(--btn-bg)",
                    color: isActiveTab ? "var(--accent-color)" : "var(--text-secondary)",
                    fontSize: "11px",
                    fontWeight: isActiveTab ? "700" : "500",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={stackWidget.label}
                >
                  {stackWidget.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          {renderContent()}
        </div>
      </div>
      {!widget.isLocked &&
        resizeHandles.map(({ direction, style }) => (
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

export default WidgetContainer;
