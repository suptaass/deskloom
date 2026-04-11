// src/components/DesktopCanvas.tsx

import React, { useState, useCallback } from "react";
import { Widget } from "../types/widget";
import WidgetContainer from "./WidgetContainer";

interface DesktopCanvasProps {
  widgets: Widget[];
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onClockConfigChange: (widgetId: string, changes: { use24h?: boolean; locale?: string; newLabel?: string }) => void;
  onAddTodo: (widgetId: string, text: string) => void;
  onToggleTodo: (widgetId: string, todoId: string) => void;
  onDeleteTodo: (widgetId: string, todoId: string) => void;
  onClearCompleted: (widgetId: string) => void;
  onAddNote: (widgetId: string) => void;
  onUpdateNote: (widgetId: string, noteId: string, changes: { title?: string; content?: string }) => void;
  onDeleteNote: (widgetId: string, noteId: string) => void;
}

const GRID_SIZE = 10;

const DesktopCanvas: React.FC<DesktopCanvasProps> = ({
  widgets, onPositionChange, onSizeChange, onClockConfigChange,
  onAddTodo, onToggleTodo, onDeleteTodo, onClearCompleted,
  onAddNote, onUpdateNote, onDeleteNote,
}) => {
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  const handleActivate = useCallback((id: string) => {
    setActiveWidgetId(id);
  }, []);

  const visibleWidgets = widgets.filter((w) => w.isVisible);

  return (
    <div
      data-tauri-drag-region
      style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}
    >
      {visibleWidgets.map((widget) => {
        const zIndex = widget.id === activeWidgetId ? 100 : 10;
        return (
          <WidgetContainer
            key={widget.id}
            widget={widget}
            zIndex={zIndex}
            gridSize={GRID_SIZE}
            onActivate={handleActivate}
            onPositionChange={onPositionChange}
            onSizeChange={onSizeChange}
            onClockConfigChange={onClockConfigChange}
            onAddTodo={onAddTodo}
            onToggleTodo={onToggleTodo}
            onDeleteTodo={onDeleteTodo}
            onClearCompleted={onClearCompleted}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
          />
        );
      })}
    </div>
  );
};

export default DesktopCanvas;