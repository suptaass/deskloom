# Phase 12-1 — Auto-Update Implementation & Release Workflow

**Date:** 2026-05-03  
**Scope:** Complete auto-update feature from implementation to first signed release  
**Commits:** 15012d5, ac04d89

---

## Summary

Phase 12-1 implements Tauri's plugin-updater to enable seamless in-app updates. Users can now receive new versions with a single click instead of manually downloading from GitHub.

**Critical path:**
1. Add updater plugins + permissions
2. Generate signing key pair for update verification
3. Create update check logic + UI modal
4. Build, sign, and release with manifest
5. Automate the process for future releases

---

## Changes Made

### 1. Backend Setup — Tauri Plugins

**Why:** Tauri v2 provides official updater plugin with minisign verification built-in. No custom backend needed.

**What changed:**
- `Cargo.toml`: Added `tauri-plugin-updater = "2"` + `tauri-plugin-process = "2"`
- `lib.rs`: Registered both plugins in builder chain
- `capabilities/default.json`: Added 3 updater/process permissions

**Pattern:** Similar to existing plugins (autostart, dialog, shell). Each plugin is:
1. Added to Cargo.toml
2. Initialized in lib.rs with `.plugin(...)`
3. Granted capabilities in JSON

### 2. Signing Key Generation

**Why:** Updater must verify that downloaded exe hasn't been tampered with. Tauri uses minisign (cryptographic signatures).

**Command:**
```bash
pnpm tauri signer generate -w ./deskloom.key
```

Generates:
- `deskloom.key` (private, encrypted with password)
- `deskloom.key.pub` (public base64, stored in config)

**Key insight:** Private key password is used ONLY during release builds. Never commit the key. Store password securely (e.g., password manager, CI/CD secrets).

### 3. Update Configuration

