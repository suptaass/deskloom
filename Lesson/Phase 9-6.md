# Phase 9-6 — Tray Controller (Hidden Main Window)

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- Main window (`label: "main"`) กลายเป็น hidden controller ถาวร — ไม่ปรากฏ taskbar ไม่มี UI ให้เห็นตั้งแต่เปิดแอป
- User ควบคุมทุกอย่างผ่าน System Tray เท่านั้น
- Tray menu: Settings / Focus Mode / Quit
- Left-click tray → toggle main window (show settings / hide)

---

## Lesson 1 — tauri.conf.json: ซ่อน Main Window

### ทำไม

ก่อนหน้านี้ main window เปิดขึ้นมาเป็น full-screen transparent overlay ทุกครั้งที่เปิดแอป
ใน Phase 9 architecture widget ทุกตัวเป็น OS window แยก → main window ไม่มี UI ที่ต้องแสดงอีกแล้ว
การซ่อนตั้งแต่แรกทำให้ user ไม่เห็น flicker ของ main window ก่อนที่มันจะ hide ตัวเอง

### สิ่งที่จะทำ

ไฟล์: `src-tauri/tauri.conf.json`

ใน main window config เพิ่ม 2 field:

```json
"visible": false,
"skipTaskbar": true
```

### อธิบายโค้ดสำคัญ

- `"visible": false` — window สร้างขึ้นมาแล้วแต่ซ่อนอยู่ ไม่ปรากฏบนหน้าจอ WebView ยังทำงานปกติ
- `"skipTaskbar": true` — ไม่แสดงใน Windows taskbar แม้ตอนที่ window โผล่ขึ้นมา (เปิด settings)
- Tauri WebView ยังรัน JavaScript ต่อเนื่อง → Zustand store และ event listeners ทำงานได้ตามปกติ

### ผลลัพธ์

เปิดแอป → main window ไม่ปรากฏ มีแค่ tray icon ใน system tray

---

## Lesson 2 — lib.rs: Tray Menu ใหม่ + Event Emit

### ทำไม

Tray เดิมมีแค่ "Show DeskLoom" ซึ่ง toggle main window แบบตรงๆ ไม่เพียงพอสำหรับ Phase 9-6
ต้องการ:
1. Menu item แยก: Settings / Focus Mode / Quit
2. Click tray → show window + บอก React ว่าให้เปิด Settings panel
3. Focus Mode ไม่ต้อง show window — emit event ให้ React toggle ได้เลย

**หลักการ Tauri Event:** Rust emit event → WebView window รับ event ผ่าน `listen()` ใน JavaScript
`window.emit("event-name", payload)` ส่ง event ไปยัง window นั้นโดยตรง แม้ window จะซ่อนอยู่

### สิ่งที่จะทำ

ไฟล์: `src-tauri/src/lib.rs`

แทนที่ `show_item` + `quit_item` ด้วย:

```rust
let settings_item =
    MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
let focus_item =
    MenuItem::with_id(app, "focus", "Focus Mode", true, None::<&str>)?;
let quit_item =
    MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&settings_item, &focus_item, &quit_item])?;
```

แทนที่ `on_menu_event`:

```rust
.on_menu_event(|app, event| match event.id.as_ref() {
    "settings" => {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("tray-open-settings", ());
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    "focus" => {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("tray-toggle-focus", ());
        }
    }
    "quit" => { app.exit(0); }
    _ => {}
})
```

แทนที่ `on_tray_icon_event`:

```rust
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
                let _ = window.emit("tray-open-settings", ());
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
})
```

### อธิบายโค้ดสำคัญ

- `window.emit("tray-open-settings", ())` — ส่ง event ไปยัง main window WebView
  React รับได้ผ่าน `listen("tray-open-settings", callback)` แม้ window จะซ่อนอยู่
- `window.show()` ก่อน `set_focus()` — ต้อง show ก่อนเสมอ มิฉะนั้น set_focus ไม่มีผล
- "focus" menu ไม่ต้อง `window.show()` — toggle focus mode ไม่ต้องการให้ settings เปิด
- `is_visible()` check ใน tray click — ถ้า settings เปิดอยู่ (window visible) คลิกอีกครั้ง → hide

### ผลลัพธ์

Right-click tray → เห็น Settings / Focus Mode / Quit
Left-click tray → toggle settings panel

---

## Lesson 3 — App.tsx: รับ Tray Events + Close → Hide Window

