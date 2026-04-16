// src/utils/condition.ts

import { WidgetCondition } from "../types/widget";

// ── checkCondition ─────────────────────────────────────────────────────────
// คืน true ถ้าเวลาปัจจุบัน + วันปัจจุบัน pass condition ที่ตั้งไว้
//
// activeDays: [] = ทุกวัน (ไม่กรองวัน)
// timeStart > timeEnd = ข้ามคืน เช่น 22:00–06:00
// ฟังก์ชันนี้ pure — ไม่มี side effect — test ได้ง่าย
export function checkCondition(condition: WidgetCondition): boolean {
  const now     = new Date();
  const today   = now.getDay(); // 0=Sun ... 6=Sat

  // ── ตรวจวัน ──────────────────────────────────────────────────────────────
  // activeDays ว่าง = ทุกวัน ผ่านทันที
  const dayOk =
    condition.activeDays.length === 0 ||
    condition.activeDays.includes(today);

  if (!dayOk) return false;

  // ── ตรวจเวลา ─────────────────────────────────────────────────────────────
  const [sh, sm] = condition.timeStart.split(":").map(Number);
  const [eh, em] = condition.timeEnd.split(":").map(Number);

  const nowMins   = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;

  // กรณีข้ามคืน: startMins > endMins เช่น 22:00 (1320) → 06:00 (360)
  // active ถ้า nowMins >= start หรือ nowMins < end
  if (startMins > endMins) {
    return nowMins >= startMins || nowMins < endMins;
  }

  // กรณีปกติ: active ถ้า start <= now < end
  return nowMins >= startMins && nowMins < endMins;
}

// ── DEFAULT_CONDITION ──────────────────────────────────────────────────────
// ค่า default เมื่อ user เพิ่ง enable condition เป็นครั้งแรก
export const DEFAULT_CONDITION: WidgetCondition = {
  enabled:    true,
  timeStart:  "08:00",
  timeEnd:    "18:00",
  activeDays: [1, 2, 3, 4, 5], // จันทร์–ศุกร์
};