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

---

## Phase 12 — Auto-Update System ✅ COMPLETED

**Goal:** Enable seamless in-app updates without requiring users to manually download and reinstall from GitHub.

**Implementation Summary:**
- ✅ Added `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` to Cargo.toml + package.json
- ✅ Registered plugins in `src-tauri/src/lib.rs`
- ✅ Added updater permissions to `src-tauri/capabilities/default.json`
- ✅ Configured updater endpoints in `tauri.conf.json` → GitHub Releases `/latest/download/latest.json`
- ✅ Generated signing key pair (`deskloom.key` + `deskloom.key.pub`)
- ✅ Created `src/components/UpdateModal.tsx` with fade-in animation + download progress
- ✅ Modified `src/App.tsx` to check updates silently on startup
- ✅ Build tested successfully — exe includes all updater code
- ✅ Commit pushed to GitHub

**User Experience (When Implemented):**
1. App starts → checks GitHub for new version
2. If new version available → modal popup: "Update Available — vX.X.X"
3. User clicks "Install Update" → download + install + auto-restart
4. App restarts with new version (seamless)
5. Button "Later" lets user skip for now

**Release Procedure (For Each Future Release):**

After bumping version and building exe:

1. **Build exe with signing:**
   ```bash
   TAURI_SIGNING_PRIVATE_KEY_PATH="./deskloom.key" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="[your password]" pnpm tauri build
   ```
   _(Creates `.exe.sig` file automatically)_

2. **Create `latest.json` manifest** (must be exact format):
   ```json
   {
     "version": "v0.6.1",
     "notes": "What's new in this release",
     "pub_date": "2026-05-04T00:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "[contents of DeskLoom_0.6.1_x64-setup.exe.sig]",
         "url": "https://github.com/suptaass/deskloom/releases/download/v0.6.1/DeskLoom_0.6.1_x64-setup.exe"
       }
     }
   }
   ```

3. **Upload to GitHub Release:**
   - Create release tag: `v0.6.1`
   - Upload files:
     - `DeskLoom_0.6.1_x64-setup.exe`
     - `DeskLoom_0.6.1_x64-setup.exe.sig`
     - `latest.json` ← Users will fetch this to check for updates

4. **Verify:** App running old version should show update modal

**Important Notes:**
- ⚠️ **Signing key password is critical** — save it somewhere safe. Losing it means can't sign future updates.
- ⚠️ **`latest.json` must be present** on every release. Without it, app won't detect updates.
- ⚠️ **URL in `latest.json` must point to correct exe location** on GitHub Release.
- Silent update check won't block startup if check fails (network down, malformed JSON, etc.)
- Dev mode (`pnpm tauri dev`) doesn't trigger updater — only exe builds.
