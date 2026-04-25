// src/App.tsx

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { save as dialogSave, open as dialogOpen } from "@tauri-apps/plugin-dialog";
import {
  enable as autostartEnable,
  disable as autostartDisable,
} from "@tauri-apps/plugin-autostart";
import SettingsPanel from "./components/SettingsPanel";
import Toast from "./components/Toast";
import OnboardingOverlay from "./components/OnboardingOverlay";
import { useWidgetWindowSync } from "./hooks/useWidgetWindowSync";
import { useAppStore, DEFAULT_WIDGET_IDS } from "./store/appStore";
import { loadState, saveState, writeLayoutFile, readLayoutFile } from "./utils/storage";
import { checkCondition } from "./utils/condition";
import { getRegistryEntry, getAddableEntries, WidgetType } from "./registry/widgetRegistry";
import { Widget, WidgetCondition } from "./types/widget";
import { useLicenseStore } from "./store/licenseStore";

const FONT_SIZE_MAP: Record<"small" | "medium" | "large", string> = {
  small: "12px",
  medium: "14px",
  large: "16px",
};

function normalizeStackOrders(stackWidgets: Widget[]): Widget[] {
  return [...stackWidgets]
    .sort((a, b) => a.stack.stackOrder - b.stack.stackOrder)
    .map((widget, index) => ({
      ...widget,
      stack: { ...widget.stack, stackOrder: index },
    }));
}

function parseShortcutKey(e: KeyboardEvent): string | null {
  if (!e.ctrlKey && !e.altKey && !e.shiftKey) return null;
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey)  parts.push("Ctrl");
  if (e.altKey)   parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.toUpperCase());
  return parts.join("+");
}

// ── getDisplayLabel ────────────────────────────────────────────────────────
// ทำไม: Clock widget เก็บ label เป็น JSON → ต้อง parse ก่อนแสดงผล
// ใช้ใน toast message ของ widget shortcut
function getDisplayLabel(widget: Widget): string {
  if (widget.type === "clock") {
    try {
      const parsed = JSON.parse(widget.label) as { name?: string };
      return parsed.name ?? widget.label;
    } catch {
      return widget.label;
    }
  }
  return widget.label;
}

