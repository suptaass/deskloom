# Phase 9-1 — PoC: Per-Widget OS Window

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## Lesson 1: Type Extension + Migration + Store Bump

---

### แนวคิด (Concept)

ใน DeskLoom ทุกครั้งที่เพิ่ม field ใหม่ใน `Widget` interface จะต้องทำ **3 ขั้นตอนตามลำดับนี้เท่านั้น**:

1. **ประกาศ type ก่อน** (`widget.ts`) — เหมือนออกแบบพิมพ์เขียวก่อนสร้างบ้าน
2. **เพิ่ม migration** (`storage.ts`) — ป้องกัน crash เมื่ออ่าน save file เก่าที่ไม่มี field ใหม่
3. **อัปเดต store** (`appStore.ts`) — ให้ default values ใหม่ถูกต้องตั้งแต่เริ่มต้น

ถ้าทำผิดลำดับ (เช่น อัปเดต store ก่อน migration) TypeScript จะ error ตั้งแต่ compile time

---

### สิ่งที่เราจะทำ

เพิ่ม 2 field ใหม่ใน `Widget` interface สำหรับ Phase 9:

| Field | Type | Default | ใช้ทำอะไร |
|---|---|---|---|
| `alwaysOnTopPerWidget` | `boolean` | `false` | widget ลอยเหนือ window อื่นได้อิสระ (Phase 9-5) |
| `clickThrough` | `boolean` | `false` | mouse events ผ่านทะลุ widget ได้ (Phase 9-3) |

และ bump version `8 → 9` + bump app version `0.4.0 → 0.5.0`

แก้ **5 ไฟล์** ตามลำดับ:

1. `src/types/widget.ts`
2. `src/utils/storage.ts`
3. `src/store/appStore.ts`
4. `src-tauri/tauri.conf.json`
5. `src-tauri/Cargo.toml`

---

### ขั้นตอน (Step-by-step)

#### Step 1 — `src/types/widget.ts`

เปิดไฟล์ → หา `interface Widget {` → เพิ่ม 2 บรรทัด **ต่อท้าย field `stack`** (ก่อน `}` ปิด interface):

```typescript
  alwaysOnTopPerWidget: boolean;
  clickThrough:         boolean;
```

#### Step 2 — `src/utils/storage.ts`

เปิดไฟล์ → หาฟังก์ชัน `migrateWidget()` → หาใน return object บรรทัด `stack: safeStack,` → เพิ่ม **ต่อจากนั้น 2 บรรทัด**:

```typescript
    alwaysOnTopPerWidget: typeof raw.alwaysOnTopPerWidget === "boolean" ? raw.alwaysOnTopPerWidget : false,
    clickThrough:         typeof raw.clickThrough         === "boolean" ? raw.clickThrough         : false,
```

#### Step 3 — `src/store/appStore.ts`

เปิดไฟล์ แก้ **2 จุด**:

**จุดที่ 1** — หา `version: 8` เปลี่ยนเป็น:

```typescript
  version: 9,
```

**จุดที่ 2** — ใน `DEFAULT_WIDGETS` มี 3 widget object (`clock-1`, `todo-1`, `notes-1`) แต่ละตัวหา `stack: { stackId: null, stackOrder: 0 },` แล้วเพิ่มหลัง (ทำซ้ำทั้ง 3 ตัว):

```typescript
    alwaysOnTopPerWidget: false,
    clickThrough:         false,
```

#### Step 4 — Version Bump

**`src-tauri/tauri.conf.json`** บรรทัดที่ 3 → เปลี่ยน `"0.4.0"` เป็น `"0.5.0"`

**`src-tauri/Cargo.toml`** บรรทัดที่ 3 → เปลี่ยน `"0.4.0"` เป็น `"0.5.0"`

---

### โค้ด (เต็มไฟล์)

#### `src/types/widget.ts`

```typescript
// src/types/widget.ts

import type { WidgetType } from "../registry/widgetRegistry";

export type { WidgetType };

export interface WidgetCondition {
  enabled:    boolean;
  timeStart:  string;
  timeEnd:    string;
  activeDays: number[];
}

export interface WidgetStack {
  stackId:    string | null;
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
```

#### `src/utils/storage.ts` — เฉพาะ `migrateWidget()`

(ไฟล์มีความยาว ~275 บรรทัด แสดงเฉพาะฟังก์ชันที่แก้)

