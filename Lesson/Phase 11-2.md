# Phase 11-2 — Fix UI Centering, Window Drag, and All Widget Types

**Date:** 2026-04-26  
**Version:** v0.6.0  
**Commits:** c4c8f33

## Summary
Phase 11-2 is the second pre-launch polish pass, fixing three groups of UI/UX bugs found during testing the Phase 11-1 build:
1. **UI Centering** — SettingsPanel and widget windows not centering properly on screen
2. **Window Drag** — Widget windows not dragging smoothly; position updates not syncing correctly
3. **Widget Types** — All widget types (clock, todo, notes, quicklinks, calendar, weather, pomodoro, habittracker) had rendering or interaction issues in actual exe

All changes are visual/UX only (no data structure changes).

---

## Changes Made

### Issue 1 — SettingsPanel Centering
**Files:** `src/App.tsx`, `src/components/SettingsPanel.tsx`, `src/styles.css`

**Why it broke:** The hidden main window (SettingsPanel host) was being centered using Tauri API, but viewport/DPI scaling wasn't accounted for. On high-DPI displays (125%, 150%), the window would appear off-center.

**Fix:**
- `App.tsx`: Adjusted window centering logic to account for `logicalSize` vs `physicalSize`
- `SettingsPanel.tsx`: Added CSS constraints to ensure the panel doesn't overflow viewport
- `styles.css`: Refined layout padding/margin to handle different screen sizes

**Testing:** Tested on 100%, 125%, and 150% DPI displays.

---

### Issue 2 — Widget Window Dragging and Position Sync
**Files:** `src/components/WidgetWindow.tsx`, `src/hooks/useWidgetWindowSync.ts`

**Why it broke:**
- OS-level drag (`startDragging()`) was triggering, but Tauri's `tauri://move` event wasn't firing reliably
- Position changes from user drag weren't being saved to state.json (only `widget:position-change` event was emitted locally)
- On app restart, widgets wouldn't remember their last dragged position

**Fix:**
- `WidgetWindow.tsx`: Added explicit position debounce (400ms) during drag to reduce event noise
- `useWidgetWindowSync.ts`: Added listen-on-change tracking for `tauri://move` to reliably detect monitor changes
- Position changes now properly sync back to the main store via `updateWidgetPosition()`

**Testing:** Dragged widgets to different monitors, resized, restarted app — positions persist correctly.

---

### Issue 3 — All Widget Types Rendering/Interaction
**Files:** Multiple widget files:
- `src/components/widgets/ClockWidget.tsx`
- All other widget components (implicit fixes)

**Why it broke:** Widgets worked in dev mode, but the exe build had:
- CSS variable scope issues (dark/light theme not applying correctly)
- Event handler closures capturing stale state
- Scroll/resize handlers on some widgets not working

**Fix:**
- **Clock Widget:** Fixed `parseClockConfig` parsing logic to handle edge cases (malformed JSON label)
- **All Widgets:** Ensured `useCallback` dependencies are correct, preventing stale closure issues
- **All Widgets:** Re-applied CSS variable scoping so theme switching affects all widgets instantly

**Testing:** Opened each widget type in exe, toggled settings, restarted — all render and respond correctly.

---

## Lessons Learned

### 1. Dev Mode ≠ Built Exe
**Issue:** Code works perfectly in `pnpm tauri dev`, but the exe build reveals issues because:
- Dev mode uses HMR (hot reload) → stale closure bugs hidden
- Dev mode doesn't rebuild CSS → variable scope issues hidden
- Dev mode has different error handling for Tauri APIs

**Solution:** Always build and test the exe before considering a phase complete. Don't trust dev-mode-only testing.

### 2. DPI Scaling is Invisible Until It Matters
**Tip:** Test your app on at least 100%, 125%, and 150% DPI displays. Many users have high-DPI laptops, and off-center windows are extremely annoying.

### 3. State Persistence Requires Round-Trip Testing
**Pattern:**
1. User action (drag widget)
2. Emit event to main process
3. Main process updates store
4. Main process saves to disk
5. Restart app
6. State is restored

If any link breaks, users see "my widgets reset on restart." Test the full round-trip, not just step 1.

---

## Build & Release Checklist ✓

- [x] All widget types render correctly in exe
- [x] Theme switching (dark/light) affects all windows
- [x] Dragging/resizing persists across restarts
- [x] Settings window centers on all DPI scales
- [x] No console errors in exe build
- [x] All Tauri API calls handle errors gracefully
- [x] Code builds without TypeScript errors (`pnpm build`)
- [x] Code builds without Tauri errors (`pnpm tauri build`)

---

## Ready for Launch
✓ Phase 11-1 & 11-2 complete  
✓ All critical bugs fixed  
✓ Exe tested and polished  
→ Ready for public promotion / wide release
