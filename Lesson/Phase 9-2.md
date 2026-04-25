# Phase 9-2 — Full Migration: All Widgets as OS Windows

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- migrate widgets ทุกตัว (todo-1, notes-1, และ widget ที่ผู้ใช้เพิ่ม) ให้เป็น OS window
- ลบ `DesktopCanvas` component ออก เพราะ widgets ไม่ได้ render บน canvas อีกต่อไป
- `useWidgetWindowSync` จัดการ lifecycle ของทุก widget window อัตโนมัติ

---

## Lesson 1 — App.tsx: Loop All Widgets + Remove DesktopCanvas

### แนวคิด

ใน Phase 9-1 เราสร้าง PoC ที่สร้าง OS window สำหรับ `clock-1` ตัวเดียว เพื่อทดสอบว่า architecture ทำงานได้
Phase 9-2 คือการ "เปิดสวิตช์" ให้ทุก widget ทำงานเป็น OS window

ทำไมต้องลบ `DesktopCanvas` ด้วย?
เพราะ `DesktopCanvas` คือ component ที่ render widgets บน main window (แบบ overlay บนหน้าจอ)
เมื่อทุก widget มี OS window เป็นของตัวเองแล้ว การ render ซ้ำอีกรอบบน canvas จะทำให้มี 2 ชุด (OS window + canvas) ซึ่งผิดเป้าหมาย

### สิ่งที่จะทำ

1. แก้ `useEffect` ใน `App.tsx` จาก clock-1 เดียว → loop ทุก widget ที่ `isVisible`
2. ลบ `<DesktopCanvas />` ออกจาก JSX
3. ลบ imports และ callbacks ที่ใช้เฉพาะ DesktopCanvas (เพราะ TypeScript มี `noUnusedLocals: true`)

### ขั้นตอน

**เปิดไฟล์:** `src/App.tsx`

**จุดที่ 1** — ลบ import DesktopCanvas บรรทัด 11-12:

```typescript
// ลบออก:
import DesktopCanvas from "./components/DesktopCanvas";
import type { WidgetCallbacks, ContentCallbacks } from "./components/DesktopCanvas";
```

**จุดที่ 2** — หา PoC `useEffect` (ประมาณบรรทัด 250) เปลี่ยนจาก clock-1 เดียว เป็น loop ทุก widget:

```typescript
// เปลี่ยนจาก (PoC):
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

// เป็น (full loop):
useEffect(() => {
  if (!isLoaded) return;

  displayWidgets
    .filter((w) => w.isVisible)
    .forEach((w) => { void createWidgetWindow(w); });

  return () => {
    displayWidgets.forEach((w) => { void destroyWidgetWindow(w.id); });
  };
}, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
```

**จุดที่ 3** — ลบ callbacks ที่ใช้เฉพาะ DesktopCanvas:
- ลบ `handleClockConfigChange` (ใช้ใน widgetCallbacks เท่านั้น)
- ลบ `handleSetActiveStackTab`, `handleUpdateStackPosition`, `handleUpdateStackSize` (ใช้เป็น props ของ DesktopCanvas เท่านั้น)
- ลบ handlers ทั้งหมดใน todo / notes group: `handleAddTodo`, `handleToggleTodo`, `handleDeleteTodo`, `handleClearCompleted`, `handleAddNote`, `handleUpdateNote`, `handleDeleteNote`, `handleUpdateWidgetData`
- ลบ `widgetCallbacks` useMemo และ `contentCallbacks` useMemo

**จุดที่ 4** — ลบ `<DesktopCanvas ... />` ออกจาก JSX return (ส่วน render)

### อธิบายโค้ดสำคัญ

```typescript
displayWidgets
  .filter((w) => w.isVisible)
  .forEach((w) => { void createWidgetWindow(w); });
```

- `displayWidgets` คือ widgets ที่ผ่าน condition filter แล้ว (จาก `useMemo` ที่มีอยู่เดิม)
- `.filter((w) => w.isVisible)` — ไม่สร้าง OS window สำหรับ widget ที่ซ่อนอยู่
- `void createWidgetWindow(w)` — `void` เพื่อ ignore Promise (ไม่ต้อง await ใน forEach)

Cleanup function ใน return:
```typescript
return () => {
  displayWidgets.forEach((w) => { void destroyWidgetWindow(w.id); });
};
```
ทำไมไม่ filter `isVisible` ตอน cleanup? เพราะเราต้องการ destroy **ทุก window** ที่เคยสร้างไว้ไม่ว่า visibility จะเป็นอะไร

