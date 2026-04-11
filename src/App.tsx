// src/App.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  enable as autostartEnable,
  disable as autostartDisable,
} from "@tauri-apps/plugin-autostart";
import DesktopCanvas from "./components/DesktopCanvas";
import SettingsPanel from "./components/SettingsPanel";
import Toast from "./components/Toast";
import OnboardingOverlay from "./components/OnboardingOverlay"; // Step 7-7
import { useAppStore, DEFAULT_WIDGETS, DEFAULT_WIDGET_IDS } from "./store/appStore";
import { loadState, saveState } from "./utils/storage";
import type { TodoItem, Note, Widget } from "./types/widget";

const FONT_SIZE_MAP: Record<"small" | "medium" | "large", string> = {
  small:  "12px",
  medium: "14px",
  large:  "16px",
};

const App: React.FC = () => {
  const widgets              = useAppStore((state) => state.widgets);
  const theme                = useAppStore((state) => state.theme);
  const accentColor          = useAppStore((state) => state.accentColor);
  const fontSize             = useAppStore((state) => state.fontSize);
  const autostart            = useAppStore((state) => state.autostart);
  const alwaysOnTop          = useAppStore((state) => state.alwaysOnTop);
  const version              = useAppStore((state) => state.version);
  const setWidgets           = useAppStore((state) => state.setWidgets);
  const setTheme             = useAppStore((state) => state.setTheme);
  const setAccentColor       = useAppStore((state) => state.setAccentColor);
  const setFontSize          = useAppStore((state) => state.setFontSize);
  const setOpacity           = useAppStore((state) => state.setOpacity);
  const setAlwaysOnTop       = useAppStore((state) => state.setAlwaysOnTop);
  const setAutostart         = useAppStore((state) => state.setAutostart);
  const updateWidget         = useAppStore((state) => state.updateWidget);
  const addWidget            = useAppStore((state) => state.addWidget);
  const removeWidget         = useAppStore((state) => state.removeWidget);
  const updateWidgetPosition = useAppStore((state) => state.updateWidgetPosition);
  const updateWidgetSize     = useAppStore((state) => state.updateWidgetSize);
  const resetLayout          = useAppStore((state) => state.resetLayout);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toastMessage, setToastMessage]           = useState<{ msg: string; id: number } | null>(null);
  const [isLoaded, setIsLoaded]                   = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen]       = useState<boolean>(false);
  const [, setIsFirstRun]                         = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding]       = useState<boolean>(false); // Step 7-7

  // ── LOAD ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      let saved = null;
      try {
        saved = await loadState();
        if (saved === null) {
          // null = ไม่มีไฟล์ = first run → แสดง onboarding ปกติ
          setIsFirstRun(true);
          setShowOnboarding(true);
        }
      } catch (e) {
        // throw = ไฟล์มีอยู่แต่อ่าน/parse ไม่ได้ → แจ้ง user ชัดเจน
        console.error("[App] loadState failed:", e);
        setToastMessage({
          msg: "Save file is corrupted. Starting with default widgets.",
          id: Date.now(),
        });
        // saved ยังเป็น null → แอปใช้ DEFAULT_WIDGETS ต่อได้ปกติ
      }

      if (saved) {
        if (saved.widgets.length > 0) setWidgets(saved.widgets);
        setTheme(saved.theme);
        setAccentColor(saved.accentColor);
        setFontSize(saved.fontSize);
        setAlwaysOnTop(saved.alwaysOnTop);
        setAutostart(saved.autostart);
        if (saved.alwaysOnTop) {
          try {
            await getCurrentWindow().setAlwaysOnTop(true);
          } catch (e) {
            console.error("[App] setAlwaysOnTop on load failed:", e);
          }
        }
      }
      setIsLoaded(true);
    };
    init();
  }, [setWidgets, setTheme, setAccentColor, setFontSize, setAlwaysOnTop, setAutostart]);

  // ── SAVE (Debounced) ─────────────────────────────────────────────────────────
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
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [version, widgets, theme, accentColor, fontSize, autostart, alwaysOnTop, isLoaded]);

  // ── KEYBOARD SHORTCUT ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── HANDLERS ─────────────────────────────────────────────────────────────────
  const handleToastDismiss = useCallback(() => setToastMessage(null), []);

  // Step 7-7: dismiss onboarding — isFirstRun ยังคง true ใน session นี้
  // แต่ครั้งหน้าที่เปิดแอปจะมี state.json แล้ว → isFirstRun = false → ไม่แสดง
  const handleDismissOnboarding = useCallback(() => setShowOnboarding(false), []);

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
      if (!widget) return;
      if (widget.type === "clock") {
        try {
          const parsed = JSON.parse(widget.label) as Record<string, unknown>;
          updateWidget(widgetId, {
            label: JSON.stringify({
              name:   trimmed,
              use24h: parsed.use24h !== false,
              locale: typeof parsed.locale === "string" ? parsed.locale : "th-TH",
            }),
          });
        } catch {
          updateWidget(widgetId, {
            label: JSON.stringify({ name: trimmed, use24h: true, locale: "th-TH" }),
          });
        }
      } else {
        updateWidget(widgetId, { label: trimmed });
      }
    },
    [widgets, updateWidget]
  );

  const handleResetLayout = useCallback(() => resetLayout(), [resetLayout]);

  const handleSizeChange = useCallback(
    (id: string, size: { width: number; height: number }) =>
      updateWidgetSize(id, size),
    [updateWidgetSize]
  );

  const handleClockConfigChange = useCallback(
    (
      widgetId: string,
      changes: { use24h?: boolean; locale?: string; newLabel?: string }
    ) => {
      if (!changes.newLabel) return;
      updateWidget(widgetId, { label: changes.newLabel });
    },
    [updateWidget]
  );

  const handleSetAccentColor = useCallback(
    (color: string) => setAccentColor(color),
    [setAccentColor]
  );

  const handleSetFontSize = useCallback(
    (size: "small" | "medium" | "large") => setFontSize(size),
    [setFontSize]
  );

  const handleSetOpacity = useCallback(
    (widgetId: string, opacity: number) => setOpacity(widgetId, opacity),
    [setOpacity]
  );

  const handleAddWidgetInstance = useCallback(
    (type: "todo" | "notes") => {
      const count      = widgets.filter((w) => w.type === type).length;
      const label      = type === "todo" ? `Tasks ${count + 1}` : `Notes ${count + 1}`;
      const offset     = count * 30;
      const baseWidget = DEFAULT_WIDGETS.find((w) => w.type === type);
      if (!baseWidget) return;
      const newWidget: Widget = {
        ...baseWidget,
        id:        `${type}-${Date.now()}`,
        label,
        todoItems: [],
        notes:     [],
        position:  {
          x: baseWidget.position.x + offset,
          y: baseWidget.position.y + offset,
        },
        opacity: 1,
      };
      addWidget(newWidget);
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
        if (value) {
          await autostartEnable();
        } else {
          await autostartDisable();
        }
        setAutostart(value);
      } catch (e) {
        console.error("[App] autostart failed:", e);
        setToastMessage({ msg: "Failed to update startup setting.", id: Date.now() });
      }
    },
    [setAutostart]
  );

  const handleAddTodo = useCallback(
    (widgetId: string, text: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      const newItem: TodoItem = {
        id:        crypto.randomUUID(),
        text:      text.trim(),
        completed: false,
        createdAt: Date.now(),
      };
      updateWidget(widgetId, { todoItems: [...widget.todoItems, newItem] });
    },
    [widgets, updateWidget]
  );

  const handleToggleTodo = useCallback(
    (widgetId: string, todoId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      const updated = widget.todoItems.map((item) =>
        item.id === todoId ? { ...item, completed: !item.completed } : item
      );
      updateWidget(widgetId, { todoItems: updated });
    },
    [widgets, updateWidget]
  );

  const handleDeleteTodo = useCallback(
    (widgetId: string, todoId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        todoItems: widget.todoItems.filter((item) => item.id !== todoId),
      });
    },
    [widgets, updateWidget]
  );

  const handleClearCompleted = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        todoItems: widget.todoItems.filter((item) => !item.completed),
      });
    },
    [widgets, updateWidget]
  );

  const handleAddNote = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      const newNote: Note = {
        id:        crypto.randomUUID(),
        title:     "Untitled",
        content:   "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updateWidget(widgetId, { notes: [...widget.notes, newNote] });
    },
    [widgets, updateWidget]
  );

  const handleUpdateNote = useCallback(
    (
      widgetId: string,
      noteId: string,
      changes: { title?: string; content?: string }
    ) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      const updated = widget.notes.map((note) =>
        note.id === noteId
          ? { ...note, ...changes, updatedAt: Date.now() }
          : note
      );
      updateWidget(widgetId, { notes: updated });
    },
    [widgets, updateWidget]
  );

  const handleDeleteNote = useCallback(
    (widgetId: string, noteId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        notes: widget.notes.filter((note) => note.id !== noteId),
      });
    },
    [widgets, updateWidget]
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      data-theme={theme}
      style={{
        width:              "100vw",
        height:             "100vh",
        background:         "transparent",
        fontSize:           FONT_SIZE_MAP[fontSize],
        "--accent-color":   accentColor,
        "--font-size-base": FONT_SIZE_MAP[fontSize],
      } as React.CSSProperties}
    >
      <DesktopCanvas
        widgets={widgets}
        onPositionChange={updateWidgetPosition}
        onSizeChange={handleSizeChange}
        onClockConfigChange={handleClockConfigChange}
        onAddTodo={handleAddTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onClearCompleted={handleClearCompleted}
        onAddNote={handleAddNote}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        widgets={widgets}
        theme={theme}
        accentColor={accentColor}
        fontSize={fontSize}
        autostart={autostart}
        alwaysOnTop={alwaysOnTop}
        onClose={() => setIsSettingsOpen(false)}
        onToggleTheme={handleToggleTheme}
        onToggleVisible={handleToggleVisible}
        onToggleLock={handleToggleLock}
        onRenameWidget={handleRenameWidget}
        onResetLayout={handleResetLayout}
        onSetAccentColor={handleSetAccentColor}
        onSetFontSize={handleSetFontSize}
        onSetOpacity={handleSetOpacity}
        onAddWidgetInstance={handleAddWidgetInstance}
        onRemoveWidget={handleRemoveWidget}
        onSetAlwaysOnTop={handleSetAlwaysOnTop}
        onSetAutostart={handleSetAutostart}
      />
      <Toast message={toastMessage?.msg ?? ""} onDismiss={handleToastDismiss} />
      {/* Step 7-7: Onboarding — แสดงเฉพาะ first run */}
      <OnboardingOverlay
        isVisible={showOnboarding}
        onDismiss={handleDismissOnboarding}
      />
    </div>
  );
};

export default App;