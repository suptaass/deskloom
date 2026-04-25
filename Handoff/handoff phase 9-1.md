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

# 🧠 HANDOFF DOCUMENT — DeskLoom v0.5 Phase 9-1 (Complete)
## ส่งต่อให้ Phase 9-2

## โปรเจกต์
DeskLoom — Desktop Widget App (Windows)
Tech Stack: Tauri v2 + React + TypeScript + Zustand + Tauri FS API
Working directory: e:\Project\deskloom

---

## ✅ สิ่งที่เสร็จแล้วใน Phase 9-1 (ทั้งหมด)

### Lesson 1 — Type Extension + Migration + Store Bump ✅
- `src/types/widget.ts` — เพิ่ม `alwaysOnTopPerWidget: boolean` และ `clickThrough: boolean` ท้าย Widget interface
- `src/utils/storage.ts` — เพิ่ม migration guard 2 field ใน `migrateWidget()`
- `src/store/appStore.ts` — bump `version: 9`, เพิ่ม 2 field ใน DEFAULT_WIDGETS ทั้ง 3 ตัว
- `src-tauri/tauri.conf.json` — version `"0.5.0"`
- `src-tauri/Cargo.toml` — version `"0.5.0"`

### Lesson 2 — Routing + WidgetWindow.tsx ✅
- `src/main.tsx` — เพิ่ม branch `widget-*` ระหว่าง quick-capture กับ else
- `src/components/WidgetWindow.tsx` — สร้างใหม่ (thin client: request-state → listen → render → show)
  - `hasShownRef` + `win.show()` ครั้งแรกที่รับ state (Step 6 เสร็จแล้ว)
  - รองรับ Clock widget เท่านั้น (Phase 9-2 จะเพิ่มประเภทอื่น)

### Lesson 3 — Controller Sync + Tauri Capabilities ✅
- `src/hooks/useWidgetWindowSync.ts` — สร้างใหม่ (lifecycle hook: create/destroy/pushState/listeners)
- `src/App.tsx` — import hook + call `useWidgetWindowSync` + PoC useEffect สำหรับ clock-1 เท่านั้น
- `src-tauri/capabilities/default.json` — เพิ่ม `widget-*` ใน windows + permissions ครบ
- `src-tauri/capabilities/widget-window.json` — สร้างใหม่ (permissions สำหรับ widget windows)
- `src-tauri/src/lib.rs` — guard `CloseRequested` เฉพาะ main + quick-capture เท่านั้น

### เนื้อหา + Notion ✅
- สร้าง `Lesson/Phase 9-1.md` (Lessons 1–3 ครบ รูปแบบใหม่)
- สร้าง `Lesson/Phase 9-2.md` ถึง `Phase 9-6.md` (placeholder)
- Push เนื้อหา Phase 9-1 ขึ้น Notion sub-page ครบ 184 blocks
- สร้าง Notion sub-pages ทั้ง 6 ภายใต้ Phase 9 parent page

---

## 🔴 สิ่งที่ต้องทำใน Phase 9-2

### เป้าหมาย Phase 9-2
migrate widgets **ทุกตัว** เป็น OS window และลบ DesktopCanvas ออก

### ไฟล์ที่ 1: `src/App.tsx`
**อ่านไฟล์ก่อนเสมอ**

แก้ 2 จุด:

**จุดที่ 1** — หา PoC useEffect ที่มี `clock-1` อยู่ (บรรทัดประมาณ 250–261) เปลี่ยนจาก clock-1 เฉพาะ เป็น loop ผ่าน displayWidgets ทั้งหมด:

```typescript
// เปลี่ยนจาก:
useEffect(() => {
  if (!isLoaded) return;
  const clockWidget = displayWidgets.find((widget) => widget.id === "clock-1" && widget.isVisible);
  if (clockWidget) {
    void createWidgetWindow(clockWidget);
  }
  return () => {
    void destroyWidgetWindow("clock-1");
  };
}, [isLoaded]);

// เป็น:
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

**จุดที่ 2** — หาบรรทัดที่ render `<DesktopCanvas ... />` ใน return JSX แล้ว**ลบหรือ comment ออก** (ต้องอ่านไฟล์ก่อนเพื่อหาตำแหน่งที่แน่นอน)

### ไฟล์ที่ 2: `src/components/WidgetWindow.tsx`
**อ่านไฟล์ก่อนเสมอ**

หา `renderContent()` function → เพิ่ม cases สำหรับ widget ประเภทอื่น:

```typescript
case "todo":
  return <TodoWidget widget={widget} onDataChange={(changes) => {
    emit("widget:data-change", { id: widget.id, changes });
  }} />;

case "notes":
  return <NotesWidget widget={widget} onDataChange={(changes) => {
    emit("widget:data-change", { id: widget.id, changes });
  }} />;
```

⚠️ **ต้องอ่านไฟล์ `TodoWidget.tsx` และ `NotesWidget.tsx` ก่อน** เพื่อดู props ที่รับจริง — ห้ามเดา signature

### ไฟล์ที่ 3: `src/hooks/useWidgetWindowSync.ts`
ตรวจสอบว่า hook ปัจจุบันจัดการ widget ที่ **เพิ่มใหม่** (addWidget) และ **ลบออก** (removeWidget) ได้หรือยัง

ถ้ายัง: เพิ่ม useEffect ที่ watch `widgets.length` หรือ `widgets.map(w => w.id).join()` เพื่อ destroy window ของ widget ที่หายไปจาก list

### ไฟล์ที่ 4: `Lesson/Phase 9-2.md`
เขียนเนื้อหา Lesson ให้ครบ (ตาม format เดิม) แล้ว push ขึ้น Notion sub-page Phase 9-2
(Notion sub-page ID: `3449dbe9-a749-8189-adf2-fa50611577f3`)

---

## ✅ Verification หลัง Phase 9-2 เสร็จ
1. `npx tsc --noEmit` — ไม่มี error
2. Build และเปิดแอป
3. ทุก widget (clock, todo, notes) ควรเป็น OS window แยกกัน
4. Main window ไม่มี DesktopCanvas อีกแล้ว (หน้าจอว่างหรือ settings only)
5. เพิ่ม widget ใหม่ → OS window ใหม่ปรากฏ
6. ลบ widget → OS window หายไป
7. Restart → ทุก window กลับมาที่ตำแหน่งเดิม

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
- Phase 9-2 sub-page ID: `3449dbe9-a749-8189-adf2-fa50611577f3`
- Integration token: `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`

## ROADMAP หลัง Phase 9-2
- Phase 9-3: Click-through mode (`setIgnoreCursorEvents`)
- Phase 9-4: Multi-monitor support
- Phase 9-5: Per-widget always on top & opacity
- Phase 9-6: Tray controller (hidden main window)

อ่าน HANDOFF นี้ให้ครบ แล้วสรุปสถานะ 1 ย่อหน้า จากนั้นเริ่ม Phase 9-2 ได้เลย