### ผลลัพธ์

- เมื่อแอปโหลดเสร็จ (`isLoaded = true`) → OS window สำหรับ clock, todo, notes ถูกสร้างพร้อมกัน
- Main window ไม่มี widgets render อีกต่อไป (canvas ว่างเปล่า)

---

## Lesson 2 — WidgetWindow.tsx: เพิ่ม TodoWidget + NotesWidget

### แนวคิด

`WidgetWindow.tsx` คือ "thin client" — มันไม่รู้จัก store, ไม่รู้จัก App state
มันรับข้อมูล `widget` ผ่าน event `widget:state` เท่านั้น

เมื่อ user โต้ตอบ (เพิ่ม todo, แก้ note) WidgetWindow จะ:
1. คำนวณ data ใหม่จาก `widget` state ที่มีอยู่
2. emit `widget:data-change` ไปให้ controller (`useWidgetWindowSync`)
3. Controller รับและ call `updateWidget` ใน store
4. Store เปลี่ยน → `pushState` ส่ง state ใหม่กลับมา → WidgetWindow re-render

วงจรนี้ทำให้ data ยังเก็บอยู่ที่ `App.tsx/store` ตัวเดียว (single source of truth)

### สิ่งที่จะทำ

1. import `TodoWidget` และ `NotesWidget`
2. เพิ่ม `case "todo"` และ `case "notes"` ใน `renderContent()` function
3. แต่ละ case ต้องแปลง event-based interface ของ WidgetWindow → props ที่ TodoWidget/NotesWidget ต้องการ

### ขั้นตอน

**เปิดไฟล์:** `src/components/WidgetWindow.tsx`

**จุดที่ 1** — เพิ่ม import หลัง ClockWidget:

```typescript
import ClockWidget from "./widgets/ClockWidget";
import TodoWidget from "./widgets/TodoWidget";
import NotesWidget from "./widgets/NotesWidget";
```

**จุดที่ 2** — ใน `renderContent()` เพิ่ม cases หลัง `case "clock"`:

```typescript
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
```

### อธิบายโค้ดสำคัญ

**ทำไม TodoWidget ถึงไม่รับ `widgetId` แต่รับ `onAdd(text)` แทน?**

TodoWidget ออกแบบมาเป็น "dumb component" — มันไม่รู้จัก widget ID หน้าที่ของมันคือแสดงข้อมูลและ call callback เท่านั้น
WidgetWindow เป็น wrapper ที่รู้จัก `widget.id` และ emit event ที่ถูกต้อง

**ทำไมถึงต้องสร้าง array ใหม่แทนการ push?**

```typescript
todoItems: [
  ...widget.todoItems,          // spread items เดิม
  { id: crypto.randomUUID(), text: text.trim(), ... },  // + item ใหม่
]
```

React/Zustand ตรวจ state change ด้วย reference equality (`===`)
ถ้า push เข้า array เดิม reference ไม่เปลี่ยน → React คิดว่า state ไม่เปลี่ยน → ไม่ re-render

**`onUpdate` ของ NotesWidget:**

```typescript
notes: widget.notes.map((note) =>
  note.id === noteId ? { ...note, ...changes, updatedAt: Date.now() } : note
)
```
`{ ...note, ...changes }` — spread note เดิมก่อน แล้ว override ด้วย changes (title หรือ content)
`updatedAt: Date.now()` — อัพเดท timestamp ทุกครั้งที่แก้ไข

### ผลลัพธ์

- OS window ของ todo-1 แสดง TodoWidget ที่ใช้งานได้ (เพิ่ม/ลบ/tick todo)
- OS window ของ notes-1 แสดง NotesWidget ที่ใช้งานได้ (เพิ่ม/แก้/ลบ note)
- ทุกการเปลี่ยนแปลงถูก sync กลับไปที่ store ผ่าน `widget:data-change` event

---

## Lesson 3 — useWidgetWindowSync.ts: Dynamic Window Management

### แนวคิด

ปัญหาที่ค้างอยู่: เมื่อ user เพิ่ม widget ใหม่ผ่าน Settings (`addWidget`) หรือลบ widget (`removeWidget`) — hook ปัจจุบันทำอะไรไม่ได้

ทบทวน useEffect ที่มีอยู่ใน hook:
```
useEffect([widgets, ...]) → pushState ให้ทุก widget
```
ปัญหาคือ `pushState` ส่งข้อมูลให้ **window ที่มีอยู่แล้ว** เท่านั้น
ถ้า widget ใหม่เพิ่งถูก add มา ยังไม่มี window → `emitTo` ไม่มีปลายทาง → ไม่มีอะไรเกิดขึ้น

