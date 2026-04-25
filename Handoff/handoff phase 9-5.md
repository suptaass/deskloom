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

# 🧠 HANDOFF DOCUMENT — DeskLoom v0.5 Phase 9-5 (Complete)
## ส่งต่อให้ Phase 9-6

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API
Working directory: e:\Project\deskloom

---

## ✅ สิ่งที่เสร็จแล้วใน Phase 9-5 (ทั้งหมด)

### Lesson 1 — hooks/useWidgetWindowSync.ts: `setAlwaysOnTop` ใน `pushState` ✅
- ใน `if (win)` block หลัง `setIgnoreCursorEvents`:
  `await win.setAlwaysOnTop(widget.alwaysOnTopPerWidget || alwaysOnTop);`
- ครอบ try/catch เดิมอยู่แล้ว
- หมายเหตุ: `setOpacity()` ไม่มีใน Tauri v2 WebviewWindow types — opacity ยังคงเป็น CSS-based ผ่าน WidgetWindow.tsx

### Lesson 2 — hooks/useWidgetWindowSync.ts: Debounce drag lag fix ✅
- เพิ่ม `let monitorDebounceTimer` เป็น closure variable ก่อน `win.listen("tauri://move")`
- ภายใน handler: `clearTimeout` ก่อน + `setTimeout(..., 400)` ครอบ `availableMonitors()` call
- ลบ `async` ออกจาก event handler (async อยู่ใน setTimeout callback แทน)
- ผล: drag ลื่น, `availableMonitors()` เรียกครั้งเดียวหลัง drag หยุด 400ms

### TypeScript ✅
- `npx tsc --noEmit` ผ่านสะอาด ไม่มี error

---

## 🔴 สิ่งที่ต้องทำใน Phase 9-6: Tray Controller (Hidden Main Window)

### เป้าหมาย Phase 9-6
Main window (`label: "main"`) จะกลายเป็น hidden controller ถาวร — ไม่มี UI ให้เห็น
Widget ทุกตัวเป็น OS window แยก (Phase 9 architecture)
User ควบคุมทุกอย่างผ่าน System Tray เท่านั้น

### สิ่งที่ต้องทำ

#### ไฟล์ที่ 1: `src-tauri/src/lib.rs`
- เปลี่ยน main window ให้ `visible: false` ตั้งแต่ start
- Tray menu เพิ่ม item: "Settings", "Focus Mode", "Quit"
- on_tray_icon_event click → toggle Settings window แทน main window

#### ไฟล์ที่ 2: `src-tauri/tauri.conf.json`
- main window: `"visible": false`

#### ไฟล์ที่ 3: `src/App.tsx`
- SettingsPanel trigger ไม่ใช่ gear button บน main window แล้ว
- รับ event จาก tray แทน (ผ่าน Tauri event)

#### ไฟล์ที่ 4: `Lesson/Phase 9-6.md`
เขียนเนื้อหา Lesson ให้ครบ แล้ว push ขึ้น Notion sub-page Phase 9-6

---

## ✅ Verification หลัง Phase 9-6 เสร็จ
1. `npx tsc --noEmit` — ไม่มี error
2. เปิดแอป → main window ไม่ปรากฏ
3. คลิก tray icon → Settings panel เปิดขึ้น
4. Widget ทุกตัวยังทำงานปกติ

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
- Phase 9-6 sub-page: ดูจาก Notion parent page (ยังไม่ได้ระบุ ID)
- Integration token: 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

## ROADMAP หลัง Phase 9-6
- Phase 9 จบแล้ว → git commit ทุก phase, tag v0.5.0, push
- Phase 10: Installer + Onboarding + Weather API key UI

อ่าน HANDOFF นี้ให้ครบ แล้วสรุปสถานะ 1 ย่อหน้า จากนั้นเริ่ม Phase 9-6 ได้เลย
