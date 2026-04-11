// src/types/widget.ts

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
  type: "clock" | "todo" | "notes";
  position: { x: number; y: number };
  size: { width: number; height: number };
  isVisible: boolean;
  isLocked: boolean;
  label: string;
  todoItems: TodoItem[];
  notes: Note[];
  opacity: number;
}

export interface AppState {
  version: number;                          // Phase 7 — schema version
  widgets: Widget[];
  theme: "dark" | "light";
  accentColor: string;
  fontSize: "small" | "medium" | "large";
  autostart: boolean;
  alwaysOnTop: boolean;
}