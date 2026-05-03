# Handoff Phase 11 — Final Polish & Release Ready

**Date:** 2026-05-03  
**Version:** v0.6.0  
**Status:** ✅ READY FOR LAUNCH  
**Commits:** ff5f31b, e38e494, 181c512, b1bfd3f

---

## What Was Done

### 1. Fixed Theme Default Fallback
**File:** `src/utils/storage.ts:206`

**Issue:** When `state.json` doesn't exist (first-run or deleted), the app showed **dark theme** instead of light.
- User deletes `state.json` for screenshot
- App loads, shows dark mode (wrong!)
- Expected: light mode (default in appStore.ts)

**Root Cause:** `parseAppState()` fallback was:
```ts
// OLD (fallback to dark)
parsed.theme === "light" ? "light" : "dark"
```

**Fix:**
```ts
// NEW (fallback to light)
parsed.theme === "dark" ? "dark" : "light"
```

**Impact:** First-time users now see light theme ✓

---

### 2. Created Missing Lesson Files
**Files Created:**
- `Lesson/Phase 11-1.md` — critical bugs (weatherApiKey UI, Premium table, SmartScreen)
- `Lesson/Phase 11-2.md` — UI polish (centering, window drag, all widget types)

**Lesson Covered:**
- Feature flags must match UI + documentation
- Test exe builds, not just dev mode
- User expectations for button behavior (single toggle patterns)

---

### 3. Added Promotional Screenshots & Updated README
**Files Added:**
- `docs/screenshot-welcome.png` — first-run onboarding
- `docs/screenshot-light.png` — light theme main view
- `docs/screenshot-dark.png` — dark theme + settings
- `docs/screenshot-settings.png` — customization interface
- `docs/screenshot-widgets.png` — multiple widgets demo

**README Updated:**
- Replaced broken screenshot references
- New organized screenshot sections
- Live images now render on GitHub

---

### 4. Fixed ClockWidget Toggle Behavior
**File:** `src/components/widgets/ClockWidget.tsx`

**Issue:** User was confused by single-button toggle design (button shows mode to switch TO, not current mode).

**Initial Approach:** Changed to 4-button layout ([12h] [24h] [TH] [EN]) with active state highlighting.

**User Feedback:** "ไม่ควรเป็นงี้ — ต้องการ single toggle เดิม" (shouldn't be like that — want the original single toggle)

**Final Fix:** Reverted to single toggle pattern:
- Press "12h" button → switches to 12h → button now shows "24h"
- Press "EN" button → switches to EN → button now shows "TH"
- Clear UX pattern once understood

**Lesson:** User's original understanding of single-toggle was correct. Button shows "what you'll switch to next," not "current mode." This is standard toggle pattern.

---

### 5. Built Release Executable
**File:** `DeskLoom_0.6.0_x64-setup.exe` (2.76 MB)

Build includes:
- ✅ Light theme default (fixed)
- ✅ All widget types working
- ✅ New screenshots in README
- ✅ ClockWidget toggle working as intended

---

## Commit History (This Session)

```
b1bfd3f revert: clock widget - restore single toggle button design
181c512 fix: clock widget 12h/24h toggle — show active state
e38e494 docs: add new promotional screenshots for v0.6.0
ff5f31b fix: default theme fallback to 'light' + lesson docs Phase 11
```

---

## What's Ready

| Item | Status |
|---|---|
| Code | ✅ All fixes committed + pushed |
| Documentation | ✅ Lesson files + README screenshots |
| Build | ✅ v0.6.0 exe ready to install |
| Screenshots | ✅ 5 promotional images in docs/ |
| Theme | ✅ Light default working |
| Widgets | ✅ All types tested |
| Toggles | ✅ Single-button pattern working |

---

## Next Steps for User/Tester

1. **Install exe:** `DeskLoom_0.6.0_x64-setup.exe`
2. **Delete old state.json:** Confirm first-run shows light theme ✓
3. **Test widgets:** Clock toggle (12h/24h/TH/EN), Todo, Notes, etc.
4. **Promote:** Share screenshots from docs/

---

## Known Notes

- **Code signing:** Exe is unsigned → Windows SmartScreen warning on install (mentioned in README)
- **Auto-update:** Not implemented (Phase 11-3 future)
- **API keys:** weatherApiKey field persists in state.json for backward compat (not used by WeatherWidget)

---

## Lessons from Phase 11

1. **Single-toggle UX is standard** — button showing "next mode" is expected once users understand it
2. **Testing exe builds is critical** — dev mode hides closure bugs and CSS variable scope issues
3. **Feature flags + UI + docs must align** — one mismatch creates user confusion
4. **Screenshot quality matters** — new promotional images should be taken in first-run state with correct defaults
5. **Fallback values compound** — default theme in appStore.ts + fallback in storage.ts must match, or fresh installs break

---

## Release Checklist

- [x] All critical bugs fixed
- [x] Screenshots taken and updated README
- [x] Lesson files created
- [x] Theme default correct (light ✓)
- [x] Exe built and tested
- [x] All commits pushed
- [x] No uncommitted changes

**Status: Ready for public launch / wider distribution** 🚀