```typescript
function migrateWidget(raw: Record<string, unknown>): Widget {
  const rawPosition  = (raw.position ?? {}) as Record<string, unknown>;
  const rawSize      = (raw.size     ?? {}) as Record<string, unknown>;
  const rawTodoItems = Array.isArray(raw.todoItems) ? raw.todoItems : [];
  const rawNotes     = Array.isArray(raw.notes)     ? raw.notes     : [];

  const rawX      = typeof rawPosition.x === "number" ? rawPosition.x : 100;
  const rawY      = typeof rawPosition.y === "number" ? rawPosition.y : 100;
  const rawWidth  = typeof rawSize.width  === "number" ? rawSize.width  : 200;
  const rawHeight = typeof rawSize.height === "number" ? rawSize.height : 200;

  const safePosition = sanitizePosition(rawX, rawY);
  const safeSize     = sanitizeSize(rawWidth, rawHeight);

  const rawOpacity =
    typeof raw.opacity === "number"
      ? Math.min(1, Math.max(MIGRATION_MIN_OPACITY, raw.opacity))
      : 1;

  const rawType: WidgetType = isValidWidgetType(raw.type) ? raw.type : "clock";
  const rawLabel  = typeof raw.label === "string" ? raw.label : "Widget";
  const safeLabel = rawType === "clock" ? migrateClockLabel(rawLabel) : rawLabel;

  const baseData: Record<string, unknown> =
    raw.data !== null && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};

  const safeData      = migrateWidgetData(rawType, baseData);
  const safeCondition = migrateCondition(raw.condition);
  const safeStack     = migrateStack(raw.stack);

  return {
    id:        typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    type:      rawType,
    position:  safePosition,
    size:      safeSize,
    isVisible: typeof raw.isVisible === "boolean" ? raw.isVisible : true,
    isLocked:  typeof raw.isLocked  === "boolean" ? raw.isLocked  : false,
    label:     safeLabel,
    todoItems: rawTodoItems.map((item) => migrateTodoItem(item as Record<string, unknown>)),
    notes:     rawNotes.map((note) => migrateNote(note as Record<string, unknown>)),
    opacity:   rawOpacity,
    data:      safeData,
    condition:            safeCondition,
    stack:                safeStack,
    alwaysOnTopPerWidget: typeof raw.alwaysOnTopPerWidget === "boolean" ? raw.alwaysOnTopPerWidget : false,
    clickThrough:         typeof raw.clickThrough         === "boolean" ? raw.clickThrough         : false,
  };
}
```

#### `src/store/appStore.ts`

```typescript
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
    data: {},
    condition:            null,
    stack:                { stackId: null, stackOrder: 0 },
    alwaysOnTopPerWidget: false,
    clickThrough:         false,
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
    data: {},
    condition:            null,
    stack:                { stackId: null, stackOrder: 0 },
    alwaysOnTopPerWidget: false,
    clickThrough:         false,
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
    data: {},
    condition:            null,
    stack:                { stackId: null, stackOrder: 0 },
    alwaysOnTopPerWidget: false,
    clickThrough:         false,
  },
];

interface AppStore extends AppState {
  isFocusMode:           boolean;
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
  toggleFocusMode:       () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  version:     9,
  widgets:     DEFAULT_WIDGETS,
  theme:       "dark",
  accentColor: "#6C8EF5",
  fontSize:    "medium",
  autostart:   false,
  alwaysOnTop: false,
  isFocusMode: false,

  setWidgets: (widgets) => set({ widgets }),

  addWidget: (widget) =>
    set((state) => ({ widgets: [...state.widgets, widget] })),

  updateWidget: (id, changes) =>
    set((state) => ({
      widgets: state.widgets.map((w) => w.id === id ? { ...w, ...changes } : w),
    })),

  removeWidget: (id) => {
    if (DEFAULT_WIDGET_IDS.includes(id)) return;
    set((state) => ({ widgets: state.widgets.filter((w) => w.id !== id) }));
  },

  updateWidgetPosition: (id, position) =>
    set((state) => ({
      widgets: state.widgets.map((w) => w.id === id ? { ...w, position } : w),
    })),

  updateWidgetSize: (id, size) =>
    set((state) => ({
      widgets: state.widgets.map((w) => w.id === id ? { ...w, size } : w),
    })),

  setTheme:       (theme)       => set({ theme }),
  setAccentColor: (accentColor) => set({ accentColor }),
  setFontSize:    (fontSize)    => set({ fontSize }),

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

  toggleFocusMode: () =>
    set((state) => ({ isFocusMode: !state.isFocusMode })),
}));

export { DEFAULT_WIDGET_IDS };
```

