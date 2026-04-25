คุณคือ Programming Tutor ระดับมืออาชีพ และเป็น Technical Instructor ที่เข้มงวดมาก
หน้าที่ของคุณ: สอนสร้างโปรเจกต์ต่อจาก session ก่อน

กฎสำคัญ (ห้ามฝ่าฝืน):
1. ห้าม redesign architecture
2. ต้องบอกเสมอ: เปิดไฟล์ไหน / เพิ่ม-แก้ตรงไหน
3. ห้ามพูดกว้าง เช่น "เพิ่มโค้ดเข้าไป"
4. โค้ดต้องเป็นภาษาอังกฤษเท่านั้น
5. อธิบายเป็นภาษาไทยเท่านั้น
6. อธิบาย "ทำไม" ก่อน "ทำอย่างไร"
7. ถ้าไม่แน่ใจ ให้บอกว่าไม่แน่ใจ ห้ามเดา
8. ถ้าบทเรียนใดต้องแก้ไฟล์ที่ยังไม่ได้รับ → ห้ามเดาโค้ด → แจ้งชื่อไฟล์ที่ต้องการก่อน
9. รูปแบบคำตอบ: แนวคิด → สิ่งที่จะทำ → ขั้นตอน → โค้ด (เต็มไฟล์เมื่อจำเป็น) → อธิบายโค้ดสำคัญ → ผลลัพธ์
10. หากเพิ่ม/แก้โค้ดเสร็จทุกครั้ง ให้ตรวจ TypeScript error ด้วย `npx tsc --noEmit`
11. ประหยัด context — ไม่ spawn agent โดยไม่จำเป็น ใช้ Grep/Read ตรงเมื่อรู้ path แล้ว
12. ใช้ token อย่างประหยัด — บอกแค่ชื่อไฟล์ + ตำแหน่ง ไม่ต้องแปะโค้ดเต็มหากไม่จำเป็น

---

# 🧠 HANDOFF DOCUMENT — DeskLoom v0.5 Phase 9-2 (Complete)
## ส่งต่อให้ Phase 9-3

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API
Working directory: e:\Project\deskloom

---

## ✅ สิ่งที่เสร็จแล้วใน Phase 9-2 (ทั้งหมด)

### Lesson 1 — App.tsx: Loop All Widgets + Remove DesktopCanvas ✅
- เปลี่ยน PoC `useEffect` จาก clock-1 เดียว → loop ผ่าน `displayWidgets` ทั้งหมด (filter `isVisible`)
- ลบ `<DesktopCanvas />` ออกจาก JSX
- ลบ imports, handlers, และ useMemo ที่ใช้เฉพาะ DesktopCanvas:
  - `DesktopCanvas` import + `WidgetCallbacks`/`ContentCallbacks` types
  - `handleClockConfigChange`, `handleSetActiveStackTab`, `handleUpdateStackPosition`, `handleUpdateStackSize`
  - todo/notes handlers ทั้งหมด (`handleAddTodo`, `handleToggleTodo`, `handleDeleteTodo`, `handleClearCompleted`, `handleAddNote`, `handleUpdateNote`, `handleDeleteNote`, `handleUpdateWidgetData`)
  - `widgetCallbacks` useMemo, `contentCallbacks` useMemo

### Lesson 2 — WidgetWindow.tsx: TodoWidget + NotesWidget ✅
- import `TodoWidget` และ `NotesWidget`
- เพิ่ม `case "todo"` และ `case "notes"` ใน `renderContent()`
- แต่ละ case emit `widget:data-change` พร้อม computed data (immutable update pattern)
- props ที่ส่งให้ TodoWidget: `onAdd`, `onToggle`, `onDelete`, `onClearCompleted`
- props ที่ส่งให้ NotesWidget: `onAdd`, `onUpdate`, `onDelete`

### Lesson 3 — useWidgetWindowSync.ts: Dynamic Window Management ✅
- เพิ่ม `prevWidgetIdsRef` (Set) เก็บ IDs จาก render ก่อนหน้า
- เพิ่ม `useEffect` ที่ diff widget IDs ระหว่าง render:
  - ID ใหม่ (อยู่ใน current แต่ไม่อยู่ใน prev) → `createWidgetWindow` ถ้า `isVisible`
  - ID หายไป (อยู่ใน prev แต่ไม่อยู่ใน current) → `destroyWidgetWindow`

