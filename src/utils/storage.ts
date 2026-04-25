// src/utils/storage.ts

import {
  readTextFile,
  writeTextFile,
  rename,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { AppState, Widget, TodoItem, Note, WidgetCondition, WidgetStack } from "../types/widget";
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

function migrateWidgetData(
  type: WidgetType,
  rawData: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "habittracker":
      return { ...rawData, habits: Array.isArray(rawData.habits) ? rawData.habits : [] };
    case "quicklinks":
      return { ...rawData, links: Array.isArray(rawData.links) ? rawData.links : [] };
    case "pomodoro":
      return {
        ...rawData,
        workMinutes:  typeof rawData.workMinutes  === "number" ? rawData.workMinutes  : 25,
        breakMinutes: typeof rawData.breakMinutes === "number" ? rawData.breakMinutes : 5,
      };
    default:
      return rawData;
  }
}

// ── migrateCondition ───────────────────────────────────────────────────────
// ทำไม: ไฟล์เก่า (v8 ลงไป) ไม่มี condition field เลย → null
// ไฟล์ใหม่อาจมี condition ที่ field ขาด → ซ่อมให้ครบ
// ถ้า raw ไม่ใช่ object หรือ enabled ไม่ใช่ boolean → return null (= ไม่มี condition)
function migrateCondition(raw: unknown): WidgetCondition | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const r = raw as Record<string, unknown>;

  // ถ้าไม่มี enabled ที่เป็น boolean → ถือว่าไม่ใช่ condition object จริง
  if (typeof r.enabled !== "boolean") return null;

  return {
    enabled:   r.enabled,
    timeStart: typeof r.timeStart === "string" ? r.timeStart : "08:00",
    timeEnd:   typeof r.timeEnd   === "string" ? r.timeEnd   : "18:00",
    activeDays: Array.isArray(r.activeDays)
      ? (r.activeDays as unknown[]).filter((d): d is number => typeof d === "number")
      : [1, 2, 3, 4, 5],
  };
}

function migrateStack(raw: unknown): WidgetStack {
  if (raw === null || raw === undefined) {
    return { stackId: null, stackOrder: 0 };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { stackId: null, stackOrder: 0 };
  }

  const stack = raw as Record<string, unknown>;
  return {
    stackId:
      typeof stack.stackId === "string" && stack.stackId.trim()
        ? stack.stackId
        : null,
    stackOrder:
      typeof stack.stackOrder === "number" && stack.stackOrder >= 0
        ? Math.floor(stack.stackOrder)
        : 0,
  };
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

  const rawType: WidgetType = isValidWidgetType(raw.type) ? raw.type : "clock";
  const rawLabel  = typeof raw.label === "string" ? raw.label : "Widget";
  const safeLabel = rawType === "clock" ? migrateClockLabel(rawLabel) : rawLabel;

  const baseData: Record<string, unknown> =
    raw.data !== null && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};

  const safeData      = migrateWidgetData(rawType, baseData);
  const safeCondition = migrateCondition(raw.condition);
  const safeStack     = migrateStack(raw.stack);

  return {
    id:        typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    type:      rawType,
    position:  safePosition,
    size:      safeSize,
    isVisible: typeof raw.isVisible === "boolean" ? raw.isVisible : true,
    isLocked:  typeof raw.isLocked  === "boolean" ? raw.isLocked  : false,
    label:     safeLabel,
    todoItems: rawTodoItems.map((item) => migrateTodoItem(item as Record<string, unknown>)),
    notes:     rawNotes.map((note) => migrateNote(note as Record<string, unknown>)),
    opacity:   rawOpacity,
    data:      safeData,
    condition:            safeCondition,
    stack:                safeStack,
    alwaysOnTopPerWidget: typeof raw.alwaysOnTopPerWidget === "boolean" ? raw.alwaysOnTopPerWidget : false,
    clickThrough:         typeof raw.clickThrough         === "boolean" ? raw.clickThrough         : false,
    monitorName:          typeof raw.monitorName          === "string"  ? raw.monitorName          : null,
  };
}

// ── parseAppState ──────────────────────────────────────────────────────────
function parseAppState(parsed: Record<string, unknown>): AppState {
  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];
  const widgets: Widget[] = rawWidgets.map((w) =>
    migrateWidget(w as Record<string, unknown>)
  );

  const theme: "dark" | "light" =
    parsed.theme === "light" ? "light" : "dark";

  const accentColor: string =
    typeof parsed.accentColor === "string" && parsed.accentColor.startsWith("#")
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

  const weatherApiKey: string =
    typeof parsed.weatherApiKey === "string" ? parsed.weatherApiKey : "";

  const version: number =
    typeof parsed.version === "number" ? parsed.version : 0;

  return { version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop, weatherApiKey };
}

export async function loadState(): Promise<AppState | null> {
  const fileExists = await exists(STATE_FILE, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return null;
  const raw    = await readTextFile(STATE_FILE, { baseDir: BaseDirectory.AppData });
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return parseAppState(parsed);
}

async function attemptSave(state: AppState): Promise<void> {
  await mkdir(APP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
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

export async function writeLayoutFile(filePath: string, state: AppState): Promise<void> {
  await writeTextFile(filePath, JSON.stringify(state, null, 2));
}

export async function readLayoutFile(filePath: string): Promise<AppState | null> {
  try {
    const json   = await readTextFile(filePath);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parseAppState(parsed);
  } catch {
    return null;
  }
}