---

### อธิบายโค้ดส่วนสำคัญ

- **`widget.ts`** — เพิ่ม 2 field ใน interface ทำให้ TypeScript บังคับว่าทุกที่ที่สร้าง `Widget` object ต้องมี field เหล่านี้ ถ้าลืมจะ error ทันที
- **`storage.ts` (migration guard)** — pattern `typeof raw.X === "boolean" ? raw.X : false` คือหัวใจของ migration ไฟล์เก่าที่ไม่มี field นี้จะได้ `false` เป็น default แทน `undefined` ซึ่ง TypeScript ไม่ยอมรับ
- **`appStore.ts` version bump** — เปลี่ยน `version: 8 → 9` บังคับให้ระบบตรวจ migration ทุกครั้งที่โหลด state เก่า

---

### ผลลัพธ์ที่ควรได้

รัน `npx tsc --noEmit` แล้วไม่มี error เกี่ยวกับ `alwaysOnTopPerWidget` หรือ `clickThrough`

พร้อมไปต่อ **Lesson 2** ได้เลย

---

## Lesson 2: Routing + WidgetWindow.tsx

---

### แนวคิด (Concept)

ปัจจุบัน `main.tsx` routing แยกแค่ 2 window: `"main"` → `<App>`, `"quick-capture"` → `<QuickCaptureWindow>`

Phase 9 เพิ่ม window ใหม่ที่ label ขึ้นต้นด้วย `"widget-"` เช่น `"widget-clock-1"` เราใช้ **label เป็น router** แทน URL params เพราะทุก window โหลด `index.html` ไฟล์เดียวกัน — ต่างกันแค่ label ที่ Tauri inject มาให้

`WidgetWindow.tsx` เป็น **thin client** — ไม่มี store ของตัวเอง แค่:

1. แจ้ง controller ว่า "ฉันพร้อมแล้ว ขอ state ด้วย"
2. รอรับ `"widget:state"` event แล้ว render widget ที่ถูกต้อง
3. ส่ง changes กลับ controller ผ่าน events

---

### สิ่งที่เราจะทำ

1. แก้ `src/main.tsx` — เพิ่ม branch `widget-*`
2. สร้าง `src/components/WidgetWindow.tsx` — รองรับแค่ Clock ก่อน (PoC)

---

### ขั้นตอน (Step-by-step)

#### Step 1 — `src/main.tsx`

เปิดไฟล์ → หาบล็อก `if (windowLabel === "quick-capture")` → เพิ่ม branch ใหม่ **ระหว่าง `quick-capture` กับ `else`**:

```typescript
} else if (windowLabel.startsWith("widget-")) {
  const widgetId = windowLabel.replace("widget-", "");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <WidgetWindow widgetId={widgetId} />
    </React.StrictMode>
  );
}
```

และเพิ่ม import `WidgetWindow` ที่บนสุดของ import block:

```typescript
import WidgetWindow from "./components/WidgetWindow";
```

#### Step 2 — สร้าง `src/components/WidgetWindow.tsx`

สร้างไฟล์ใหม่ทั้งหมด (ดูโค้ดเต็มด้านล่าง)

---

### โค้ด (เต็มไฟล์)

#### `src/main.tsx`

