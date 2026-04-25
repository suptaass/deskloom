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

# 🧠 HANDOFF DOCUMENT — DeskLoom v0.5 Phase 9-4 (Complete)
## ส่งต่อให้ Phase 9-5

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API
Working directory: e:\Project\deskloom

---

## ✅ สิ่งที่เสร็จแล้วใน Phase 9-4 (ทั้งหมด)

### Lesson 1 — types/widget.ts ✅
- เพิ่ม `monitorName: string | null` ใน Widget interface (หลัง `clickThrough`)

### Lesson 2 — utils/storage.ts ✅
- เพิ่ม migration guard ใน `migrateWidget`:
  `monitorName: typeof raw.monitorName === "string" ? raw.monitorName : null`

### Lesson 3 — store/appStore.ts ✅
- เพิ่ม `monitorName: null` ใน DEFAULT_WIDGETS ทั้ง 3 widget (clock-1, todo-1, notes-1)
- เพิ่ม `setWidgetMonitor: (id: string, name: string | null) => void` ใน interface
- เพิ่ม implementation: map over widgets, แก้เฉพาะ `w.id === id`

### Lesson 4 — hooks/useWidgetWindowSync.ts ✅
- เพิ่ม `availableMonitors` import จาก `@tauri-apps/api/window`
- เพิ่ม `onMonitorChange: (id: string, name: string | null) => void` ใน `SyncCallbacks`
- เพิ่ม `callbacksRef` (keep callbacks fresh ใน async listeners) และ `moveUnlistenersRef`
- `createWidgetWindow`: ตรวจ monitor fallback ก่อนสร้าง window + ดัก `tauri://move` per window
- `destroyWidgetWindow`: cleanup move listener ก่อน destroy

### Lesson 5 — App.tsx ✅
- destructure `setWidgetMonitor` จาก store
- ส่ง `onMonitorChange: setWidgetMonitor` ตรงๆ เข้า `useWidgetWindowSync` (Zustand action stable อยู่แล้ว)
- เพิ่ม `monitorName: null` ใน `handleAddWidgetInstance`

### TypeScript ✅
- `npx tsc --noEmit` ผ่านสะอาด ไม่มี error

---

## 🔴 สิ่งที่ต้องทำใน Phase 9-5: Per-widget Always-on-Top & Opacity (Tauri window level)

### เป้าหมาย Phase 9-5
ปัจจุบัน `alwaysOnTopPerWidget` และ `opacity` ถูกใช้ใน CSS/overlay เท่านั้น
Phase 9-5 จะ sync ค่าเหล่านี้ไปยัง Tauri window API จริงๆ ทำให้:
- `alwaysOnTopPerWidget: true` → OS-level always-on-top เฉพาะ widget window นั้น
- `opacity` → `win.setOpacity()` ให้ OS handle แทน CSS (ได้ผลชัวร์บน Windows)

### สิ่งที่ต้องทำ

#### ไฟล์ที่ 1: `src/hooks/useWidgetWindowSync.ts`
ใน `pushState` หลังบล็อก `setIgnoreCursorEvents` เพิ่ม:
```typescript
await win.setAlwaysOnTop(widget.alwaysOnTopPerWidget || alwaysOnTop);
await win.setOpacity(widget.opacity);
```

#### ไฟล์ที่ 2: `Lesson/Phase 9-5.md`
เขียนเนื้อหา Lesson ให้ครบ แล้ว push ขึ้น Notion sub-page Phase 9-5

---

## ✅ Verification หลัง Phase 9-5 เสร็จ
1. `npx tsc --noEmit` — ไม่มี error
2. เปิดแอป → ตั้ง widget ให้ alwaysOnTopPerWidget → เปิด app อื่น → widget ยังลอยอยู่ด้านบน
3. ลด opacity slider → window จางลงระดับ OS (ไม่ใช่แค่ CSS)

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
- Phase 9-5 sub-page: ดูจาก Notion parent page (ยังไม่ได้ระบุ ID)
- Integration token: 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

## ROADMAP หลัง Phase 9-5
- Phase 9-6: Tray controller (hidden main window — main window กลายเป็น hidden controller)

อ่าน HANDOFF นี้ให้ครบ แล้วสรุปสถานะ 1 ย่อหน้า จากนั้นเริ่ม Phase 9-5 ได้เลย