const App: React.FC = () => {
  const widgets              = useAppStore((state) => state.widgets);
  const theme                = useAppStore((state) => state.theme);
  const accentColor          = useAppStore((state) => state.accentColor);
  const fontSize             = useAppStore((state) => state.fontSize);
  const autostart            = useAppStore((state) => state.autostart);
  const alwaysOnTop          = useAppStore((state) => state.alwaysOnTop);
  const version              = useAppStore((state) => state.version);
  const isFocusMode          = useAppStore((state) => state.isFocusMode);
  const setWidgets           = useAppStore((state) => state.setWidgets);
  const setTheme             = useAppStore((state) => state.setTheme);
  const setAccentColor       = useAppStore((state) => state.setAccentColor);
  const setFontSize          = useAppStore((state) => state.setFontSize);
  const setOpacity           = useAppStore((state) => state.setOpacity);
  const setClickThrough      = useAppStore((state) => state.setClickThrough);
  const setWidgetMonitor     = useAppStore((state) => state.setWidgetMonitor);
  const setAlwaysOnTop       = useAppStore((state) => state.setAlwaysOnTop);
  const setAutostart         = useAppStore((state) => state.setAutostart);
  const updateWidget         = useAppStore((state) => state.updateWidget);
  const addWidget            = useAppStore((state) => state.addWidget);
  const removeWidget         = useAppStore((state) => state.removeWidget);
  const updateWidgetPosition = useAppStore((state) => state.updateWidgetPosition);
  const updateWidgetSize     = useAppStore((state) => state.updateWidgetSize);
  const resetLayout          = useAppStore((state) => state.resetLayout);
  const toggleFocusMode      = useAppStore((state) => state.toggleFocusMode);

  const loadLicenseFromDisk = useLicenseStore((s) => s.loadFromDisk);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const widgetsRef = useRef(widgets);
  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
  const updateWidgetRef = useRef(updateWidget);
  useEffect(() => { updateWidgetRef.current = updateWidget; }, [updateWidget]);

  const [toastMessage, setToastMessage]     = useState<{ msg: string; id: number } | null>(null);
  const [isLoaded, setIsLoaded]             = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [, setIsFirstRun]                   = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // ── currentMinute — re-compute condition ทุก 60 วินาที ────────────────────
  const [currentMinute, setCurrentMinute] = useState<number>(() =>
    Math.floor(Date.now() / 60_000)
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinute(Math.floor(Date.now() / 60_000));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await loadLicenseFromDisk();

      let saved = null;
      try {
        saved = await loadState();
        if (saved === null) { setIsFirstRun(true); setShowOnboarding(true); }
      } catch (e) {
        console.error("[App] loadState failed:", e);
        setToastMessage({ msg: "Save file is corrupted. Starting with default widgets.", id: Date.now() });
      }
      if (saved) {
        if (saved.widgets.length > 0) setWidgets(saved.widgets);
        setTheme(saved.theme);
        setAccentColor(saved.accentColor);
        setFontSize(saved.fontSize);
        setAlwaysOnTop(saved.alwaysOnTop);
        setAutostart(saved.autostart);
        if (saved.alwaysOnTop) {
          try { await getCurrentWindow().setAlwaysOnTop(true); }
          catch (e) { console.error("[App] setAlwaysOnTop on load failed:", e); }
        }
      }
      setIsLoaded(true);
    };
    init();
  }, [setWidgets, setTheme, setAccentColor, setFontSize, setAlwaysOnTop, setAutostart, loadLicenseFromDisk]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveState({ version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop });
      } catch (error) {
        console.error("[App] saveState failed:", error);
        setToastMessage({ msg: "Failed to save data. Please check app permissions.", id: Date.now() });
      }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop, isLoaded]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ── App-level shortcuts — ทำงานเสมอ ───────────────────────────────────
      if (e.ctrlKey && e.code === "Comma") { e.preventDefault(); setIsSettingsOpen((prev) => !prev); return; }
      if (e.ctrlKey && e.code === "KeyF")  { e.preventDefault(); toggleFocusMode(); return; }

      // ── Widget shortcuts ───────────────────────────────────────────────────
      // ทำไมลบ isSettingsOpen guard ออก:
      // user อาจกด Hidden ใน Settings แล้วทดสอบ shortcut ทันทีโดยไม่ปิด Settings
      // guard เดิมทำให้ shortcut ไม่ทำงาน → user งง
      // แทนที่ด้วยการเช็ค tagName เพื่อป้องกัน conflict กับ input fields เท่านั้น
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT"    ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) return;

      const pressed = parseShortcutKey(e);
      if (!pressed) return;

      const matched = widgetsRef.current.find(
        (w) => typeof w.data.shortcut === "string" && w.data.shortcut === pressed
      );
      if (!matched) return;

      e.preventDefault();

      // ถ้า widget ซ่อนอยู่ → แสดงขึ้นมา
      if (!matched.isVisible) {
        updateWidgetRef.current(matched.id, { isVisible: true });
      }

      // ใช้ getDisplayLabel แทน matched.label โดยตรง
      // ทำไม: Clock widget เก็บ label เป็น JSON string
      setToastMessage({ msg: `⌨ ${getDisplayLabel(matched)}`, id: Date.now() });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // ลบ isSettingsOpen ออกจาก dependency — ไม่ใช้แล้วใน handler
  }, [toggleFocusMode]);

  // ── Tray events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unlistenPromise = listen("tray-open-settings", () => {
      setIsSettingsOpen(true);
    });
    return () => { unlistenPromise.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen("tray-toggle-focus", () => {
      toggleFocusMode();
    });
    return () => { unlistenPromise.then((fn) => fn()); };
  }, [toggleFocusMode]);

  // ── Quick Capture listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unlistenPromise = listen<{ text: string; targetType: "todo" | "notes" }>(
      "quick-capture-submit",
      (event) => {
        const { text, targetType } = event.payload;
        const currentWidgets = widgetsRef.current;
        const target = currentWidgets.find((w) => w.type === targetType && w.isVisible);
        if (!target) {
          setToastMessage({ msg: `No visible ${targetType} widget found.`, id: Date.now() });
          return;
        }
        if (targetType === "todo") {
          updateWidgetRef.current(target.id, {
            todoItems: [...target.todoItems, { id: crypto.randomUUID(), text: text.trim(), completed: false, createdAt: Date.now() }],
          });
        } else {
          updateWidgetRef.current(target.id, {
            notes: [...target.notes, { id: crypto.randomUUID(), title: text.trim().slice(0, 50), content: text.trim(), createdAt: Date.now(), updatedAt: Date.now() }],
          });
        }
        setToastMessage({ msg: `✓ Added to ${target.label}`, id: Date.now() });
      }
    );
    return () => { unlistenPromise.then((fn) => fn()); };
  }, []);

  // ── displayWidgets — apply condition filter ────────────────────────────────
  const displayWidgets = useMemo(() => {
    return widgets.map((w) => {
      if (!w.condition?.enabled) return w;
      const conditionMet = checkCondition(w.condition);
      if (conditionMet) return w;
      return { ...w, isVisible: false };
    });
  }, [widgets, currentMinute]); // eslint-disable-line react-hooks/exhaustive-deps

  const { createWidgetWindow, destroyWidgetWindow } = useWidgetWindowSync(
    displayWidgets,
    theme,
    accentColor,
    fontSize,
    alwaysOnTop,
    {
      onPositionChange: updateWidgetPosition,
      onSizeChange:     updateWidgetSize,
      onDataChange:     (id, changes) => updateWidget(id, changes),
      onMonitorChange:  setWidgetMonitor,
    },
    isLoaded
  );

  useEffect(() => {
    if (!isLoaded) return;

    displayWidgets
      .filter((w) => w.isVisible)
      .forEach((w) => { void createWidgetWindow(w); });

    return () => {
      displayWidgets.forEach((w) => { void destroyWidgetWindow(w.id); });
    };
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToastDismiss      = useCallback(() => setToastMessage(null), []);
  const handleDismissOnboarding = useCallback(() => setShowOnboarding(false), []);
  const handleToggleSettings    = useCallback(() => setIsSettingsOpen((prev) => !prev), []);

  const handleCloseSettings = useCallback(async () => {
    setIsSettingsOpen(false);
    try { await getCurrentWindow().hide(); } catch { /* ignore */ }
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const handleToggleVisible = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, { isVisible: !widget.isVisible });
    },
    [widgets, updateWidget]
  );

  const handleToggleLock = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, { isLocked: !widget.isLocked });
    },
    [widgets, updateWidget]
  );

  const handleRenameWidget = useCallback(
    (widgetId: string, newLabel: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      const trimmed = newLabel.trim();
      if (widget.type === "clock") {
        try {
          const parsed = JSON.parse(widget.label) as Record<string, unknown>;
          updateWidget(widgetId, { label: JSON.stringify({ name: trimmed, use24h: parsed.use24h !== false, locale: typeof parsed.locale === "string" ? parsed.locale : "th-TH" }) });
        } catch {
          updateWidget(widgetId, { label: JSON.stringify({ name: trimmed, use24h: true, locale: "th-TH" }) });
        }
      } else {
        updateWidget(widgetId, { label: trimmed });
      }
    },
    [widgets, updateWidget]
  );

  const handleResetLayout = useCallback(() => resetLayout(), [resetLayout]);

  const handleSetOpacity = useCallback(
    (widgetId: string, opacity: number) => setOpacity(widgetId, opacity),
    [setOpacity]
  );

  const handleSetClickThrough = useCallback(
    (widgetId: string, value: boolean) => setClickThrough(widgetId, value),
    [setClickThrough]
  );

  const handleAddWidgetInstance = useCallback(
    (type: WidgetType) => {
      const entry = getRegistryEntry(type);
      if (entry.isProtected) return;
      const count  = widgets.filter((w) => w.type === type).length;
      const offset = count * 30;
      addWidget({
        id: `${type}-${Date.now()}`, type,
        label: entry.makeDefaultLabel(count + 1),
        position: { x: entry.defaultPosition.x + offset, y: entry.defaultPosition.y + offset },
        size: { ...entry.defaultSize },
        isVisible: true, isLocked: false, todoItems: [], notes: [], opacity: 1,
        data: { ...entry.defaultData },
        condition:            null,
        stack:                { stackId: null, stackOrder: 0 },
        alwaysOnTopPerWidget: false,
        clickThrough:         false,
        monitorName:          null,
      });
    },
    [widgets, addWidget]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      if (DEFAULT_WIDGET_IDS.includes(widgetId)) return;
      removeWidget(widgetId);
    },
    [removeWidget]
  );

  const handleSetAlwaysOnTop = useCallback(
    async (value: boolean) => {
      try {
        await getCurrentWindow().setAlwaysOnTop(value);
        setAlwaysOnTop(value);
      } catch (e) {
        console.error("[App] setAlwaysOnTop failed:", e);
        setToastMessage({ msg: "Failed to set Always on Top.", id: Date.now() });
      }
    },
    [setAlwaysOnTop]
  );

  const handleSetAutostart = useCallback(
    async (value: boolean) => {
      try {
        if (value) { await autostartEnable(); } else { await autostartDisable(); }
        setAutostart(value);
      } catch (e) {
        console.error("[App] autostart failed:", e);
        setToastMessage({ msg: "Failed to update startup setting.", id: Date.now() });
      }
    },
    [setAutostart]
  );

  const handleSetWidgetCondition = useCallback(
    (widgetId: string, condition: WidgetCondition | null) => {
      updateWidget(widgetId, { condition });
    },
    [updateWidget]
  );

  const handleSetWidgetShortcut = useCallback(
    (widgetId: string, shortcut: string | null) => {
      if (shortcut !== null) {
        const conflict = widgets.find(
          (w) => w.id !== widgetId && w.data.shortcut === shortcut
        );
        if (conflict) {
          setToastMessage({
            msg: `"${shortcut}" already used by "${getDisplayLabel(conflict)}". Choose another.`,
            id: Date.now(),
          });
          return false;
        }
      }

      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return false;

      const newData = { ...widget.data };
      if (shortcut === null) {
        delete newData.shortcut;
      } else {
        newData.shortcut = shortcut;
      }
      updateWidget(widgetId, { data: newData });
      return true;
    },
    [widgets, updateWidget]
  );

  const handleCreateWidgetStack = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget || widget.stack.stackId) return;

      updateWidget(widgetId, {
        stack: {
          stackId: `stack-${crypto.randomUUID()}`,
          stackOrder: 0,
        },
      });
    },
    [widgets, updateWidget]
  );

  const handleAddWidgetToStack = useCallback(
    (widgetId: string, targetStackId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      const targetWidgets = widgets.filter((w) => w.stack.stackId === targetStackId);
      if (!widget || widget.stack.stackId === targetStackId || targetWidgets.length === 0) return;

      const normalized = normalizeStackOrders(targetWidgets);
      const anchor = normalized[0];

      normalized.forEach((stackWidget) => {
        updateWidget(stackWidget.id, { stack: stackWidget.stack });
      });

      updateWidget(widgetId, {
        position: { ...anchor.position },
        size: { ...anchor.size },
        stack: {
          stackId: targetStackId,
          stackOrder: normalized.length,
        },
      });
    },
    [widgets, updateWidget]
  );

  const handleRemoveWidgetFromStack = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget?.stack.stackId) return;

      const remaining = widgets.filter(
        (w) => w.stack.stackId === widget.stack.stackId && w.id !== widgetId
      );

      normalizeStackOrders(remaining).forEach((stackWidget) => {
        updateWidget(stackWidget.id, { stack: stackWidget.stack });
      });

      updateWidget(widgetId, {
        stack: { stackId: null, stackOrder: 0 },
      });
    },
    [widgets, updateWidget]
  );

  // ── Export / Import Layout ─────────────────────────────────────────────────
  const handleExportLayout = useCallback(async () => {
    try {
      const filePath = await dialogSave({
        defaultPath: "deskloom-layout.deskloom",
        filters: [{ name: "DeskLoom Layout", extensions: ["deskloom"] }],
      });
      if (!filePath) return;
      await writeLayoutFile(filePath, { version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop });
      setToastMessage({ msg: "✓ Layout exported", id: Date.now() });
    } catch (e) {
      console.error("[App] exportLayout failed:", e);
      setToastMessage({ msg: "Failed to export layout.", id: Date.now() });
    }
  }, [version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop]);

  const handleImportLayout = useCallback(async () => {
    try {
      const filePath = await dialogOpen({
        multiple: false,
        filters: [{ name: "DeskLoom Layout", extensions: ["deskloom"] }],
      });
      if (!filePath || typeof filePath !== "string") return;
      const imported = await readLayoutFile(filePath);
      if (!imported) {
        setToastMessage({ msg: "Invalid layout file. Please check the file.", id: Date.now() });
        return;
      }
      setWidgets(imported.widgets);
      setTheme(imported.theme);
      setAccentColor(imported.accentColor);
      setFontSize(imported.fontSize);
      setAlwaysOnTop(imported.alwaysOnTop);
      setToastMessage({ msg: "✓ Layout imported successfully", id: Date.now() });
    } catch (e) {
      console.error("[App] importLayout failed:", e);
      setToastMessage({ msg: "Failed to import layout. File may be corrupted.", id: Date.now() });
    }
  }, [setWidgets, setTheme, setAccentColor, setFontSize, setAlwaysOnTop]);

  const addableEntries = useMemo(() => getAddableEntries(), []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-theme={theme}
      style={{
        width: "100vw", height: "100vh",
        background: "transparent",
        fontSize: FONT_SIZE_MAP[fontSize],
        "--accent-color":   accentColor,
        "--font-size-base": FONT_SIZE_MAP[fontSize],
      } as React.CSSProperties}
    >
      {!isSettingsOpen && (
        <button className="gear-button" onClick={handleToggleSettings} title="Settings (Ctrl+,)" aria-label="Open Settings">⚙</button>
      )}
      {!isSettingsOpen && (
        <button
          className={`focus-btn${isFocusMode ? " focus-btn--active" : ""}`}
          onClick={toggleFocusMode}
          title={isFocusMode ? "Exit Focus Mode (Ctrl+F)" : "Focus Mode (Ctrl+F)"}
          aria-label={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
        >
          {isFocusMode ? "◎" : "○"}
        </button>
      )}
      <SettingsPanel
        isOpen={isSettingsOpen}
        widgets={widgets}
        theme={theme}
        accentColor={accentColor}
        fontSize={fontSize}
        autostart={autostart}
        alwaysOnTop={alwaysOnTop}
        addableEntries={addableEntries}
        onClose={handleCloseSettings}
        onToggleTheme={handleToggleTheme}
        onToggleVisible={handleToggleVisible}
        onToggleLock={handleToggleLock}
        onRenameWidget={handleRenameWidget}
        onResetLayout={handleResetLayout}
        onSetAccentColor={setAccentColor}
        onSetFontSize={setFontSize}
        onSetOpacity={handleSetOpacity}
        onAddWidgetInstance={handleAddWidgetInstance}
        onRemoveWidget={handleRemoveWidget}
        onSetAlwaysOnTop={handleSetAlwaysOnTop}
        onSetAutostart={handleSetAutostart}
        onExportLayout={handleExportLayout}
        onImportLayout={handleImportLayout}
        onSetWidgetCondition={handleSetWidgetCondition}
        onSetWidgetShortcut={handleSetWidgetShortcut}
        onCreateWidgetStack={handleCreateWidgetStack}
        onAddWidgetToStack={handleAddWidgetToStack}
        onRemoveWidgetFromStack={handleRemoveWidgetFromStack}
        onSetClickThrough={handleSetClickThrough}
      />
      <Toast message={toastMessage?.msg ?? ""} onDismiss={handleToastDismiss} />
      <OnboardingOverlay isVisible={showOnboarding} onDismiss={handleDismissOnboarding} />
    </div>
  );
};

export default App;