```typescript
// src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App";
import QuickCaptureWindow from "./components/QuickCaptureWindow";
import WidgetWindow from "./components/WidgetWindow";

// ใช้ __TAURI_INTERNALS__ แทน getCurrentWindow()
// เพราะ Tauri inject ค่านี้ก่อน JS ทำงาน — ไม่มีปัญหา timing
const windowLabel =
  (window as unknown as {
    __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } };
  }).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? "main";

const rootElement = document.getElementById("root") as HTMLElement;

if (windowLabel === "quick-capture") {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QuickCaptureWindow />
    </React.StrictMode>
  );
} else if (windowLabel.startsWith("widget-")) {
  const widgetId = windowLabel.replace("widget-", "");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <WidgetWindow widgetId={widgetId} />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

#### `src/components/WidgetWindow.tsx` (ไฟล์ใหม่)

```typescript
// src/components/WidgetWindow.tsx
// Phase 9 — thin client สำหรับ per-widget OS window
// ไม่มี store ของตัวเอง — รับ state จาก controller ผ่าน "widget:state" event เท่านั้น

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { Widget } from "../types/widget";
import ClockWidget from "./widgets/ClockWidget";

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

  const scaleFactorRef = useRef<number>(1);
  const containerRef   = useRef<HTMLDivElement>(null);
  const hasShownRef    = useRef<boolean>(false);

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
      // show window ครั้งแรกที่รับ state — window ถูกสร้างแบบ visible: false
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

  // ── Render content (Phase 9-1: Clock only) ────────────────────────────
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
      default:
        return (
          <div style={{ color: "var(--text-primary)", padding: "12px", fontSize: "12px" }}>
            Widget type "{widget.type}" — coming in Phase 9-2
          </div>
        );
    }
  };

  // ── Resize handles (8 จุด) ─────────────────────────────────────────────
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

  // ยังไม่มี state: render ว่างเปล่า (window ยังซ่อนอยู่)
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
```

---

### อธิบายโค้ดส่วนสำคัญ

- **`main.tsx` routing** — ดึง `widgetId` จาก label โดย `replace("widget-", "")` เช่น `"widget-clock-1"` → `"clock-1"` ส่งเป็น prop ให้ `WidgetWindow`
- **Bootstrap sequence** ทำงานแบบนี้:
  1. Component mount → `emit("widget:request-state", { widgetId })`
  2. Controller รับ → `emitTo("widget-clock-1", "widget:state", payload)`
  3. `listen("widget:state")` รับ payload → `setWidget(w)` → React render → `win.show()`
- **`hasShownRef`** — ใช้ ref (ไม่ใช่ state) เพราะไม่ต้องการให้ React re-render ตอนเปลี่ยนค่า แค่จำว่า show ไปแล้วหรือยัง
- **`tauri://move`** — Tauri ยิง event นี้ระหว่าง drag ให้ physical pixels ต้องหารด้วย `scaleFactor` ก่อน emit กลับ controller
- **Resize** — ใช้ DOM mousemove สำหรับ CSS feedback real-time ตอน mouseup ค่อย call `win.setSize()` + `win.setPosition()` ครั้งเดียว เพื่อไม่ให้ Tauri API call ถี่เกินไป

---

### ผลลัพธ์ที่ควรได้

Lesson 2 เสร็จแล้ว แต่ยังทดสอบไม่ได้ เพราะยังขาด Lesson 3 ที่จะสร้าง `useWidgetWindowSync.ts` และแก้ `App.tsx` + Tauri capabilities ให้ controller สร้าง window จริง

---

## Lesson 3: Controller Sync + Tauri Capabilities

---

### แนวคิด (Concept)

Lesson 2 ทำให้ฝั่ง `WidgetWindow.tsx` พร้อมรับ state แล้ว แต่ยังไม่มีฝั่งไหนสร้าง OS window จริง เพราะ controller กลางยังไม่เชื่อม lifecycle ของ widget windows เข้ากับ store

Lesson 3 ต่อ 3 ส่วนเข้าด้วยกัน:

1. `App.tsx` ยังเป็น controller กลางเหมือนเดิม
2. มี hook ใหม่คอยสร้าง, ทำลาย, และ push state ไปยัง widget windows
3. Tauri ต้องมี permissions พอสำหรับ create window, show/hide, resize, move, และ destroy

เป้าหมายยังเป็น **PoC**: สร้าง OS window สำหรับ `clock-1` เพียงตัวเดียว เพื่อพิสูจน์ว่าแนวทางนี้ใช้ได้จริงก่อนขยายไปทุก widget ใน Phase 9-2

---

### สิ่งที่เราจะทำ

แก้ **6 ไฟล์**:

1. สร้าง `src/hooks/useWidgetWindowSync.ts`
2. แก้ `src/App.tsx`
3. แก้ `src-tauri/capabilities/default.json`
4. สร้าง `src-tauri/capabilities/widget-window.json`
5. แก้ `src-tauri/src/lib.rs`
6. แก้ `src/components/WidgetWindow.tsx` — เพิ่ม `win.show()` (Step 6)