### ทำไม

React ต้องรู้ว่า Rust ส่ง event อะไรมา เพื่อ:
- `tray-open-settings` → เปิด SettingsPanel (Rust show window ให้แล้ว React แค่ set state)
- `tray-toggle-focus` → toggle focus mode โดยไม่ต้อง show main window

และเมื่อ user ปิด Settings panel → main window ต้อง hide กลับไปด้วย
เพราะถ้าไม่ hide window จะยังลอยอยู่บนหน้าจอ (transparent แต่ clickable)

### สิ่งที่จะทำ

ไฟล์: `src/App.tsx`

เพิ่ม 2 useEffect (ต่อจาก Quick Capture listener):

```typescript
useEffect(() => {
  const unlistenPromise = listen("tray-open-settings", () => {
    setIsSettingsOpen(true);
  });
  return () => { unlistenPromise.then((fn) => fn()); };
}, []);

useEffect(() => {
  const unlistenPromise = listen("tray-toggle-focus", () => {
    toggleFocusMode();
  });
  return () => { unlistenPromise.then((fn) => fn()); };
}, [toggleFocusMode]);
```

เพิ่ม handler ใหม่ (ใน Handlers section):

```typescript
const handleCloseSettings = useCallback(async () => {
  setIsSettingsOpen(false);
  try { await getCurrentWindow().hide(); } catch { /* ignore */ }
}, []);
```

เปลี่ยน SettingsPanel prop:

```tsx
onClose={handleCloseSettings}
```

### อธิบายโค้ดสำคัญ

- `listen("tray-open-settings", ...)` — รับ event จาก Rust แม้ window จะซ่อนอยู่ WebView ยังทำงาน
- `return () => { unlistenPromise.then((fn) => fn()); }` — cleanup pattern ของ Tauri listen
  ต้อง unlisten เมื่อ component unmount ป้องกัน memory leak
- `getCurrentWindow().hide()` ใน `handleCloseSettings` — ซ่อน main window หลังปิด settings
  ใส่ใน try/catch เพราะ hide อาจ fail ได้ (เช่น ใน dev mode) แต่ไม่ควร crash app

### ผลลัพธ์

- คลิก tray → Settings panel เปิดขึ้นใน main window
- กด X หรือ Esc ปิด Settings → main window ซ่อนกลับไปทันที
- คลิก "Focus Mode" ใน tray → widget ทุกตัว enter focus mode โดยไม่เปิด settings

---

## Lesson 4 — Settings Window: Resize + Drag Region (Post-test Fix)

### ทำไม

หลัง test พบ 2 ปัญหา:
1. Main window ขนาด 1200×700 กว้างเกินไป — SettingsPanel กว้างแค่ 300px ส่วนที่เหลือเป็นช่องว่าง transparent
2. Window ไม่มี title bar (`decorations: false`) → ลาก window ไปวางที่อื่นไม่ได้

**หลักการ `data-tauri-drag-region`:** เป็น HTML attribute ธรรมดา ใส่บน element ใดก็ได้
Tauri จะทำให้ element นั้น drag window ได้ ปุ่มหรือ interactive element ใน children ยังทำงานปกติ
เพราะ click event บน child element มีลำดับความสำคัญสูงกว่า drag

### สิ่งที่จะทำ

**ไฟล์ 1: `src-tauri/tauri.conf.json`** — main window config:

```json
{
  "label": "main",
  "width": 320,
  "height": 750,
  "resizable": false,
  "maximizable": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": false,
  "visible": false,
  "skipTaskbar": true,
  "center": true
}
```

**ไฟล์ 2: `src/components/SettingsPanel.tsx`** — header div บรรทัด 270 เพิ่ม attribute:

```tsx
<div data-tauri-drag-region style={{ ...sectionStyle, display: "flex", ... }}>
```

### อธิบายโค้ดสำคัญ

- `"width": 320` — SettingsPanel กว้าง 300px บวก margin เล็กน้อย พอดี
- `"center": true` — window โผล่กลางหน้าจอทุกครั้งที่ start app (session เดียวกัน drag ไปวางที่ไหน ก็อยู่ที่นั่น)
- ลบ `minWidth`/`maxWidth`/`minHeight`/`maxHeight` ออก — ไม่จำเป็นเพราะ `resizable: false`
- `data-tauri-drag-region` บน header div → user ลาก Settings window ได้โดย hold ที่แถบ "Settings"

