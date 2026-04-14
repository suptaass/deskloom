// src/types/widget.ts

import type { WidgetType } from "../registry/widgetRegistry";

export type { WidgetType };

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isVisible: boolean;
  isLocked: boolean;
  label: string;
  todoItems: TodoItem[];
  notes: Note[];
  opacity: number;
  data: Record<string, unknown>;
}

export interface AppState {
  version: number;
  widgets: Widget[];
  theme: "dark" | "light";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  autostart: boolean;
  alwaysOnTop: boolean;
}