---

### ขั้นตอน (Step-by-step)

#### Step 1 — สร้าง `src/hooks/useWidgetWindowSync.ts`

สร้างไฟล์ใหม่ทั้งหมด (ดูโค้ดเต็มด้านล่าง)

Hook นี้เป็น **owner** ของ lifecycle ฝั่ง OS window — สร้าง, ทำลาย, push state ไปยัง widget windows

#### Step 2 — `src/App.tsx`

เปิดไฟล์ แก้ **3 จุด**:

**จุดที่ 1** — เพิ่ม import ต่อท้าย import block:

```typescript
import { useWidgetWindowSync } from "./hooks/useWidgetWindowSync";
```

**จุดที่ 2** — หา `const displayWidgets = useMemo(...)` แล้วเพิ่ม **หลังจากนั้น**:

```typescript
const { createWidgetWindow, destroyWidgetWindow } = useWidgetWindowSync(
  displayWidgets,
  theme,
  accentColor,
  fontSize,
  alwaysOnTop,
  {
    onPositionChange: updateWidgetPosition,
    onSizeChange:     updateWidgetSize,
    onDataChange:     (id, changes) => updateWidget(id, changes),
  },
  isLoaded
);
```

**จุดที่ 3** — เพิ่ม `useEffect` สำหรับ PoC ต่อจากนั้น:

```typescript
useEffect(() => {
  if (!isLoaded) return;
  const clockWidget = displayWidgets.find((widget) => widget.id === "clock-1" && widget.isVisible);
  if (clockWidget) {
    void createWidgetWindow(clockWidget);
  }
  return () => {
    void destroyWidgetWindow("clock-1");
  };
}, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
```

> **หมายเหตุ:** ต้องวาง 2 บล็อกนี้ **หลัง** `const displayWidgets = useMemo(...)` เสมอ ถ้า TypeScript บ่น "used before declared" ให้ตรวจลำดับ

#### Step 3 — `src-tauri/capabilities/default.json`

เปิดไฟล์ แก้ **2 จุด**:

**จุดที่ 1** — หา `"windows": [` เปลี่ยนเป็น:

```json
"windows": ["main", "quick-capture", "widget-*"],
```

**จุดที่ 2** — เพิ่มใน array `"permissions"` ต่อท้าย permissions เดิม:

```json
"core:webview:allow-create-webview-window",
"core:window:allow-show",
"core:window:allow-hide",
"core:window:allow-close",
"core:window:allow-destroy",
"core:window:allow-set-size",
"core:window:allow-set-position",
"core:window:allow-outer-position",
"core:window:allow-scale-factor",
"core:window:allow-set-skip-taskbar",
"core:window:allow-set-decorations"
```

#### Step 4 — สร้าง `src-tauri/capabilities/widget-window.json`

สร้างไฟล์ใหม่ทั้งหมด (ดูโค้ดเต็มด้านล่าง)

#### Step 5 — `src-tauri/src/lib.rs`

เปิดไฟล์ → หาบล็อก `.on_window_event(|window, event| { ... })` → เปลี่ยนจาก:

```rust
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
})
```

เป็น:

```rust
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let label = window.label();
        if label == "main" || label == "quick-capture" {
            api.prevent_close();
            let _ = window.hide();
        }
    }
})
```

#### Step 6 — `src/components/WidgetWindow.tsx`

เปิดไฟล์ → หา `const containerRef = useRef<HTMLDivElement>(null);` → เพิ่ม **บรรทัดถัดไป**:

```typescript
const hasShownRef = useRef<boolean>(false);
```

จากนั้นหาใน `listen<WidgetStatePayload>("widget:state", ...)` หลัง `setFontSize(fs);` → เพิ่ม:

```typescript
      if (!hasShownRef.current) {
        hasShownRef.current = true;
        void win.show();
      }
```

---

### โค้ด (เต็มไฟล์)

#### `src/hooks/useWidgetWindowSync.ts` (ไฟล์ใหม่)

