# Phase 9-5 — Per-widget Always On Top & Drag Lag Fix

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand + Tauri FS API
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- Sync `alwaysOnTopPerWidget` ไปยัง Tauri window API จริงๆ (OS-level)
- แก้ drag lag ที่เกิดจาก `tauri://move` เรียก `availableMonitors()` ทุก pixel

---

## Lesson 1 — useWidgetWindowSync.ts: `setAlwaysOnTop` ใน `pushState`

### ทำไม
Phase 9-1 เพิ่ม `alwaysOnTopPerWidget` ไว้ใน Widget type แต่ยังไม่เคย sync ไปยัง Tauri window API
ตอน `createWidgetWindow` จะตั้งค่าครั้งแรกผ่าน option `alwaysOnTop` แต่ถ้า user toggle ทีหลัง
ใน SettingsPanel — ค่าใน store เปลี่ยนแต่ window ยังไม่รู้ `pushState` คือจุดเดียวที่ sync ทุก state change

> **หมายเหตุ:** `setOpacity()` ไม่มีใน Tauri v2 WebviewWindow TypeScript types
> Opacity ทำงานผ่าน CSS `opacity` ใน WidgetWindow.tsx อยู่แล้ว — เพียงพอสำหรับ use case นี้

### สิ่งที่จะทำ
ไฟล์: `src/hooks/useWidgetWindowSync.ts`

ใน `pushState` — ภายใน `if (win)` block หลัง `setIgnoreCursorEvents` เพิ่ม:
```typescript
await win.setAlwaysOnTop(widget.alwaysOnTopPerWidget || alwaysOnTop);
```

### อธิบายโค้ดสำคัญ
- `widget.alwaysOnTopPerWidget || alwaysOnTop` — per-widget OR global: ถ้าอย่างใดอย่างหนึ่งเป็น true → window ลอยอยู่บนสุด
- ครอบอยู่ใน try/catch เดิมแล้ว — fail โดยไม่กระทบ flow หลัก
- `pushState` ถูกเรียกทุกครั้งที่ store เปลี่ยน → toggle ใน Settings จะมีผลทันที

### ผลลัพธ์
กด toggle "Always on Top" ใน SettingsPanel → widget window ลอยอยู่บน app อื่นทันที ไม่ต้อง restart

---

## Lesson 2 — useWidgetWindowSync.ts: Debounce `tauri://move` (Drag Lag Fix)

### ทำไม
`tauri://move` ยิง event ทุกครั้งที่ window เลื่อน **แม้แต่ 1 pixel** ระหว่าง drag
Phase 9-4 ดักเหตุการณ์นี้เพื่อ detect monitor แต่ทุก event เรียก `availableMonitors()`
ซึ่งเป็น async IPC call ไป Rust process — บน drag เร็วๆ อาจยิง 60+ ครั้ง/วินาที ทำให้ drag ติด

**หลักการ Debounce:** รอให้ event หยุดยิง 400ms ก่อนค่อยทำงาน
ระหว่าง drag ตัว timer จะถูก reset ทุก event — `availableMonitors()` จะถูกเรียกครั้งเดียว
เมื่อ drag หยุด (400ms ผ่าน) ซึ่งเพียงพอสำหรับ monitor detection

### สิ่งที่จะทำ
ไฟล์: `src/hooks/useWidgetWindowSync.ts`

แก้ใน `createWidgetWindow` — แทนที่ `win.listen("tauri://move", async (event) => {...})` เดิม:

```typescript
let monitorDebounceTimer: ReturnType<typeof setTimeout> | null = null;
win.listen("tauri://move", (event) => {
  const { x, y } = event.payload as { x: number; y: number };
  if (monitorDebounceTimer) clearTimeout(monitorDebounceTimer);
  monitorDebounceTimer = setTimeout(async () => {
    try {
      const monitors = await availableMonitors();
      const monitor  = monitors.find(
        (m) =>
          x >= m.position.x && x < m.position.x + m.size.width &&
          y >= m.position.y && y < m.position.y + m.size.height
      );
      callbacksRef.current.onMonitorChange(widget.id, monitor?.name ?? null);
    } catch { /* ignore */ }
  }, 400);
}).then((unlisten) => {
  moveUnlistenersRef.current.set(label, unlisten);
}).catch(() => { /* ignore */ });
```

### อธิบายโค้ดสำคัญ
- `let monitorDebounceTimer` อยู่นอก listener — เป็น closure variable ของแต่ละ window
- `clearTimeout` ทุกครั้งที่ event ใหม่มา → ยกเลิก call เก่า ทำให้ `availableMonitors()` ไม่ถูกเรียกระหว่าง drag
- ลบ `async` ออกจาก event handler เพราะ async จริงอยู่ใน `setTimeout` callback แล้ว
- timer ไม่ต้อง cleanup แยก เพราะเมื่อ window ถูก destroy, listener ถูก unlisten ไปด้วย

### ผลลัพธ์
Drag widget ลื่นขึ้นทันที — `availableMonitors()` ถูกเรียกครั้งเดียวหลัง drag หยุด 400ms

---

## Verification

```bash
npx tsc --noEmit
```

ต้องไม่มี error จากนั้น:
1. Build และเปิดแอป
2. ทดสอบ drag widget — ต้องลื่นขึ้นอย่างเห็นได้ชัด
3. กด toggle "Always on Top" ใน SettingsPanel → เปิด app อื่น → widget ต้องลอยอยู่บนสุด
4. ปิด always on top → widget กลับไปอยู่ปกติ
