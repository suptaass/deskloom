// src/utils/storage.ts

import {
  readTextFile,
  writeTextFile,
  rename,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { AppState, Widget, TodoItem, Note } from "../types/widget";
import { isValidWidgetType, WidgetType } from "../registry/widgetRegistry";

const APP_DIR    = "com.deskloom.app";
const STATE_FILE = `${APP_DIR}/state.json`;
const TEMP_FILE  = `${APP_DIR}/state.tmp.json`;

const MIGRATION_MIN_WIDTH   = 150;
const MIGRATION_MIN_HEIGHT  = 100;
const MIGRATION_MIN_OPACITY = 0.2;

const RETRY_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function migrateTodoItem(raw: Record<string, unknown>): TodoItem {
  return {
    id:        typeof raw.id === "string"        ? raw.id        : crypto.randomUUID(),
    text:      typeof raw.text === "string"       ? raw.text      : "",
    completed: typeof raw.completed === "boolean" ? raw.completed : false,
    createdAt: typeof raw.createdAt === "number"  ? raw.createdAt : Date.now(),
  };
}

function migrateNote(raw: Record<string, unknown>): Note {
  return {
    id:        typeof raw.id === "string"        ? raw.id        : crypto.randomUUID(),
    title:     typeof raw.title === "string"     ? raw.title     : "Untitled",
    content:   typeof raw.content === "string"   ? raw.content   : "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function sanitizePosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, 4000)),
    y: Math.max(0, Math.min(y, 3000)),
  };
}

function sanitizeSize(
  width: number,
  height: number
): { width: number; height: number } {
  return {
    width:  Math.max(MIGRATION_MIN_WIDTH,  width),
    height: Math.max(MIGRATION_MIN_HEIGHT, height),
  };
}

function migrateClockLabel(label: string): string {
  try {
    const parsed = JSON.parse(label) as Record<string, unknown>;
    if (typeof parsed.name === "string") return label;
  } catch {
    // not JSON
  }

  const parts = label.split("||");
  if (parts.length === 3) {
    return JSON.stringify({
      name:   parts[0],
      use24h: parts[1] === "24h",
      locale: parts[2] || "th-TH",
    });
  }

  return JSON.stringify({ name: label, use24h: true, locale: "th-TH" });
}

// ── Migration v8: ตรวจ + ซ่อม data field ตาม widget type ──────────────────
// ทำไมต้องมี function นี้:
//   rawData อาจมาจาก state.json เก่าที่ขาด field บางตัว
//   เช่น habittracker ที่ save ตอน v7 จะไม่มี habits array เลย
//   → ต้อง inject default ให้ก่อน ไม่งั้น widget crash ตอน getHabits()
//
// ทำไมแยกเป็น function ไม่เขียนใน migrateWidget:
//   เมื่อเพิ่ม widget type ใหม่ใน Phase ถัดไป
//   แก้แค่ที่นี่ที่เดียว ไม่ต้องไปแตะ migrateWidget อีก
function migrateWidgetData(
  type: WidgetType,
  rawData: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "habittracker": {
      // guard: ถ้าไม่มี habits หรือ habits ไม่ใช่ array → inject []
      return {
        ...rawData,
        habits: Array.isArray(rawData.habits) ? rawData.habits : [],
      };
    }
    case "quicklinks": {
      // guard: ถ้าไม่มี links หรือ links ไม่ใช่ array → inject []
      return {
        ...rawData,
        links: Array.isArray(rawData.links) ? rawData.links : [],
      };
    }
    case "pomodoro": {
      // guard: ถ้าขาด workMinutes / breakMinutes → inject default
      return {
        ...rawData,
        workMinutes:
          typeof rawData.workMinutes === "number" ? rawData.workMinutes : 25,
        breakMinutes:
          typeof rawData.breakMinutes === "number" ? rawData.breakMinutes : 5,
      };
    }
    // clock, todo, notes, calendar, weather — data เป็น {} ปกติ ไม่มี required field
    default:
      return rawData;
  }
}