```typescript
import { useEffect, useRef, useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
import { Widget } from "../types/widget";
import type { WidgetStatePayload } from "../components/WidgetWindow";

interface SyncCallbacks {
  onPositionChange: (id: string, pos: { x: number; y: number }) => void;
  onSizeChange:     (id: string, size: { width: number; height: number }) => void;
  onDataChange:     (id: string, changes: Partial<Widget>) => void;
}

export function useWidgetWindowSync(
  widgets:     Widget[],
  theme:       "dark" | "light",
  accentColor: string,
  fontSize:    "small" | "medium" | "large",
  alwaysOnTop: boolean,
  callbacks:   SyncCallbacks,
  enabled:     boolean
) {
  const windowRegistry = useRef<Map<string, WebviewWindow>>(new Map());
  const widgetsRef     = useRef(widgets);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // push state ไปยัง widget window ตัวนึง
  const pushState = useCallback(async (widget: Widget) => {
    const label = `widget-${widget.id}`;
    const payload: WidgetStatePayload = {
      widget, theme, accentColor, fontSize, globalAlwaysOnTop: alwaysOnTop,
    };
    try { await emitTo(label, "widget:state", payload); }
    catch { /* window ยังไม่มีหรือปิดแล้ว — silently ignore */ }
  }, [theme, accentColor, fontSize, alwaysOnTop]);

  // สร้าง OS window ใหม่สำหรับ widget
  const createWidgetWindow = useCallback(async (widget: Widget) => {
    const label = `widget-${widget.id}`;
    if (windowRegistry.current.has(label)) return;

    const win = new WebviewWindow(label, {
      url:         "/",
      decorations: false,
      transparent: true,
      width:       widget.size.width,
      height:      widget.size.height,
      x:           widget.position.x,
      y:           widget.position.y,
      alwaysOnTop: widget.alwaysOnTopPerWidget || alwaysOnTop,
      skipTaskbar: true,
      resizable:   false,
      shadow:      false,
      visible:     false, // ซ่อนก่อน รอรับ widget:state แล้วค่อย show
    });

    windowRegistry.current.set(label, win);
    win.once("tauri://created", () => { void pushState(widget); });
  }, [alwaysOnTop, pushState]);

  // destroy OS window ของ widget
  const destroyWidgetWindow = useCallback(async (widgetId: string) => {
    const label = `widget-${widgetId}`;
    const win = windowRegistry.current.get(label);
    if (!win) return;
    try { await win.destroy(); } catch { /* ignore */ }
    windowRegistry.current.delete(label);
  }, []);

  // รับ events จาก widget windows
  useEffect(() => {
    if (!enabled) return;

    const unlisteners: Array<Promise<() => void>> = [];

    unlisteners.push(listen<{ widgetId: string }>(
      "widget:request-state", (event) => {
        const widget = widgetsRef.current.find((w) => w.id === event.payload.widgetId);
        if (widget) void pushState(widget);
      }
    ));

    unlisteners.push(listen<{ id: string; x: number; y: number }>(
      "widget:position-change", (event) => {
        callbacks.onPositionChange(event.payload.id, { x: event.payload.x, y: event.payload.y });
      }
    ));

    unlisteners.push(listen<{ id: string; width: number; height: number }>(
      "widget:size-change", (event) => {
        callbacks.onSizeChange(event.payload.id, { width: event.payload.width, height: event.payload.height });
      }
    ));

    unlisteners.push(listen<{ id: string; changes: Partial<Widget> }>(
      "widget:data-change", (event) => {
        callbacks.onDataChange(event.payload.id, event.payload.changes);
      }
    ));

    return () => { unlisteners.forEach((p) => p.then((fn) => fn())); };
  }, [enabled, callbacks, pushState]);

  // push state update ทุกครั้งที่ widgets/theme/accent/fontSize เปลี่ยน
  useEffect(() => {
    if (!enabled) return;
    widgets.forEach((w) => { void pushState(w); });
  }, [widgets, theme, accentColor, fontSize, alwaysOnTop, enabled, pushState]);

  return { createWidgetWindow, destroyWidgetWindow };
}
```

#### `src/App.tsx` — เฉพาะส่วนที่เพิ่ม/แก้ (3 จุด)

