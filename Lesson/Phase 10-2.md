# Phase 10-2 — Onboarding Flow: Tray Icon Guidance

> **Tech Stack:** Tauri v2 + React + TypeScript + Zustand
> **Working directory:** `e:\Project\deskloom`

---

## เป้าหมาย

- แก้ปัญหา first-run UX: user ติดตั้งแล้วไม่รู้ว่าแอปอยู่ที่ไหน (main window ซ่อน)
- แสดง onboarding overlay อัตโนมัติเมื่อ first run
- อัพเดท hints ให้ตรงกับ Phase 9 architecture (tray-controlled)

---

## ทำไม

Phase 9-6 เปลี่ยน main window เป็น `visible: false` ถาวร
ผลที่ตามมา: user ที่เพิ่งติดตั้ง → เปิดแอป → ไม่เห็นอะไร → งงว่าแอปทำงานหรือเปล่า

ปัญหาที่ซ้อนอยู่อีกชั้น: HINTS เดิมยังบอก "Press Ctrl+," ซึ่งเป็นวิธีเดิมก่อน Phase 9-6
ตอนนี้ทุกอย่างผ่าน tray — hint ต้องสะท้อนความจริงใหม่

**Pattern ที่ถูกต้อง:** First run → show window อัตโนมัติ → onboarding → dismiss → hide window กลับ

---

## สิ่งที่ทำ

### ไฟล์ 1: `src/App.tsx`

**เปลี่ยน 1:** เพิ่ม `show()` ตอนตรวจพบ first run (บรรทัด 123)

```typescript
// เดิม:
if (saved === null) { setIsFirstRun(true); setShowOnboarding(true); }

// ใหม่:
if (saved === null) {
  setIsFirstRun(true);
  setShowOnboarding(true);
  try { await getCurrentWindow().show(); } catch { /* ignore */ }
}
```

**เปลี่ยน 2:** `handleDismissOnboarding` — hide window หลัง dismiss ถ้า settings ยังไม่เปิด

```typescript
// เดิม:
const handleDismissOnboarding = useCallback(() => setShowOnboarding(false), []);

// ใหม่:
const handleDismissOnboarding = useCallback(async () => {
  setShowOnboarding(false);
  if (!isSettingsOpen) {
    try { await getCurrentWindow().hide(); } catch { /* ignore */ }
  }
}, [isSettingsOpen]);
```

### ไฟล์ 2: `src/components/OnboardingOverlay.tsx`

แทนที่ HINTS array:

```typescript
const HINTS: Hint[] = [
  {
    icon:  "🖥️",
    title: "DeskLoom lives in your tray",
    desc:  "Look for the DeskLoom icon in the system tray (bottom-right corner). Click it to open Settings anytime.",
  },
  {
    icon:  "✋",
    title: "Drag widgets freely",
    desc:  "Click and drag any widget to reposition it anywhere on your screen.",
  },
  {
    icon:  "🔲",
    title: "Resize & customize",
    desc:  "Drag widget edges to resize. In Settings you can lock, hide, or adjust each widget individually.",
  },
];
```

---

## อธิบายโค้ดสำคัญ

- `getCurrentWindow().show()` — เรียกเฉพาะ `saved === null` (first run เท่านั้น) — run ปกติ window ยังซ่อน
- `if (!isSettingsOpen)` ใน dismiss handler — ถ้า user คลิก tray ก่อนแล้ว settings เปิดอยู่ด้วย dismiss onboarding แล้วไม่ควร hide window
- Hint แรก = tray icon — สิ่งแรกที่ user เห็นคือข้อความนี้ รู้ทันทีว่าต้องหาอะไร
- ลบ "Press Ctrl+," ออก — shortcut นั้นยังทำงานอยู่แต่ไม่ใช่ primary method อีกต่อไป

---

## ผลลัพธ์

| สถานการณ์ | พฤติกรรม |
|-----------|----------|
| First run | Window โผล่อัตโนมัติ → onboarding แสดง → dismiss → window ซ่อน |
| Run ปกติ | Window ซ่อนตลอด จนกว่าจะคลิก tray |
| คลิก tray แล้ว dismiss onboarding | Window ยังเปิดอยู่ (settings ใช้งานได้ต่อ) |

---

## Verification

```bash
npx tsc --noEmit
```

ทดสอบ:
1. ลบ save file ที่ `%APPDATA%\com.deskloom.app\` ออก (simulate first run)
2. เปิดแอป → Settings window โผล่อัตโนมัติ
3. Onboarding overlay แสดง — hint แรกคือ tray icon
4. กด "Got it" → window ซ่อน
5. เปิดแอปใหม่ → ไม่มี onboarding (save file มีแล้ว)
