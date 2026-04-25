# Phase 9-3 — Click-through Mode

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- เชื่อม field `clickThrough: boolean` (เพิ่มไว้ตั้งแต่ Phase 9-1) เข้ากับ Tauri API `setIgnoreCursorEvents()`
- mouse events จะผ่านทะลุ widget window ได้เมื่อเปิด click-through
- เพิ่ม toggle ใน Settings Panel ของแต่ละ widget

---

## Lesson 1 — appStore.ts: เพิ่ม Action `setClickThrough`

### ทำไม
`clickThrough` field มีอยู่ใน Widget type และ storage แล้วตั้งแต่ Phase 9-1 แต่ยังไม่มี store action ที่เปลี่ยนค่ามันได้ ต้องเพิ่มก่อนที่ UI จะ call ได้

### สิ่งที่จะทำ
ไฟล์: `src/store/appStore.ts`

1. เพิ่ม type signature ใน interface (บล็อก `setAlwaysOnTop` / `setAutostart`)
2. เพิ่ม implementation ใน `create<AppStore>(...)`

**ตำแหน่งที่ 1** — หลัง `setAutostart: (value: boolean) => void;` ใน interface:
```typescript
setClickThrough: (id: string, value: boolean) => void;
```

**ตำแหน่งที่ 2** — หลัง `setAutostart: (autostart) => set({ autostart }),` ใน implementation:
```typescript
setClickThrough: (id, value) =>
  set((state) => ({
    widgets: state.widgets.map((w) => w.id === id ? { ...w, clickThrough: value } : w),
  })),
```

### อธิบายโค้ดสำคัญ
- pattern เดียวกับ `setOpacity` — map over widgets, แก้เฉพาะ `w.id === id`
- ไม่ต้อง clamp ค่า เพราะเป็น boolean

### ผลลัพธ์
`useAppStore((state) => state.setClickThrough)` ใช้งานได้จาก App.tsx

---

## Lesson 2 — useWidgetWindowSync.ts: เรียก `setIgnoreCursorEvents`

### ทำไม
`pushState` ส่ง widget state ไปให้ widget window ทุกครั้งที่ข้อมูลเปลี่ยน แต่ `clickThrough` เป็น property ของ *window* ไม่ใช่ *content* — ต้องเรียก Tauri API บน window object โดยตรงหลัง emitTo

### สิ่งที่จะทำ
ไฟล์: `src/hooks/useWidgetWindowSync.ts`

แก้ใน `pushState` callback — หลัง `await emitTo(label, "widget:state", payload);` เพิ่ม:

```typescript
const win = windowRegistry.current.get(label);
if (win) {
  try {
    await win.setIgnoreCursorEvents(widget.clickThrough ?? false);
  } catch {
    // ignore
  }
}
```

### อธิบายโค้ดสำคัญ
- ดึง `win` จาก `windowRegistry.current` ซึ่งเก็บ `WebviewWindow` instance ของแต่ละ widget
- `setIgnoreCursorEvents(true)` → OS-level: window ไม่รับ mouse event ใดๆ เลย
- `?? false` guard กันกรณีที่ widget เก่าไม่มี field นี้ (migration อาจ return undefined)
- try/catch ด้านนอก (`emitTo`) ครอบอยู่แล้ว แต่เพิ่ม inner try/catch ให้ `setIgnoreCursorEvents` fail โดยไม่กระทบ flow

### ผลลัพธ์
ทุกครั้งที่ store เปลี่ยน → `pushState` ถูก call → `setIgnoreCursorEvents` ตาม `clickThrough` ล่าสุด

---

## Lesson 3 — SettingsPanel.tsx + App.tsx: Toggle UI

### ทำไม
`SettingsPanel` เป็น dumb component — ต้องรับ callback `onSetClickThrough` จาก App.tsx จึงจะแก้ state ใน store ได้ App.tsx เป็น owner ของ store action ทั้งหมด

### สิ่งที่จะทำ

#### ไฟล์ที่ 1: `src/components/SettingsPanel.tsx`

**ตำแหน่งที่ 1** — เพิ่มใน `SettingsPanelProps` interface (หลัง `onRemoveWidgetFromStack`):
```typescript
onSetClickThrough: (widgetId: string, value: boolean) => void;
```

**ตำแหน่งที่ 2** — destructure ใน function parameter (เพิ่ม `onSetClickThrough,` ในกลุ่ม callbacks)

**ตำแหน่งที่ 3** — เพิ่ม UI ก่อนส่วน Opacity ใน widget card loop (`.map((widget) => {...})`):
```typescript
{/* Click-through */}
<div style={{ marginBottom: "8px" }}>
  <button
    style={{ ...baseBtnStyle, width: "100%", fontSize: "11px", padding: "4px 0",
      borderColor: widget.clickThrough ? "var(--accent-color)" : "var(--btn-border)",
      color: widget.clickThrough ? "var(--accent-color)" : "var(--btn-text)",
      background: widget.clickThrough ? "color-mix(in srgb, var(--accent-color) 15%, transparent)" : "var(--btn-bg)" }}
    onClick={() => onSetClickThrough(widget.id, !widget.clickThrough)}
  >
    {widget.clickThrough ? "🖱 Click-through: On" : "🖱 Click-through: Off"}
  </button>
</div>
```

#### ไฟล์ที่ 2: `src/App.tsx`

**ตำแหน่งที่ 1** — destructure store action (หลัง `setOpacity`):
```typescript
const setClickThrough = useAppStore((state) => state.setClickThrough);
```

**ตำแหน่งที่ 2** — เพิ่ม callback (หลัง `handleSetOpacity`):
```typescript
const handleSetClickThrough = useCallback(
  (widgetId: string, value: boolean) => setClickThrough(widgetId, value),
  [setClickThrough]
);
```

**ตำแหน่งที่ 3** — ส่ง prop ให้ `<SettingsPanel>` (หลัง `onRemoveWidgetFromStack`):
```typescript
onSetClickThrough={handleSetClickThrough}
```

### ผลลัพธ์
กด toggle ใน Settings → `clickThrough` เปลี่ยนใน store → `pushState` fire → `setIgnoreCursorEvents` ถูกเรียก → คลิกทะลุทันที

---

## Verification

```bash
npx tsc --noEmit
```

ต้องไม่มี error จากนั้น:
1. Build และเปิดแอป
2. เปิด Settings → กด "🖱 Click-through: Off" บน Clock widget → เปลี่ยนเป็น On
3. คลิกที่ Clock widget → คลิกทะลุไปถึง desktop ด้านหลังได้
4. ปิด click-through → drag/resize ทำงานปกติ
5. Restart → ค่ายังคงอยู่ (persist ผ่าน storage.ts)
