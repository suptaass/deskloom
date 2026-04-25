// src/utils/license.ts

import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";

const APP_DIR      = "com.deskloom.app";
const LICENSE_FILE = `${APP_DIR}/license.json`;

// Update this to the actual Gumroad product permalink once the product is live
const GUMROAD_PRODUCT_PERMALINK = "deskloom";

export interface LicenseData {
  key:        string;
  email:      string;
  verifiedAt: number;
}

export async function loadLicense(): Promise<LicenseData | null> {
  const fileExists = await exists(LICENSE_FILE, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return null;
  try {
    const raw  = await readTextFile(LICENSE_FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.key !== "string" || typeof data.verifiedAt !== "number") return null;
    return {
      key:        data.key,
      email:      typeof data.email === "string" ? data.email : "",
      verifiedAt: data.verifiedAt,
    };
  } catch {
    return null;
  }
}

export async function saveLicense(data: LicenseData): Promise<void> {
  await mkdir(APP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(
    LICENSE_FILE,
    JSON.stringify(data, null, 2),
    { baseDir: BaseDirectory.AppData }
  );
}

export async function clearLicense(): Promise<void> {
  await mkdir(APP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(LICENSE_FILE, "{}", { baseDir: BaseDirectory.AppData });
}

// ── Gumroad API ────────────────────────────────────────────────────────────

interface GumroadResponse {
  success:   boolean;
  message?:  string;
  purchase?: {
    email:         string;
    product_name:  string;
    refunded:      boolean;
    chargebacked:  boolean;
    disputed:      boolean;
  };
}

export type VerifyResult =
  | { ok: true;  email: string }
  | { ok: false; error: string };

export async function verifyLicense(licenseKey: string): Promise<VerifyResult> {
  try {
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        product_permalink:    GUMROAD_PRODUCT_PERMALINK,
        license_key:          licenseKey.trim(),
        increment_uses_count: "false",
      }),
    });

    const data = (await res.json()) as GumroadResponse;

    if (!data.success || !data.purchase) {
      return { ok: false, error: data.message ?? "Invalid license key" };
    }

    const { refunded, chargebacked, disputed, email } = data.purchase;
    if (refunded || chargebacked || disputed) {
      return { ok: false, error: "This license has been refunded or disputed" };
    }

    return { ok: true, email };
  } catch {
    return {
      ok:    false,
      error: "Could not connect to license server. Check your internet connection.",
    };
  }
}
