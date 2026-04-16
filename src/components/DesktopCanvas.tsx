// src/components/DesktopCanvas.tsx

import React, { useState, useCallback } from "react";
import { Widget } from "../types/widget";
import WidgetContainer from "./WidgetContainer";

export interface WidgetCallbacks {
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onClockConfigChange: (
    widgetId: string,
    changes: { use24h?: boolean; locale?: string; newLabel?: string }
  ) => void;
}

export interface ContentCallbacks {
  onAddTodo: (widgetId: string, text: string) => void;
  onToggleTodo: (widgetId: string, todoId: string) => void;
  onDeleteTodo: (widgetId: string, todoId: string) => void;
  onClearCompleted: (widgetId: string) => void;
  onAddNote: (widgetId: string) => void;
  onUpdateNote: (widgetId: string, noteId: string, changes: { title?: string; content?: string }) => void;
  onDeleteNote: (widgetId: string, noteId: string) => void;
  onUpdateWidgetData: (widgetId: string, data: Record<string, unknown>) => void;
}

interface DesktopCanvasProps {
  widgets: Widget[];
  widgetCallbacks: WidgetCallbacks;
  contentCallbacks: ContentCallbacks;
  isFocusMode: boolean;
  onSetActiveStackTab: (stackId: string, widgetId: string) => void;
  onUpdateStackPosition: (stackId: string, position: { x: number; y: number }) => void;
  onUpdateStackSize: (stackId: string, size: { width: number; height: number }) => void;
}

const GRID_SIZE = 10;

const DesktopCanvas: React.FC<DesktopCanvasProps> = ({
  widgets,
  widgetCallbacks,
  contentCallbacks,
  isFocusMode,
  onSetActiveStackTab,
  onUpdateStackPosition,
  onUpdateStackSize,
}) => {
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  const handleActivate = useCallback((id: string) => {
    setActiveWidgetId(id);
  }, []);

  // Focus Mode = ซ่อนทุก widget โดยไม่แตะ isVisible ของแต่ละตัว
  const visibleWidgets = isFocusMode
    ? []
    : widgets.filter((w) => w.isVisible);

  const singleWidgets = visibleWidgets.filter((widget) => widget.stack.stackId === null);
  const stackedGroups = new Map<string, Widget[]>();

  visibleWidgets.forEach((widget) => {
    const stackId = widget.stack.stackId;
    if (!stackId) return;

    const existing = stackedGroups.get(stackId) ?? [];
    existing.push(widget);
    stackedGroups.set(stackId, existing);
  });

  return (
    <div
      data-tauri-drag-region
      style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}
    >
      {singleWidgets.map((widget) => {
        const zIndex = widget.id === activeWidgetId ? 100 : 10;

        return (
          <WidgetContainer
            key={widget.id}
            widget={widget}
            zIndex={zIndex}
            gridSize={GRID_SIZE}
            onActivate={handleActivate}
            widgetCallbacks={widgetCallbacks}
            contentCallbacks={contentCallbacks}
          />
        );
      })}
      {Array.from(stackedGroups.entries()).map(([stackId, stackWidgets]) => {
        const orderedStackWidgets = [...stackWidgets].sort(
          (a, b) => a.stack.stackOrder - b.stack.stackOrder
        );
        const activeWidget = orderedStackWidgets[0];
        const zIndex = activeWidget.id === activeWidgetId ? 100 : 10;
        const stackWidgetCallbacks: WidgetCallbacks = {
          ...widgetCallbacks,
          onPositionChange: (_id, position) => onUpdateStackPosition(stackId, position),
          onSizeChange: (_id, size) => onUpdateStackSize(stackId, size),
        };

        return (
          <WidgetContainer
            key={stackId}
            widget={activeWidget}
            stackWidgets={orderedStackWidgets}
            zIndex={zIndex}
            gridSize={GRID_SIZE}
            onActivate={handleActivate}
            onSelectStackTab={(widgetId) => onSetActiveStackTab(stackId, widgetId)}
            widgetCallbacks={stackWidgetCallbacks}
            contentCallbacks={contentCallbacks}
          />
        );
      })}
    </div>
  );
};

export default DesktopCanvas;
