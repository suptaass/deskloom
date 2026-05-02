# Phase 11-1 — Fix Critical Bugs + New Screenshots + Centered Settings

**Date:** 2026-04-25  
**Version:** v0.6.0 → v0.6.0 (pre-launch polish)  
**Commits:** 51af8e9

## Summary
Phase 11-1 is the first pre-launch polish pass, fixing three critical bugs identified in the pre-launch analysis that would confuse users:
1. Removed unused Weather API Key UI (WeatherWidget uses Open-Meteo which doesn't need a key)
2. Fixed README's Premium feature table (Weather + Quick Links should NOT be marked Premium)
3. Added SmartScreen disclaimer (Windows SmartScreen blocks unsigned installers)

All changes maintain backward compatibility.

---

## Changes Made

### Bug 1 — Removed weatherApiKey UI from SettingsPanel
**Why:** WeatherWidget uses Open-Meteo API (free, no authentication required). The "OpenWeatherMap API Key" input in SettingsPanel:
- Confused users (they'd try to paste an API key where it's not needed)
- Added clutter (UI for a feature not used by the widget)
- Persisted from Phase 10-3 planning that was never completed

**How:** Removed "Integrations" section from SettingsPanel.tsx that contained the weatherApiKey input + toggle.

**Note:** The `weatherApiKey` field remains in `appStore.ts` and gets saved to state.json for backward compatibility (migration guard). Old state files with this field won't break.

---

### Bug 2 — Fixed README Premium Feature Table
**Why:** README listed these as Premium-only:
- ✓ Weather Widget
- ✓ Quick Links Widget

But `src/registry/widgetRegistry.ts` had `isPremium: false` for both. This mismatch would anger users on first use (they'd see a locked widget that wasn't supposed to be locked).

**How:** Updated README to match `widgetRegistry.ts`:
- Weather Widget → Free
- Quick Links Widget → Free

---

### Bug 3 — Added SmartScreen Disclaimer
**Why:** The Windows installer is unsigned. Users would see "Windows SmartScreen has blocked an unrecognized app" warning on first install.

**How:** Added a section to README explaining this is normal for unsigned open-source apps and how to proceed.

---

## Lessons Learned

### 1. Feature flags ≠ Documentation
**Issue:** Phase 10 added `weatherApiKey` to store and UI, but the WeatherWidget never needed it (Open-Meteo is free). This created a discrepancy between:
- What the code says it does (`isPremium: false` in registry)
- What the UI asks for (`weatherApiKey` input in Settings)
- What the docs promised (Premium)

**Solution:** Before shipping, align three sources of truth:
- Registry flags (`isPremium`, `isEnabled`)
- UI implementation (what Settings shows, what widgets display)
- Documentation (README, marketing materials)

### 2. Test Against the Registry
**Tip:** Run through the app and check: does every widget that's marked `isPremium: true` appear locked in Settings? Does every free widget show correctly? Mismatch = user confusion.

### 3. Installer Code Signing
**Note:** Building with Tauri v2 + unsigned installer → SmartScreen warning on Windows. Phase 11-2 explores code signing options (Windows certificate required).

---

## Remaining Work

- Phase 11-2: UI polish (centering, window drag, all widget types)
- Phase 11-3: Auto-update system via tauri-plugin-updater (future)
- Screenshots: Take new promotional screenshots with light theme + first-run experience