```typescript
// จุดที่ 1: บน import block
import { useWidgetWindowSync } from "./hooks/useWidgetWindowSync";

// จุดที่ 2: หลัง const displayWidgets = useMemo(...)
const { createWidgetWindow, destroyWidgetWindow } = useWidgetWindowSync(
  displayWidgets,
  theme,
  accentColor,
  fontSize,
  alwaysOnTop,
  {
    onPositionChange: updateWidgetPosition,
    onSizeChange:     updateWidgetSize,
    onDataChange:     (id, changes) => updateWidget(id, changes),
  },
  isLoaded
);

// จุดที่ 3: useEffect PoC สำหรับ clock-1
useEffect(() => {
  if (!isLoaded) return;
  const clockWidget = displayWidgets.find((widget) => widget.id === "clock-1" && widget.isVisible);
  if (clockWidget) {
    void createWidgetWindow(clockWidget);
  }
  return () => {
    void destroyWidgetWindow("clock-1");
  };
}, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### `src-tauri/capabilities/default.json`

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for DeskLoom",
  "windows": ["main", "quick-capture", "widget-*"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-rename",
    "fs:allow-mkdir",
    "fs:allow-exists",
    "fs:scope-appdata-recursive",
    "core:window:allow-set-always-on-top",
    "core:window:allow-start-dragging",
    "core:webview:allow-create-webview-window",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-close",
    "core:window:allow-destroy",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-outer-position",
    "core:window:allow-scale-factor",
    "core:window:allow-set-skip-taskbar",
    "core:window:allow-set-decorations",
    "core:event:allow-emit-to",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled",
    "shell:allow-open",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:scope-document-recursive",
    "fs:scope-home-recursive"
  ]
}
```

#### `src-tauri/capabilities/widget-window.json` (ไฟล์ใหม่)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "widget-window",
  "description": "Capabilities for per-widget OS windows (Phase 9)",
  "windows": ["widget-*"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-outer-position",
    "core:window:allow-scale-factor",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-ignore-cursor-events",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-skip-taskbar",
    "core:event:allow-emit-to",
    "core:event:allow-listen"
  ]
}
```

#### `src-tauri/src/lib.rs`

```rust
// src-tauri/src/lib.rs

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );

            app.global_shortcut().on_shortcut(
                shortcut,
                |app_handle, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) =
                            app_handle.get_webview_window("quick-capture")
                        {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.center();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                },
            )?;

            let show_item =
                MenuItem::with_id(app, "show", "Show DeskLoom", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("DeskLoom")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "main" || label == "quick-capture" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### อธิบายโค้ดส่วนสำคัญ

- **`useWidgetWindowSync`** คือ owner ของ lifecycle ฝั่ง OS window ไม่ใช่ `WidgetWindow.tsx` — แยก concern ชัดเจน
- **`windowRegistry`** (useRef Map) — เก็บ `WebviewWindow` ที่สร้างแล้ว ป้องกันสร้างซ้ำ และใช้ตอน destroy
- **`widgetsRef`** — ให้ event listeners อ่าน widget ล่าสุดได้โดยไม่ต้อง re-register listener ทุกครั้งที่ widgets เปลี่ยน
- **`visible: false` + `win.show()`** — สร้าง window ซ่อนไว้ก่อน รอให้ React mount และรับ state เรียบร้อย แล้วค่อย show เพื่อไม่ให้กระพริบ
- **`default.json` vs `widget-window.json`** — แยก capability ชัดเจน: main window (controller) มีสิทธิ์สร้าง/destroy widget windows, widget windows มีสิทธิ์ drag/resize ตัวเอง
- **`lib.rs` guard** — ถ้ายัง block `CloseRequested` ทุก window `destroy()` จาก controller จะไม่ทำงาน เพราะ OS event ถูก prevent ก่อน
- **`App.tsx` ส่ง `displayWidgets` ไม่ใช่ `widgets`** — เพื่อให้ condition filter ถูกใช้ตรงกับสิ่งที่ controller render จริง

---

### ผลลัพธ์ที่ควรได้

หลังทำ Lesson 3 เสร็จ:

1. รัน `npx tsc --noEmit` — ไม่มี TypeScript error
2. Build และเปิดแอป
3. Main window แสดง canvas ปกติ + มี **OS window ของ Clock ลอยแยกต่างหาก**
4. Drag clock OS window → position save ลง store
5. Toggle 24h ใน clock OS window → store ใน main window อัปเดต
6. Restart → clock window กลับมาที่ตำแหน่งเดิม

ถ้าผ่านทั้งหมด แปลว่า PoC ของ per-widget OS window สำเร็จ พร้อมขยับต่อ **Phase 9-2**
