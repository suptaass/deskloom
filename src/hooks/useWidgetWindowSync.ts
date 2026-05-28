import { useEffect, useRef, useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors } from "@tauri-apps/api/window";
import { emitTo, listen } from "@tauri-apps/api/event";
import { Widget } from "../types/widget";
import type { WidgetStatePayload } from "../components/WidgetWindow";

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

interface SyncCallbacks {
  onPositionChange: (id: string, pos: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onDataChange: (id: string, changes: Partial<Widget>) => void;
  onMonitorChange: (id: string, name: string | null) => void;
  onStackSwitch: (stackId: string, targetWidgetId: string) => void;
}

export function useWidgetWindowSync(
  widgets: Widget[],
  theme: "dark" | "light",
  accentColor: string,
  fontSize: "small" | "medium" | "large",
  alwaysOnTop: boolean,
  callbacks: SyncCallbacks,
  enabled: boolean
) {
  const windowRegistry      = useRef<Map<string, WebviewWindow>>(new Map());
  const moveUnlistenersRef  = useRef<Map<string, () => void>>(new Map());
  const widgetsRef          = useRef(widgets);
  const prevWidgetIdsRef    = useRef<Set<string>>(new Set());
  const callbacksRef        = useRef(callbacks);
  const prevAlwaysOnTopRef  = useRef<Map<string, boolean>>(new Map());
  const prevClickThroughRef = useRef<Map<string, boolean>>(new Map());
  // ── Visibility tracking — ตรวจ isVisible เปลี่ยนแล้ว show/hide window ────
  // prevVisibilityRef จะ undefined ตอน push ครั้งแรก (WidgetWindow handle show เอง)
  // หลังจากนั้น เปรียบเทียบค่าก่อนหน้าและ call win.hide()/win.show() เมื่อเปลี่ยน
  const prevVisibilityRef   = useRef<Map<string, boolean>>(new Map());

  useEffect(() => { widgetsRef.current   = widgets;   }, [widgets]);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  const pushState = useCallback(async (widget: Widget) => {
    const label = `widget-${widget.id}`;

    // รวม widget อื่นๆ ใน stack เดียวกัน เพื่อให้ WidgetWindow แสดง tab bar
    const stackSiblings = widget.stack.stackId
      ? widgetsRef.current
          .filter((w) => w.stack.stackId === widget.stack.stackId && w.id !== widget.id)
          .map((w) => ({ id: w.id, label: getDisplayLabel(w), stackOrder: w.stack.stackOrder }))
      : [];

    const payload: WidgetStatePayload = {
      widget,
      theme,
      accentColor,
      fontSize,
      globalAlwaysOnTop: alwaysOnTop,
      stackSiblings,
    };

    try {
      await emitTo(label, "widget:state", payload);
      const win = windowRegistry.current.get(label);
      if (win) {
        try {
          const newClickThrough = widget.clickThrough ?? false;
          if (prevClickThroughRef.current.get(label) !== newClickThrough) {
            await win.setIgnoreCursorEvents(newClickThrough);
            prevClickThroughRef.current.set(label, newClickThrough);
          }
          const newAlwaysOnTop = widget.alwaysOnTopPerWidget || alwaysOnTop;
          if (prevAlwaysOnTopRef.current.get(label) !== newAlwaysOnTop) {
            await win.setAlwaysOnTop(newAlwaysOnTop);
            prevAlwaysOnTopRef.current.set(label, newAlwaysOnTop);
          }
          // ── Visibility: hide/show window เมื่อ isVisible เปลี่ยน ─────────────
          // ครั้งแรก (prevVisible = undefined): WidgetWindow handle show เอง
          // ครั้งถัดไป: เราควบคุม — prevVisible เปลี่ยน → call win.hide()/win.show()
          const nowVisible = widget.isVisible;
          if (nowVisible) await win.show();
          prevVisibilityRef.current.set(label, nowVisible);
        } catch {
          // ignore
        }
      }
    } catch {
      // Ignore missing or already-destroyed windows.
    }
  }, [theme, accentColor, fontSize, alwaysOnTop]);

  const createWidgetWindow = useCallback(async (widget: Widget) => {
    const label = `widget-${widget.id}`;
    if (windowRegistry.current.has(label)) return;

    let startX = widget.position.x;
    let startY = widget.position.y;

    // ถ้า widget จำ monitor ไว้ ตรวจสอบว่ายังมีอยู่ไหม — fallback ถ้าหาย
    if (widget.monitorName) {
      try {
        const monitors = await availableMonitors();
        const saved = monitors.find((m) => m.name === widget.monitorName);
        if (!saved) {
          startX = 100;
          startY = 100;
        }
      } catch {
        // ignore — ใช้ position เดิมถ้า availableMonitors fail
      }
    }

    const win = new WebviewWindow(label, {
      url: "/",
      decorations: false,
      transparent: true,
      width:       widget.size.width,
      height:      widget.size.height,
      x:           startX,
      y:           startY,
      alwaysOnTop: widget.alwaysOnTopPerWidget || alwaysOnTop,
      skipTaskbar: true,
      resizable:   false,
      shadow:      false,
      visible:     false,
    });

    windowRegistry.current.set(label, win);

    win.once("tauri://created", () => {
      void pushState(widget);
    });

    // ดัก tauri://move เพื่อ detect monitor — debounce 400ms
    // tauri://move ยิงทุก pixel ดังนั้นต้องรอ drag หยุดก่อนค่อยเรียก availableMonitors()
    let monitorDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    win.listen("tauri://move", (event) => {
      const { x, y } = event.payload as { x: number; y: number };
      if (monitorDebounceTimer) clearTimeout(monitorDebounceTimer);
      monitorDebounceTimer = setTimeout(async () => {
        try {
          const monitors = await availableMonitors();
          const monitor  = monitors.find(
            (m) =>
              x >= m.position.x &&
              x <  m.position.x + m.size.width &&
              y >= m.position.y &&
              y <  m.position.y + m.size.height
          );
          callbacksRef.current.onMonitorChange(widget.id, monitor?.name ?? null);
        } catch {
          // ignore
        }
      }, 400);
    }).then((unlisten) => {
      moveUnlistenersRef.current.set(label, unlisten);
    }).catch(() => {
      // ignore ถ้า window ถูก destroy ก่อน listener register เสร็จ
    });
  }, [alwaysOnTop, pushState]);

  const destroyWidgetWindow = useCallback(async (widgetId: string) => {
    const label = `widget-${widgetId}`;
    const win   = windowRegistry.current.get(label);
    if (!win) return;

    const unlistenMove = moveUnlistenersRef.current.get(label);
    if (unlistenMove) {
      unlistenMove();
      moveUnlistenersRef.current.delete(label);
    }

    try {
      await win.destroy();
    } catch {
      // Ignore destroy failures for already-closed windows.
    }

    windowRegistry.current.delete(label);
    prevAlwaysOnTopRef.current.delete(label);
    prevClickThroughRef.current.delete(label);
    prevVisibilityRef.current.delete(label);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unlisteners: Array<Promise<() => void>> = [];

    unlisteners.push(listen<{ widgetId: string }>("widget:request-state", (event) => {
      const widget = widgetsRef.current.find((item) => item.id === event.payload.widgetId);
      if (widget) void pushState(widget);
    }));

    unlisteners.push(listen<{ id: string; x: number; y: number }>("widget:position-change", (event) => {
      callbacksRef.current.onPositionChange(event.payload.id, { x: event.payload.x, y: event.payload.y });
    }));

    unlisteners.push(listen<{ id: string; width: number; height: number }>("widget:size-change", (event) => {
      callbacksRef.current.onSizeChange(event.payload.id, {
        width:  event.payload.width,
        height: event.payload.height,
      });
    }));

    unlisteners.push(listen<{ id: string; changes: Partial<Widget> }>("widget:data-change", (event) => {
      callbacksRef.current.onDataChange(event.payload.id, event.payload.changes);
    }));

    unlisteners.push(listen<{ stackId: string; targetWidgetId: string }>("widget:stack-switch", (event) => {
      callbacksRef.current.onStackSwitch(event.payload.stackId, event.payload.targetWidgetId);
    }));

    return () => {
      unlisteners.forEach((promise) => {
        promise.then((unlisten) => unlisten());
      });
    };
  }, [enabled, pushState]);

  // ── Push state เมื่อ widget data / theme / settings เปลี่ยน ──────────────
  useEffect(() => {
    if (!enabled) return;
    widgets.forEach((widget) => { void pushState(widget); });
  }, [widgets, theme, accentColor, fontSize, alwaysOnTop, enabled, pushState]);

  // ── Watch widget list — create/destroy windows ────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const currentIds = new Set(widgets.map((w) => w.id));
    const prevIds    = prevWidgetIdsRef.current;

    widgets.forEach((w) => {
      const label = `widget-${w.id}`;
      if (w.isVisible && (!prevIds.has(w.id) || !windowRegistry.current.has(label))) {
        void createWidgetWindow(w);
      }
      if (!w.isVisible && windowRegistry.current.has(label)) {
        void destroyWidgetWindow(w.id);
      }
    });

    prevIds.forEach((id) => {
      if (!currentIds.has(id)) void destroyWidgetWindow(id);
    });

    prevWidgetIdsRef.current = currentIds;
  }, [widgets, enabled, createWidgetWindow, destroyWidgetWindow]);

  return { createWidgetWindow, destroyWidgetWindow };
}