วิธีแก้: เพิ่ม useEffect ที่ **เปรียบเทียบ widget IDs ระหว่าง render** เพื่อตรวจว่า widget ถูกเพิ่มหรือลบ

### สิ่งที่จะทำ

1. เพิ่ม `prevWidgetIdsRef` เก็บ Set ของ widget IDs จาก render ก่อนหน้า
2. เพิ่ม `useEffect` ที่ watch `widgets` และ diff กับ `prevWidgetIdsRef`
   - มี ID ใหม่ → `createWidgetWindow`
   - ID หายไป → `destroyWidgetWindow`

### ขั้นตอน

**เปิดไฟล์:** `src/hooks/useWidgetWindowSync.ts`

**จุดที่ 1** — เพิ่ม ref ใน function body หลัง `widgetsRef`:

```typescript
const windowRegistry = useRef<Map<string, WebviewWindow>>(new Map());
const widgetsRef = useRef(widgets);
const prevWidgetIdsRef = useRef<Set<string>>(new Set());  // เพิ่มบรรทัดนี้
```

**จุดที่ 2** — เพิ่ม `useEffect` ใหม่ หลัง useEffect ที่ pushState:

```typescript
// ── Watch widget list — create window สำหรับ widget ใหม่, destroy สำหรับที่ถูกลบ ──
useEffect(() => {
  if (!enabled) return;

  const currentIds = new Set(widgets.map((w) => w.id));
  const prevIds = prevWidgetIdsRef.current;

  // Widget ใหม่: อยู่ใน current แต่ไม่อยู่ใน prev → สร้าง window ถ้า isVisible
  widgets.forEach((w) => {
    if (!prevIds.has(w.id) && w.isVisible) {
      void createWidgetWindow(w);
    }
  });

  // Widget ที่ถูกลบ: อยู่ใน prev แต่ไม่อยู่ใน current → destroy window
  prevIds.forEach((id) => {
    if (!currentIds.has(id)) {
      void destroyWidgetWindow(id);
    }
  });

  prevWidgetIdsRef.current = currentIds;
}, [widgets, enabled, createWidgetWindow, destroyWidgetWindow]);
```

### อธิบายโค้ดสำคัญ

**ทำไมต้องใช้ `Set` แทน Array?**

`Set.has()` — O(1) lookup
`Array.includes()` — O(n) scan

สำหรับ widget 3-10 ตัวมันไม่ต่างกัน แต่ Set เป็น idiom ที่ถูกต้องสำหรับ "ตรวจสมาชิก"

**ทำไม `prevWidgetIdsRef` แทน `prevWidgetIdsState`?**

ถ้าใช้ `useState` → การอัพเดทจะ trigger re-render → เกิด infinite loop
ใช้ `useRef` → เก็บ state ข้าม render โดยไม่ trigger re-render

**ทำไม useEffect นี้ไม่ทำงานแทน useEffect ของ App.tsx?**

- `App.tsx` useEffect: สร้าง window ตอน **mount ครั้งแรก** (`[isLoaded]` dependency)
- hook useEffect นี้: จัดการ **การเปลี่ยนแปลงหลังจาก mount** (`[widgets]` dependency)
- สองอันทำงานคนละ phase ของ lifecycle — ต้องมีทั้งคู่

### ผลลัพธ์

- เปิดแอป → OS window ทุกตัวสร้างพร้อมกัน (จาก App.tsx useEffect)
- เพิ่ม widget ใหม่ผ่าน Settings → OS window ใหม่ปรากฏทันที
- ลบ widget → OS window หายไปทันที
- Restart → widget กลับมาที่ตำแหน่งเดิม (position เก็บใน store → save → load)

---

## Verification Checklist

```
npx tsc --noEmit     → ไม่มี error ✅
```

1. Build และเปิดแอป
2. Clock, Todo, Notes แต่ละตัวมี OS window เป็นของตัวเอง
3. Main window ไม่มี widgets render อีกต่อไป
4. แก้ไข todo/note → ข้อมูลถูก save (ปิด-เปิดใหม่ข้อมูลยังอยู่)
5. เพิ่ม widget ใหม่ผ่าน Settings → OS window ใหม่ปรากฏ
6. ลบ widget → OS window หายไป
7. Drag window ย้ายตำแหน่ง → Restart → ยังอยู่ที่ตำแหน่งเดิม
