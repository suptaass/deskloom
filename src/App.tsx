// src/App.tsx

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  enable as autostartEnable,
  disable as autostartDisable,
} from "@tauri-apps/plugin-autostart";
import DesktopCanvas from "./components/DesktopCanvas";
import type { WidgetCallbacks, ContentCallbacks } from "./components/DesktopCanvas";
import SettingsPanel from "./components/SettingsPanel";
import Toast from "./components/Toast";
import OnboardingOverlay from "./components/OnboardingOverlay";
import { useAppStore, DEFAULT_WIDGET_IDS } from "./store/appStore";
import { loadState, saveState } from "./utils/storage";
import { getRegistryEntry, getAddableEntries, WidgetType } from "./registry/widgetRegistry";

const FONT_SIZE_MAP: Record<"small" | "medium" | "large", string> = {
  small: "12px",
  medium: "14px",
  large: "16px",
};

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
  const setAlwaysOnTop       = useAppStore((state) => state.setAlwaysOnTop);
  const setAutostart         = useAppStore((state) => state.setAutostart);
  const updateWidget         = useAppStore((state) => state.updateWidget);
  const addWidget            = useAppStore((state) => state.addWidget);
  const removeWidget         = useAppStore((state) => state.removeWidget);
  const updateWidgetPosition = useAppStore((state) => state.updateWidgetPosition);
  const updateWidgetSize     = useAppStore((state) => state.updateWidgetSize);
  const resetLayout          = useAppStore((state) => state.resetLayout);
  const toggleFocusMode      = useAppStore((state) => state.toggleFocusMode);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── widgetsRef: ป้องกัน stale closure ใน quick-capture listener ────────────
  // ทำไม: listen() ลงทะเบียน callback ครั้งเดียว ถ้าอ่าน widgets ตรงๆ
  // จะได้ค่า snapshot ตอนลงทะเบียน ไม่ใช่ค่าล่าสุด
  const widgetsRef = useRef(widgets);
  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);

  // updateWidget ref — เหตุผลเดียวกัน
  const updateWidgetRef = useRef(updateWidget);
  useEffect(() => { updateWidgetRef.current = updateWidget; }, [updateWidget]);

  const [toastMessage, setToastMessage]     = useState<{ msg: string; id: number } | null>(null);
  const [isLoaded, setIsLoaded]             = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [, setIsFirstRun]                   = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      let saved = null;
      try {
        saved = await loadState();
        if (saved === null) {
          setIsFirstRun(true);
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error("[App] loadState failed:", e);
        setToastMessage({
          msg: "Save file is corrupted. Starting with default widgets.",
          id: Date.now(),
        });
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
      if (e.ctrlKey && e.code === "Comma") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
      if (e.ctrlKey && e.code === "KeyF") {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  // ── Quick Capture listener ─────────────────────────────────────────────────
  // ลงทะเบียนครั้งเดียว ใช้ ref อ่านค่าล่าสุดเสมอ
  useEffect(() => {
    const unlistenPromise = listen<{ text: string; targetType: "todo" | "notes" }>(
      "quick-capture-submit",
      (event) => {
        const { text, targetType } = event.payload;
        const currentWidgets = widgetsRef.current;

        // หา widget ตัวแรกที่ visible และ type ตรง
        const target = currentWidgets.find(
          (w) => w.type === targetType && w.isVisible
        );

        if (!target) {
          setToastMessage({
            msg: `No visible ${targetType} widget found.`,
            id: Date.now(),
          });
          return;
        }

        if (targetType === "todo") {
          updateWidgetRef.current(target.id, {
            todoItems: [
              ...target.todoItems,
              {
                id:        crypto.randomUUID(),
                text:      text.trim(),
                completed: false,
                createdAt: Date.now(),
              },
            ],
          });
        } else {
          // notes: สร้าง note ใหม่โดยใช้ text เป็นทั้ง title และ content
          updateWidgetRef.current(target.id, {
            notes: [
              ...target.notes,
              {
                id:        crypto.randomUUID(),
                title:     text.trim().slice(0, 50),
                content:   text.trim(),
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          });
        }

        setToastMessage({
          msg: `✓ Added to ${target.label}`,
          id: Date.now(),
        });
      }
    );

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []); // [] — ลงทะเบียนครั้งเดียว ใช้ ref แทน

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToastDismiss      = useCallback(() => setToastMessage(null), []);
  const handleDismissOnboarding = useCallback(() => setShowOnboarding(false), []);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
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

  const handleClockConfigChange = useCallback(
    (widgetId: string, changes: { use24h?: boolean; locale?: string; newLabel?: string }) => {
      if (!changes.newLabel) return;
      updateWidget(widgetId, { label: changes.newLabel });
    },
    [updateWidget]
  );

  const handleSetOpacity = useCallback(
    (widgetId: string, opacity: number) => setOpacity(widgetId, opacity),
    [setOpacity]
  );

  const handleAddWidgetInstance = useCallback(
    (type: WidgetType) => {
      const entry = getRegistryEntry(type);
      if (entry.isProtected) return;
      const count  = widgets.filter((w) => w.type === type).length;
      const offset = count * 30;
      addWidget({
        id:        `${type}-${Date.now()}`,
        type,
        label:     entry.makeDefaultLabel(count + 1),
        position: {
          x: entry.defaultPosition.x + offset,
          y: entry.defaultPosition.y + offset,
        },
        size:      { ...entry.defaultSize },
        isVisible: true,
        isLocked:  false,
        todoItems: [],
        notes:     [],
        opacity:   1,
        data:      { ...entry.defaultData },
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
        if (value) { await autostartEnable(); }
        else       { await autostartDisable(); }
        setAutostart(value);
      } catch (e) {
        console.error("[App] autostart failed:", e);
        setToastMessage({ msg: "Failed to update startup setting.", id: Date.now() });
      }
    },
    [setAutostart]
  );

  // ── Todo handlers ──────────────────────────────────────────────────────────
  const handleAddTodo = useCallback(
    (widgetId: string, text: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        todoItems: [...widget.todoItems, {
          id: crypto.randomUUID(), text: text.trim(),
          completed: false, createdAt: Date.now(),
        }],
      });
    },
    [widgets, updateWidget]
  );

  const handleToggleTodo = useCallback(
    (widgetId: string, todoId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        todoItems: widget.todoItems.map((item) =>
          item.id === todoId ? { ...item, completed: !item.completed } : item
        ),
      });
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

  // ── Note handlers ──────────────────────────────────────────────────────────
  const handleAddNote = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        notes: [...widget.notes, {
          id: crypto.randomUUID(), title: "Untitled",
          content: "", createdAt: Date.now(), updatedAt: Date.now(),
        }],
      });
    },
    [widgets, updateWidget]
  );

  const handleUpdateNote = useCallback(
    (widgetId: string, noteId: string, changes: { title?: string; content?: string }) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      updateWidget(widgetId, {
        notes: widget.notes.map((note) =>
          note.id === noteId ? { ...note, ...changes, updatedAt: Date.now() } : note
        ),
      });
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

  const handleUpdateWidgetData = useCallback(
    (widgetId: string, data: Record<string, unknown>) => {
      updateWidget(widgetId, { data });
    },
    [updateWidget]
  );

  // ── Memoized callback objects ──────────────────────────────────────────────
  const widgetCallbacks = useMemo<WidgetCallbacks>(
    () => ({
      onPositionChange:    updateWidgetPosition,
      onSizeChange:        updateWidgetSize,
      onClockConfigChange: handleClockConfigChange,
    }),
    [updateWidgetPosition, updateWidgetSize, handleClockConfigChange]
  );

  const contentCallbacks = useMemo<ContentCallbacks>(
    () => ({
      onAddTodo:          handleAddTodo,
      onToggleTodo:       handleToggleTodo,
      onDeleteTodo:       handleDeleteTodo,
      onClearCompleted:   handleClearCompleted,
      onAddNote:          handleAddNote,
      onUpdateNote:       handleUpdateNote,
      onDeleteNote:       handleDeleteNote,
      onUpdateWidgetData: handleUpdateWidgetData,
    }),
    [
      handleAddTodo, handleToggleTodo, handleDeleteTodo, handleClearCompleted,
      handleAddNote, handleUpdateNote, handleDeleteNote, handleUpdateWidgetData,
    ]
  );

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
        <button
          className="gear-button"
          onClick={handleToggleSettings}
          title="Settings (Ctrl+,)"
          aria-label="Open Settings"
        >
          ⚙
        </button>
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

      <DesktopCanvas
        widgets={widgets}
        widgetCallbacks={widgetCallbacks}
        contentCallbacks={contentCallbacks}
        isFocusMode={isFocusMode}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        widgets={widgets}
        theme={theme}
        accentColor={accentColor}
        fontSize={fontSize}
        autostart={autostart}
        alwaysOnTop={alwaysOnTop}
        addableEntries={addableEntries}
        onClose={() => setIsSettingsOpen(false)}
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
      />
      <Toast message={toastMessage?.msg ?? ""} onDismiss={handleToastDismiss} />
      <OnboardingOverlay
        isVisible={showOnboarding}
        onDismiss={handleDismissOnboarding}
      />
    </div>
  );
};

export default App;