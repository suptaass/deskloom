# Phase 9-4 — Multi-monitor Support

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- Widget จำได้ว่าตัวเองอยู่บน monitor ไหน
- เมื่อ restart → widget กลับไปอยู่ monitor เดิม
- ถ้า monitor นั้นหายไป (ถอดสาย) → fallback ไป primary monitor อัตโนมัติ

---

## Lesson 1 — types/widget.ts: เพิ่ม field `monitorName`

### ทำไม
ต้องมี field ใน Widget type ก่อน ถึงจะ persist และ restore ได้ การเก็บเป็น `string | null` ทำให้ type-safe: `null` = ยังไม่รู้ว่าอยู่ monitor ไหน (widget ใหม่หรือ widget เก่าก่อน Phase 9-4)

### สิ่งที่จะทำ
ไฟล์: `src/types/widget.ts`

เพิ่มใน Widget interface หลัง `clickThrough`:
```typescript
monitorName: string | null;
```

### ผลลัพธ์
TypeScript รู้จัก `widget.monitorName` แล้ว — ยังไม่มีค่า ต้องเพิ่ม default ใน store และ migration ใน storage

---

## Lesson 2 — utils/storage.ts: Migration guard สำหรับ `monitorName`

### ทำไม
ไฟล์ state.json เก่า (ก่อน Phase 9-4) ไม่มี `monitorName` field → ถ้า load แล้วไม่มี guard จะได้ `undefined` ซึ่ง TypeScript จะ error และแอปอาจ crash

### สิ่งที่จะทำ
ไฟล์: `src/utils/storage.ts`

ใน `migrateWidget` — หลัง `clickThrough` line เพิ่ม:
```typescript
monitorName: typeof raw.monitorName === "string" ? raw.monitorName : null,
```

### อธิบายโค้ดสำคัญ
- pattern เดียวกับ `clickThrough` — ตรวจ type ก่อนใช้
- `null` คือ default ที่ปลอดภัย: hook จะไม่ทำ monitor check ถ้า `monitorName` เป็น `null`

### ผลลัพธ์
โหลด state เก่าได้โดยไม่ crash — `monitorName` จะเป็น `null` สำหรับ widget ที่ยังไม่เคยถูก drag

---

## Lesson 3 — store/appStore.ts: DEFAULT_WIDGETS + Action `setWidgetMonitor`

### ทำไม
1. DEFAULT_WIDGETS ต้องมี `monitorName: null` ครบทุก widget ไม่งั้น TypeScript error
2. ต้องมี action ให้ hook เรียกได้เมื่อ detect monitor ใหม่

### สิ่งที่จะทำ
ไฟล์: `src/store/appStore.ts`

**ตำแหน่งที่ 1** — เพิ่ม `monitorName: null` ใน DEFAULT_WIDGETS ทั้ง 3 widget (clock-1, todo-1, notes-1):
```typescript
monitorName: null,
```

**ตำแหน่งที่ 2** — เพิ่มใน `AppStore` interface (หลัง `setClickThrough`):
```typescript
setWidgetMonitor: (id: string, name: string | null) => void;
```

**ตำแหน่งที่ 3** — เพิ่ม implementation (หลัง `setClickThrough`):
```typescript
setWidgetMonitor: (id, name) =>
  set((state) => ({
    widgets: state.widgets.map((w) => w.id === id ? { ...w, monitorName: name } : w),
  })),
```

### ผลลัพธ์
`useAppStore((state) => state.setWidgetMonitor)` ใช้งานได้จาก App.tsx

---

## Lesson 4 — useWidgetWindowSync.ts: Monitor detection + Fallback

### ทำไม
Logic ทั้งหมดอยู่ใน hook นี้:
1. **Fallback**: ตอนสร้าง window ถ้า monitor เดิมหายไป → เลื่อน position ไป (100, 100)
2. **Detection**: ทุกครั้งที่ drag → `tauri://move` ให้ physical coordinates → เช็คว่าอยู่ใน monitor ไหน → update store

### สิ่งที่จะทำ
ไฟล์: `src/hooks/useWidgetWindowSync.ts`

**ตำแหน่งที่ 1** — เพิ่ม import:
```typescript
import { availableMonitors } from "@tauri-apps/api/window";
```

**ตำแหน่งที่ 2** — เพิ่ม `onMonitorChange` ใน `SyncCallbacks` interface:
```typescript
onMonitorChange: (id: string, name: string | null) => void;
```