### เนื้อหา + Notion ✅
- เขียน `Lesson/Phase 9-2.md` ครบ (3 Lessons, 128 blocks)
- Push เนื้อหาขึ้น Notion sub-page Phase 9-2 สำเร็จ
- สร้าง `push-notion-92.mjs` (script ชั่วคราว — ลบได้หลังใช้งานแล้ว)

---

## 🔴 สิ่งที่ต้องทำใน Phase 9-3

### เป้าหมาย Phase 9-3
เพิ่ม **Click-through mode** — widget window ที่เปิด `clickThrough: true` จะไม่รับ mouse event
(คลิกทะลุผ่าน widget ไปยัง desktop/window ด้านหลังได้)

### พื้นฐาน Tauri API ที่ใช้
```
win.setIgnoreCursorEvents(true)   // เปิด click-through
win.setIgnoreCursorEvents(false)  // ปิด click-through
```

### ไฟล์ที่ 1: `src/hooks/useWidgetWindowSync.ts`
**อ่านไฟล์ก่อนเสมอ**

เมื่อ `pushState` ส่ง state ใหม่ให้ widget window ต้องตรวจด้วยว่า `widget.clickThrough` เปลี่ยนไปหรือไม่
ถ้าเปลี่ยน → call `win.setIgnoreCursorEvents(widget.clickThrough)`

แนวทาง: หลังจาก `emitTo(label, "widget:state", payload)` สำเร็จ ดึง window จาก registry แล้ว call:

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

### ไฟล์ที่ 2: `src/components/SettingsPanel.tsx`
**อ่านไฟล์ก่อนเสมอ**

เพิ่ม toggle สำหรับ `clickThrough` ใน per-widget settings
(ตรวจดู props ที่ SettingsPanel รับก่อน — อาจต้องเพิ่ม `onSetClickThrough` callback)

### ไฟล์ที่ 3: `src/App.tsx`
ถ้า SettingsPanel ต้องการ `onSetClickThrough` callback → เพิ่มใน App.tsx และส่งเป็น prop

### ไฟล์ที่ 4: `Lesson/Phase 9-3.md`
เขียนเนื้อหา Lesson ให้ครบ (ตาม format เดิม) แล้ว push ขึ้น Notion sub-page Phase 9-3
(Notion sub-page ID: ดูจาก Notion Phase 9 parent page)

---

## ✅ Verification หลัง Phase 9-3 เสร็จ
1. `npx tsc --noEmit` — ไม่มี error
2. Build และเปิดแอป
3. เปิด click-through สำหรับ Clock widget → คลิกทะลุผ่านนาฬิกาได้
4. ปิด click-through → คลิก drag/resize ทำงานปกติ
5. Restart → ค่า clickThrough ยังคงอยู่ (เก็บใน store + persist)

---

## ⚠️ CRITICAL RULES (ยังใช้ทั้งหมด)
- `App.tsx` เท่านั้นที่ call `useAppStore()` — `WidgetWindow.tsx` ห้าม import store
- ส่ง `displayWidgets` เข้า `useWidgetWindowSync` ไม่ใช่ `widgets` ดิบ
- field ใหม่ใน Widget ต้องมี migration guard ใน `storage.ts` เสมอ
- `SettingsPanel` ยัง dumb component

---

## VERSION ปัจจุบัน
- `tauri.conf.json`: `"0.5.0"` ✅
- `Cargo.toml`: `"0.5.0"` ✅
- `appStore.ts`: `version: 9` ✅

## NOTION
- Project overview: https://www.notion.so/33a9dbe9a74980dca193f976d99c9bc0
- Phase 9 page: https://www.notion.so/Phase-9-Per-Widget-Window-Architecture-3449dbe9a74980b6af00d789030f17b1
- Phase 9-3 sub-page: ดูจาก Notion parent page (ยังไม่ได้ระบุ ID)
- Integration token: `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`

## ROADMAP หลัง Phase 9-3
- Phase 9-4: Multi-monitor support
- Phase 9-5: Per-widget always on top & opacity
- Phase 9-6: Tray controller (hidden main window)

อ่าน HANDOFF นี้ให้ครบ แล้วสรุปสถานะ 1 ย่อหน้า จากนั้นเริ่ม Phase 9-3 ได้เลย
