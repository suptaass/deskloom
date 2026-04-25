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

# 🧠 HANDOFF DOCUMENT — DeskLoom v0.5 Phase 9-3 (Complete)
## ส่งต่อให้ Phase 9-4

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API
Working directory: e:\Project\deskloom

---

## ✅ สิ่งที่เสร็จแล้วใน Phase 9-3 (ทั้งหมด)

### Lesson 1 — appStore.ts: Action `setClickThrough` ✅
- เพิ่ม type `setClickThrough: (id: string, value: boolean) => void` ใน interface
- เพิ่ม implementation: map over widgets เปลี่ยน `clickThrough` เฉพาะ widget ที่ตรง id

### Lesson 2 — useWidgetWindowSync.ts: `setIgnoreCursorEvents` ✅
- ใน `pushState` callback หลัง `emitTo(label, "widget:state", payload)`:
  - ดึง `win` จาก `windowRegistry.current.get(label)`
  - call `win.setIgnoreCursorEvents(widget.clickThrough ?? false)`
  - ครอบ inner try/catch เพื่อไม่ให้กระทบ flow หลัก

### Lesson 3 — SettingsPanel.tsx + App.tsx: Toggle UI ✅
- `SettingsPanelProps`: เพิ่ม `onSetClickThrough: (widgetId: string, value: boolean) => void`
- ใน widget card loop: เพิ่มปุ่ม "🖱 Click-through: On/Off" ก่อนส่วน Opacity
- `App.tsx`: destructure `setClickThrough` จาก store, เพิ่ม `handleSetClickThrough` callback, ส่งเป็น prop

### เนื้อหา + Notion ✅
- เขียน `Lesson/Phase 9-3.md` ครบ (3 Lessons)
- Push เนื้อหาขึ้น Notion sub-page Phase 9-3 สำเร็จ

---

## 🔴 สิ่งที่ต้องทำใน Phase 9-4: Multi-monitor Support

### เป้าหมาย Phase 9-4
ให้ widget จำได้ว่าอยู่บน monitor ไหน และ restore ตำแหน่งให้ถูก monitor เมื่อ restart

### พื้นฐาน Tauri API ที่ใช้
```typescript
import { availableMonitors, currentMonitor } from "@tauri-apps/api/window";

// ดูรายการ monitor ทั้งหมด
const monitors = await availableMonitors();
// { name, size: { width, height }, position: { x, y }, scaleFactor }

// ดู monitor ที่ window อยู่ปัจจุบัน
const monitor = await currentMonitor();
```

### สิ่งที่ต้องทำ

#### ไฟล์ที่ 1: `src/types/widget.ts`
เพิ่ม field `monitorName: string | null` ใน Widget interface

#### ไฟล์ที่ 2: `src/utils/storage.ts`
เพิ่ม migration guard: `monitorName: typeof raw.monitorName === "string" ? raw.monitorName : null`

#### ไฟล์ที่ 3: `src/store/appStore.ts`
- เพิ่ม default `monitorName: null` ใน DEFAULT_WIDGETS
- เพิ่ม action `setWidgetMonitor: (id: string, name: string | null) => void`

#### ไฟล์ที่ 4: `src/hooks/useWidgetWindowSync.ts`
หลัง `createWidgetWindow` สร้าง window แล้ว ดัก event `tauri://move` เพื่อ detect ว่า widget ย้ายไป monitor ไหน แล้ว update store

#### ไฟล์ที่ 5: `Lesson/Phase 9-4.md`
เขียนเนื้อหา Lesson ให้ครบ แล้ว push ขึ้น Notion sub-page Phase 9-4

---

## ✅ Verification หลัง Phase 9-4 เสร็จ
1. `npx tsc --noEmit` — ไม่มี error
2. Build และเปิดแอปบน multi-monitor setup
3. ย้าย widget ไป monitor 2 → Restart → widget ปรากฏที่ monitor 2 ถูกต้อง
4. ถอด monitor 2 → widget fallback ไป monitor หลักได้

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
- Phase 9-4 sub-page: ดูจาก Notion parent page (ยังไม่ได้ระบุ ID)
- Integration token: `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`

## ROADMAP หลัง Phase 9-4
- Phase 9-5: Per-widget always on top & opacity (Tauri window level)
- Phase 9-6: Tray controller (hidden main window)

อ่าน HANDOFF นี้ให้ครบ แล้วสรุปสถานะ 1 ย่อหน้า จากนั้นเริ่ม Phase 9-4 ได้เลย