**ตำแหน่งที่ 3** — เพิ่ม refs ข้างใน hook:
```typescript
const callbacksRef       = useRef(callbacks);
const moveUnlistenersRef = useRef<Map<string, () => void>>(new Map());
// ...
useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);
```

**ตำแหน่งที่ 4** — ใน `createWidgetWindow` ก่อนสร้าง WebviewWindow เพิ่ม monitor fallback:
```typescript
let startX = widget.position.x;
let startY = widget.position.y;

if (widget.monitorName) {
  try {
    const monitors = await availableMonitors();
    const saved = monitors.find((m) => m.name === widget.monitorName);
    if (!saved) { startX = 100; startY = 100; }
  } catch { /* ignore */ }
}
```

แล้วใช้ `x: startX, y: startY` แทน `x: widget.position.x, y: widget.position.y`

**ตำแหน่งที่ 5** — หลัง `win.once("tauri://created", ...)` เพิ่ม move listener:
```typescript
win.listen("tauri://move", async (event) => {
  const { x, y } = event.payload as { x: number; y: number };
  try {
    const monitors = await availableMonitors();
    const monitor  = monitors.find(
      (m) =>
        x >= m.position.x && x < m.position.x + m.size.width &&
        y >= m.position.y && y < m.position.y + m.size.height
    );
    callbacksRef.current.onMonitorChange(widget.id, monitor?.name ?? null);
  } catch { /* ignore */ }
}).then((unlisten) => {
  moveUnlistenersRef.current.set(label, unlisten);
}).catch(() => { /* ignore */ });
```

**ตำแหน่งที่ 6** — ใน `destroyWidgetWindow` ก่อน `win.destroy()` เพิ่ม cleanup:
```typescript
const unlistenMove = moveUnlistenersRef.current.get(label);
if (unlistenMove) {
  unlistenMove();
  moveUnlistenersRef.current.delete(label);
}
```

### อธิบายโค้ดสำคัญ
- `tauri://move` ส่ง **physical pixels** (raw OS coordinates) — ต้องเทียบกับ `m.position.x/y` ของ monitor ที่เป็น physical pixels เช่นกัน
- `callbacksRef` ป้องกัน stale closure ใน async listener — ใช้ `.current` เสมอแทน `callbacks` โดยตรง
- `moveUnlistenersRef` เก็บ unlisten function แยกต่อ window เพื่อ cleanup ตอน destroy

### ผลลัพธ์
ทุกครั้งที่ drag widget ไป monitor อื่น → `monitorName` อัปเดตใน store → persist ไปกับ state.json

---

## Lesson 5 — App.tsx: Wire `setWidgetMonitor` + `onMonitorChange`

### ทำไม
`useWidgetWindowSync` ต้องการ `onMonitorChange` callback ใน `SyncCallbacks` — ต้องส่งมาจาก App.tsx ซึ่งเป็น owner ของ store

### สิ่งที่จะทำ
ไฟล์: `src/App.tsx`

**ตำแหน่งที่ 1** — destructure store action (หลัง `setClickThrough`):
```typescript
const setWidgetMonitor = useAppStore((state) => state.setWidgetMonitor);
```

**ตำแหน่งที่ 2** — เพิ่ม `onMonitorChange` ใน callbacks object ที่ส่งเข้า `useWidgetWindowSync`:
```typescript
onMonitorChange: setWidgetMonitor,
```

**ตำแหน่งที่ 3** — เพิ่ม `monitorName: null` ใน `handleAddWidgetInstance` → `addWidget(...)`:
```typescript
monitorName: null,
```

### อธิบายโค้ดสำคัญ
- ส่ง `setWidgetMonitor` ตรงๆ แทนที่จะ wrap ใน `useCallback` เพราะ Zustand action เป็น stable reference อยู่แล้ว
- `monitorName: null` ในการสร้าง widget ใหม่ = ยังไม่รู้ว่าอยู่ monitor ไหน (hook จะ detect ตอน drag ครั้งแรก)

### ผลลัพธ์
`setWidgetMonitor` ถูกเรียกทุกครั้งที่ hook detect monitor change → store อัปเดต → auto-save เก็บลง disk

---

## Verification

```bash
npx tsc --noEmit
```

ต้องไม่มี error จากนั้น:
1. Build และเปิดแอป
2. ย้าย widget ไป monitor 2 → Restart → widget ปรากฏที่ monitor 2 ถูกต้อง
3. ถอด monitor 2 → widget fallback ไป (100, 100) บน primary monitor