**File:** `src-tauri/tauri.conf.json`

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": ["https://github.com/.../latest.json"],
    "pubkey": "[base64]"
  }
}
```

**Why GitHub Releases?** Free hosting, CDN, reliable. App fetches `latest.json` to:
1. Check if newer version exists
2. Get download URL + signature
3. Verify signature before installing

### 4. Frontend: UpdateModal Component

**File:** `src/components/UpdateModal.tsx`

Pattern borrowed from `LicenseModal.tsx` and `OnboardingOverlay.tsx`:
- Fixed overlay with blur backdrop
- Centered card with CSS variables (respects theme)
- Fade-in animation via `isMounted` state + setTimeout(50ms)

**Why setTimeout(50ms)?** Allows React state to settle before applying animation. Without it, CSS transitions don't trigger properly.

**Key code:**
```tsx
const handleInstall = async () => {
  if (!update) return;
  setIsDownloading(true);
  try {
    await update.downloadAndInstall();
    await relaunch();
  } catch (err) {
    console.error("Update failed:", err);
    setIsDownloading(false);
  }
};
```

Method chain: `update.downloadAndInstall()` (from Tauri API) → downloads + installs → `relaunch()` (from process plugin) → restarts app.

### 5. App Integration

**File:** `src/App.tsx`

Added in `init()` after `setIsLoaded(true)`:
```tsx
try {
  const update = await checkUpdate();
  if (update?.available) setPendingUpdate(update);
} catch (err) {
  console.debug("[App] update check failed:", err);
}
```

**Why after `setIsLoaded`?** App startup flow:
1. Load license from disk
2. Load widget state from disk
3. **Hydrate store** ← DOM is ready
4. `setIsLoaded(true)` ← gates all effects
5. **Check for updates** ← safe to show modal now

Silent fail (catch block) prevents network errors from blocking startup. User sees app immediately; update check happens in background.

### 6. Build & Sign Process

**Step 1: Build with signing context**
```bash
TAURI_SIGNING_PRIVATE_KEY_PATH="./deskloom.key"
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="[password]"
pnpm tauri build
```

Tauri's build system detects env vars and includes signing context.

**Step 2: Manually sign exe (because Tauri v2 doesn't auto-sign)**
```bash
pnpm tauri signer sign "DeskLoom_0.6.0_x64-setup.exe"
```

Creates `.sig` file with minisign signature (base64 format).

**Why manual signing?** Tauri v2 updater workflow expects:
- `.exe` file (executable)
- `.sig` file (signature)
- `latest.json` (manifest with signature content embedded)

This gives flexibility: can sign after build, move files around, etc.

### 7. Release Manifest

**File:** `latest.json`

Required by Tauri. Format is strict:
```json
{
  "version": "v0.6.0",
  "notes": "...",
  "pub_date": "2026-05-03T09:05:43Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "[minisign base64]",
      "url": "https://github.com/.../DeskLoom_0.6.0_x64-setup.exe"
    }
  }
}
```

**Critical fields:**
- `version`: MUST start with `v` and match exe version
- `signature`: Exact content of `.sig` file (base64)
- `url`: Direct download link to exe
- `pub_date`: ISO 8601 format, UTC timezone

If any field is wrong, updater fails silently (app continues anyway).

### 8. Release Automation Script

**File:** `scripts/release.ps1`

Wraps the manual steps into one command:
```powershell
.\scripts\release.ps1 -Version "0.6.1" -Notes "What's new"
```

Does:
1. Sets env vars (private key path + password)
2. Runs `pnpm tauri build`
3. Runs `pnpm tauri signer sign`
4. Extracts signature from output
5. Generates `latest.json`
6. Outputs file paths for manual GitHub upload

**Limitation:** `gh` CLI not available, so upload is manual. Future improvement: use GitHub API via curl + token.

---

## Lessons Learned

### 1. Signing Key Password is Critical
**Lesson:** Losing the password means can't sign future updates → users stuck on old version.

**Applies to:** Any release with signature-based verification.

**Action:** Store password in:
- Password manager
- CI/CD secrets (GitHub Actions)
- Hardware security key (production)

Never in git or plaintext files.

### 2. latest.json Must Match Exe Version
**Lesson:** Built `v0.6.0` exe but put `v0.6.1` in latest.json → updater skips it (thinks it's newer but exe is old).

**Applies to:** Every release.

**Action:** Bump version in tauri.conf.json BEFORE building. Version appears in:
- Exe filename
- Exe internal version
- latest.json version field

All three must match.

### 3. Silent Failures Hide Network Problems
**Lesson:** Update check fails if GitHub is down or latest.json is malformed. User sees nothing — app just starts normally.

**Applies to:** Error handling in background checks.

**Action:** Log to console (debug level, not error). Add optional UI toggle: "Check for updates now" button with error display.

### 4. Minisign Format is Strict
**Lesson:** Tried to use RSA signature format from OpenSSH. Tauri's minisign verifier rejected it immediately.

**Applies to:** Signature algorithms.

**Action:** Use tauri signer CLI (handles format automatically). Don't try to sign manually with other tools.

### 5. Update Check Timing Matters
**Lesson:** If update check runs before `isLoaded = true`, Tauri APIs aren't ready yet → race condition.

**Applies to:** Plugin API initialization.

**Action:** Wait for app hydration complete before calling `checkUpdate()`. Specifically: after `setIsLoaded(true)` which gates all effects.

### 6. Dev Mode Doesn't Support Updater
**Lesson:** Tested with `pnpm tauri dev`. Update check always returned null (no available updates, by design).

**Applies to:** Testing.

**Action:** Always test updater against built `.exe`, never dev mode. Build exe, test locally, then release.

---

## Release Workflow for Team

### First Time Setup
```bash
# Generate key pair (once per team)
pnpm tauri signer generate -w ./deskloom.key
# Share password via secure channel (1Password, KMS, etc.)
# commit: deskloom.key, deskloom.key.pub, .gitignore
```

### For Each Release
```bash
# 1. Bump version in src-tauri/tauri.conf.json
# 2. Commit + push
# 3. Run script
.\scripts\release.ps1 -Version "0.6.1" -Notes "Features..."

# 4. Upload files manually to GitHub Release:
#    - DeskLoom_0.6.1_x64-setup.exe
#    - DeskLoom_0.6.1_x64-setup.exe.sig
#    - latest.json
# 5. Publish release
```

### Verification
- Old app running → update modal appears ✓
- Click "Install Update" → downloads + installs ✓
- App restarts → new version ✓
- latest.json served from GitHub ✓
- Signature verifies ✓

---

## Future Improvements

**Phase 13 - Release Automation:**
- GitHub Actions workflow (build + sign + upload)
- No manual GitHub UI needed
- Triggered by git tag or release event

**Phase 14 - Better UX:**
- "Check for updates" manual button in Settings
- Error messages if update fails
- Staged rollout (10% → 50% → 100% users)

**Phase 15 - Security:**
- Windows code signing certificate (for SmartScreen)
- Delta updates (only changed files)
- Rollback on failure

---

## Testing Checklist

- [x] Build exe with signing key
- [x] Manually sign exe
- [x] latest.json structure correct
- [x] App startup includes update check
- [x] UpdateModal renders when update available
- [x] Download + install flow works
- [x] App restarts after install
- [x] Signature verifies (app trusts new version)
- [x] Network failure doesn't crash app
- [x] "Later" button dismisses modal
- [x] v0.6.0 release uploaded to GitHub
