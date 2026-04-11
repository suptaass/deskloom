// src/store/appStore.ts

import { create } from "zustand";
import { AppState, Widget } from "../types/widget";

const DEFAULT_WIDGET_IDS = ["clock-1", "todo-1", "notes-1"];

export const DEFAULT_WIDGETS: Widget[] = [
  {
    id: "clock-1",
    type: "clock",
    position: { x: 50, y: 50 },
    size: { width: 280, height: 180 },
    isVisible: true,
    isLocked: false,
    label: JSON.stringify({ name: "Clock", use24h: true, locale: "th-TH" }),
    todoItems: [],
    notes: [],
    opacity: 1,
  },
  {
    id: "todo-1",
    type: "todo",
    position: { x: 380, y: 50 },
    size: { width: 260, height: 320 },
    isVisible: true,
    isLocked: false,
    label: "My Tasks",
    todoItems: [
      { id: "t-1", text: "Setup DeskLoom project", completed: true,  createdAt: 1700000000000 },
      { id: "t-2", text: "Implement Phase 1",      completed: false, createdAt: 1700000000000 },
      { id: "t-3", text: "Test drag and drop",     completed: false, createdAt: 1700000000000 },
    ],
    notes: [],
    opacity: 1,
  },
  {
    id: "notes-1",
    type: "notes",
    position: { x: 690, y: 50 },
    size: { width: 260, height: 320 },
    isVisible: true,
    isLocked: false,
    label: "My Notes",
    todoItems: [],
    notes: [
      { id: "n-1", title: "Phase 1 Goals", content: "Store, Canvas, Drag, Clock, Todo, Notes", createdAt: 1700000000000, updatedAt: 1700000000000 },
      { id: "n-2", title: "Phase 2 Plan",  content: "Tauri filesystem API for persistence",    createdAt: 1700000000000, updatedAt: 1700000000000 },
    ],
    opacity: 1,
  },
];

interface AppStore extends AppState {
  setWidgets:            (widgets: Widget[]) => void;
  addWidget:             (widget: Widget) => void;
  updateWidget:          (id: string, changes: Partial<Widget>) => void;
  removeWidget:          (id: string) => void;
  updateWidgetPosition:  (id: string, position: { x: number; y: number }) => void;
  updateWidgetSize:      (id: string, size: { width: number; height: number }) => void;
  setTheme:              (theme: "dark" | "light") => void;
  setAccentColor:        (color: string) => void;
  setFontSize:           (size: "small" | "medium" | "large") => void;
  setOpacity:            (id: string, opacity: number) => void;
  setAlwaysOnTop:        (value: boolean) => void;
  setAutostart:          (value: boolean) => void;
  resetLayout:           () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  version:     7,
  widgets:     DEFAULT_WIDGETS,
  theme:       "dark",
  accentColor: "#6C8EF5",
  fontSize:    "medium",
  autostart:   false,
  alwaysOnTop: false,

  setWidgets: (widgets) => set({ widgets }),

  addWidget: (widget) =>
    set((state) => ({ widgets: [...state.widgets, widget] })),

  updateWidget: (id, changes) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, ...changes } : w
      ),
    })),

  removeWidget: (id) => {
    if (DEFAULT_WIDGET_IDS.includes(id)) return;
    set((state) => ({
      widgets: state.widgets.filter((w) => w.id !== id),
    }));
  },

  updateWidgetPosition: (id, position) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, position } : w
      ),
    })),

  updateWidgetSize: (id, size) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, size } : w
      ),
    })),

  setTheme:      (theme) => set({ theme }),
  setAccentColor:(accentColor) => set({ accentColor }),
  setFontSize:   (fontSize) => set({ fontSize }),

  setOpacity: (id, opacity) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, opacity: Math.min(1, Math.max(0.2, opacity)) } : w
      ),
    })),

  setAlwaysOnTop: (alwaysOnTop) => set({ alwaysOnTop }),
  setAutostart:   (autostart)   => set({ autostart }),

  resetLayout: () =>
    set((state) => ({
      widgets: state.widgets.map((w) => {
        const def = DEFAULT_WIDGETS.find((d) => d.id === w.id);
        if (!def) return w;
        return { ...w, position: def.position, size: def.size };
      }),
    })),
}));

export { DEFAULT_WIDGET_IDS };