### ผลลัพธ์

Settings window เปิดขึ้นกลางหน้าจอ ขนาดพอดี 320×750 ลากย้ายได้โดย hold ที่แถบ header

---

## Lesson 5 — useWidgetWindowSync.ts: Skip Redundant IPC During Drag (Lag Fix)

### ทำไม

Phase 9-5 เพิ่ม `setAlwaysOnTop()` ใน `pushState` ถูกต้อง — แต่ `pushState` ถูกเรียกทุกครั้งที่ widget state เปลี่ยน รวมถึง **ทุก drag frame** ที่ position อัปเดต

ผลที่เกิดขึ้น: ระหว่าง drag 1 วินาที
- `pushState` ถูกเรียก ~60 ครั้ง
- ถ้ามี 5 widget: `setAlwaysOnTop` + `setIgnoreCursorEvents` รวม **600 IPC calls/วินาที**
- แต่ละ IPC call = round-trip ไปยัง Rust process → drag ติด

**ค่าทั้งสองนี้ไม่เปลี่ยนระหว่าง drag เลย** — เปลี่ยนเฉพาะตอน user toggle setting
ดังนั้นถ้าค่าเหมือนเดิม → ข้ามไปได้เลย ไม่ต้อง call IPC

### สิ่งที่จะทำ

ไฟล์: `src/hooks/useWidgetWindowSync.ts`

1. เพิ่ม 2 ref ในส่วนประกาศ refs:

```typescript
const prevAlwaysOnTopRef  = useRef<Map<string, boolean>>(new Map());
const prevClickThroughRef = useRef<Map<string, boolean>>(new Map());
```

2. แทนที่ block ใน `pushState`:

```typescript
// เดิม (เรียก IPC ทุกครั้งไม่ว่าค่าจะเปลี่ยนหรือไม่):
await win.setIgnoreCursorEvents(widget.clickThrough ?? false);
await win.setAlwaysOnTop(widget.alwaysOnTopPerWidget || alwaysOnTop);

// ใหม่ (skip ถ้าค่าเหมือนเดิม):
const newClickThrough = widget.clickThrough ?? false;
if (prevClickThroughRef.current.get(label) !== newClickThrough) {
  await win.setIgnoreCursorEvents(newClickThrough);
  prevClickThroughRef.current.set(label, newClickThrough);
}
const newAlwaysOnTop = widget.alwaysOnTopPerWidget || alwaysOnTop;
if (prevAlwaysOnTopRef.current.get(label) !== newAlwaysOnTop) {
  await win.setAlwaysOnTop(newAlwaysOnTop);
  prevAlwaysOnTopRef.current.set(label, newAlwaysOnTop);
}
```

3. ใน `destroyWidgetWindow` เพิ่ม cleanup:

```typescript
prevAlwaysOnTopRef.current.delete(label);
prevClickThroughRef.current.delete(label);
```

### อธิบายโค้ดสำคัญ

- `prevAlwaysOnTopRef` เป็น `Map<string, boolean>` — key คือ window label, value คือค่าที่ set ไปล่าสุด
- `if (prev !== next)` check → IPC call เกิดขึ้นเฉพาะตอนค่าเปลี่ยนจริง (เช่น user toggle toggle ใน Settings)
- ระหว่าง drag: ทั้ง `clickThrough` และ `alwaysOnTop` ไม่เปลี่ยน → 0 IPC calls → drag ลื่น
- cleanup ใน `destroyWidgetWindow` ป้องกัน Map leak เมื่อ widget ถูกลบ

### ผลลัพธ์

Drag widget ลื่นขึ้นอย่างเห็นได้ชัด `setAlwaysOnTop`/`setIgnoreCursorEvents` เรียกเฉพาะตอน toggle setting เท่านั้น

---

## Verification

```bash
npx tsc --noEmit
```

ต้องไม่มี error จากนั้น build และทดสอบ:

1. เปิดแอป → main window ไม่ปรากฏ มีแค่ tray icon
2. Left-click tray → Settings window เปิดกลางหน้าจอ ขนาด 320×750
3. Drag ที่ header "Settings" → window เคลื่อนที่ได้
4. ปิด Settings → main window ซ่อน
5. Right-click tray → Focus Mode → widget enter focus mode
6. Drag widget → ลื่น ไม่ติด
7. Widget ทุกตัวยังทำงานปกติ