function migrateWidget(raw: Record<string, unknown>): Widget {
  const rawPosition  = (raw.position ?? {}) as Record<string, unknown>;
  const rawSize      = (raw.size     ?? {}) as Record<string, unknown>;
  const rawTodoItems = Array.isArray(raw.todoItems) ? raw.todoItems : [];
  const rawNotes     = Array.isArray(raw.notes)     ? raw.notes     : [];

  const rawX      = typeof rawPosition.x === "number" ? rawPosition.x : 100;
  const rawY      = typeof rawPosition.y === "number" ? rawPosition.y : 100;
  const rawWidth  = typeof rawSize.width  === "number" ? rawSize.width  : 200;
  const rawHeight = typeof rawSize.height === "number" ? rawSize.height : 200;

  const safePosition = sanitizePosition(rawX, rawY);
  const safeSize     = sanitizeSize(rawWidth, rawHeight);

  const rawOpacity =
    typeof raw.opacity === "number"
      ? Math.min(1, Math.max(MIGRATION_MIN_OPACITY, raw.opacity))
      : 1;

  // migration guard: ถ้า type ไม่รู้จัก → fallback เป็น "clock"
  const rawType: WidgetType = isValidWidgetType(raw.type) ? raw.type : "clock";

  const rawLabel  = typeof raw.label === "string" ? raw.label : "Widget";
  const safeLabel = rawType === "clock" ? migrateClockLabel(rawLabel) : rawLabel;

  // migration guard: ถ้าไม่มี data field → ใส่ empty object ก่อน
  const baseData: Record<string, unknown> =
    raw.data !== null &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};

  // migration v8: ซ่อม data ตาม type — เพิ่ม field ที่ขาดหายให้ครบ
  const safeData = migrateWidgetData(rawType, baseData);

  return {
    id:        typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    type:      rawType,
    position:  safePosition,
    size:      safeSize,
    isVisible: typeof raw.isVisible === "boolean" ? raw.isVisible : true,
    isLocked:  typeof raw.isLocked  === "boolean" ? raw.isLocked  : false,
    label:     safeLabel,
    todoItems: rawTodoItems.map((item) =>
      migrateTodoItem(item as Record<string, unknown>)
    ),
    notes: rawNotes.map((note) =>
      migrateNote(note as Record<string, unknown>)
    ),
    opacity: rawOpacity,
    data:    safeData,
  };
}

export async function loadState(): Promise<AppState | null> {
  const fileExists = await exists(STATE_FILE, {
    baseDir: BaseDirectory.AppData,
  });
  if (!fileExists) return null;

  const raw    = await readTextFile(STATE_FILE, { baseDir: BaseDirectory.AppData });
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];
  const widgets: Widget[] = rawWidgets.map((w) =>
    migrateWidget(w as Record<string, unknown>)
  );

  const theme: "dark" | "light" =
    parsed.theme === "light" ? "light" : "dark";

  const accentColor: string =
    typeof parsed.accentColor === "string" &&
    parsed.accentColor.startsWith("#")
      ? parsed.accentColor
      : "#6C8EF5";

  const fontSize: "small" | "medium" | "large" =
    parsed.fontSize === "small" || parsed.fontSize === "large"
      ? parsed.fontSize
      : "medium";

  const autostart: boolean =
    typeof parsed.autostart === "boolean" ? parsed.autostart : false;

  const alwaysOnTop: boolean =
    typeof parsed.alwaysOnTop === "boolean" ? parsed.alwaysOnTop : false;

  const version: number =
    typeof parsed.version === "number" ? parsed.version : 0;

  return { version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop };
}

async function attemptSave(state: AppState): Promise<void> {
  await mkdir(APP_DIR, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });
  const json = JSON.stringify(state, null, 2);
  await writeTextFile(TEMP_FILE, json, { baseDir: BaseDirectory.AppData });
  await rename(TEMP_FILE, STATE_FILE, {
    oldPathBaseDir: BaseDirectory.AppData,
    newPathBaseDir: BaseDirectory.AppData,
  });
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await attemptSave(state);
  } catch (firstError) {
    console.warn("[storage] saveState failed, retrying in 300ms...", firstError);
    await delay(RETRY_DELAY_MS);
    try {
      await attemptSave(state);
    } catch (secondError) {
      console.error("[storage] saveState failed after retry:", secondError);
      throw secondError;
    }
  }
}