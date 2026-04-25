// src/types/widget.ts

import type { WidgetType } from "../registry/widgetRegistry";

export type { WidgetType };

// ── WidgetCondition ────────────────────────────────────────────────────────
// เก็บ condition การแสดงผลตามเวลา/วัน
// activeDays: [] = ทุกวัน, [1,2,3,4,5] = จันทร์–ศุกร์
// timeStart/timeEnd: "HH:MM" — ถ้า start > end = ข้ามคืน (เช่น 22:00–06:00)
export interface WidgetCondition {
  enabled:    boolean;
  timeStart:  string;   // "HH:MM"
  timeEnd:    string;   // "HH:MM"
  activeDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface WidgetStack {
  stackId: string | null;
  stackOrder: number;
}

export interface TodoItem {
  id:        string;
  text:      string;
  completed: boolean;
  createdAt: number;
}

export interface Note {
  id:        string;
  title:     string;
  content:   string;
  createdAt: number;
  updatedAt: number;
}

export interface Widget {
  id:        string;
  type:      WidgetType;
  position:  { x: number; y: number };
  size:      { width: number; height: number };
  isVisible: boolean;
  isLocked:  boolean;
  label:     string;
  todoItems: TodoItem[];
  notes:     Note[];
  opacity:   number;
  data:      Record<string, unknown>;
  condition:            WidgetCondition | null;
  stack:                WidgetStack;
  alwaysOnTopPerWidget: boolean;
  clickThrough:         boolean;
  monitorName:          string | null;
}

export interface AppState {
  version:     number;
  widgets:     Widget[];
  theme:       "dark" | "light";
  accentColor: string;
  fontSize:    "small" | "medium" | "large";
  autostart:   boolean;
  alwaysOnTop: boolean;
}
