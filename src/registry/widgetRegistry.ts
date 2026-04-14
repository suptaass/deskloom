// src/registry/widgetRegistry.ts

export const VALID_WIDGET_TYPES = [
  "clock",
  "todo",
  "notes",
  "quicklinks",
  "calendar",
  "weather",
  "pomodoro",
  "habittracker",
] as const;

export type WidgetType = (typeof VALID_WIDGET_TYPES)[number];

export interface WidgetRegistryEntry {
  type: WidgetType;
  displayName: string;
  icon: string;
  defaultSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };
  defaultData: Record<string, unknown>;
  makeDefaultLabel: (count: number) => string;
  /** ถ้า true = ลบไม่ได้ และไม่แสดงปุ่ม + Add ใน SettingsPanel */
  isProtected: boolean;
}

export const WIDGET_REGISTRY: WidgetRegistryEntry[] = [
  {
    type: "clock",
    displayName: "Clock",
    icon: "🕐",
    defaultSize: { width: 280, height: 180 },
    defaultPosition: { x: 50, y: 50 },
    defaultData: {},
    makeDefaultLabel: () =>
      JSON.stringify({ name: "Clock", use24h: true, locale: "th-TH" }),
    isProtected: true,
  },
  {
    type: "todo",
    displayName: "Todo",
    icon: "✅",
    defaultSize: { width: 260, height: 320 },
    defaultPosition: { x: 380, y: 50 },
    defaultData: {},
    makeDefaultLabel: (count) => `Tasks ${count}`,
    isProtected: false,
  },
  {
    type: "notes",
    displayName: "Notes",
    icon: "📝",
    defaultSize: { width: 260, height: 320 },
    defaultPosition: { x: 690, y: 50 },
    defaultData: {},
    makeDefaultLabel: (count) => `Notes ${count}`,
    isProtected: false,
  },
  {
    type: "quicklinks",
    displayName: "Quick Links",
    icon: "🔗",
    defaultSize: { width: 220, height: 280 },
    defaultPosition: { x: 50, y: 280 },
    defaultData: { links: [] },
    makeDefaultLabel: (count) => `Quick Links ${count}`,
    isProtected: false,
  },
  {
    type: "calendar",
    displayName: "Calendar",
    icon: "📅",
    defaultSize: { width: 240, height: 260 },
    defaultPosition: { x: 320, y: 280 },
    defaultData: {},
    makeDefaultLabel: (count) => `Calendar ${count}`,
    isProtected: false,
  },
  {
    type: "weather",
    displayName: "Weather",
    icon: "🌤",
    defaultSize: { width: 260, height: 260 },
    defaultPosition: { x: 590, y: 280 },
    defaultData: {},
    makeDefaultLabel: (count) => `Weather ${count}`,
    isProtected: false,
  },
  {
    type: "pomodoro",
    displayName: "Pomodoro",
    icon: "🍅",
    defaultSize: { width: 220, height: 260 },
    defaultPosition: { x: 50, y: 400 },
    defaultData: { workMinutes: 25, breakMinutes: 5 },
    makeDefaultLabel: (count) => `Pomodoro ${count}`,
    isProtected: false,
  },
  {
    type: "habittracker",
    displayName: "Habit Tracker",
    icon: "🔥",
    defaultSize: { width: 260, height: 360 },
    defaultPosition: { x: 320, y: 400 },
    defaultData: { habits: [] },
    makeDefaultLabel: (count) => `Habits ${count}`,
    isProtected: false,
  },
];

// ── Helper functions ───────────────────────────────────────────────────────

export function getRegistryEntry(type: WidgetType): WidgetRegistryEntry {
  const entry = WIDGET_REGISTRY.find((e) => e.type === type);
  if (!entry) throw new Error(`[widgetRegistry] Unknown widget type: ${type}`);
  return entry;
}

export function getAddableEntries(): WidgetRegistryEntry[] {
  return WIDGET_REGISTRY.filter((e) => !e.isProtected);
}

export function isValidWidgetType(value: unknown): value is WidgetType {
  return (VALID_WIDGET_TYPES as readonly string[]).includes(value as string);
}