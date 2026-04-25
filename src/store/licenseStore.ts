// src/store/licenseStore.ts

import { create } from "zustand";
import {
  loadLicense,
  saveLicense,
  clearLicense,
  verifyLicense,
  LicenseData,
} from "../utils/license";

interface LicenseStore {
  isPremium:   boolean;
  licenseKey:  string | null;
  email:       string | null;
  isVerifying: boolean;
  errorMsg:    string | null;

  loadFromDisk:    () => Promise<void>;
  activateLicense: (key: string) => Promise<boolean>;
  deactivate:      () => Promise<void>;
  clearError:      () => void;
}

export const useLicenseStore = create<LicenseStore>((set) => ({
  isPremium:   false,
  licenseKey:  null,
  email:       null,
  isVerifying: false,
  errorMsg:    null,

  loadFromDisk: async () => {
    const data = await loadLicense();
    if (data) {
      set({ isPremium: true, licenseKey: data.key, email: data.email });
    }
  },

  activateLicense: async (key) => {
    set({ isVerifying: true, errorMsg: null });
    const result = await verifyLicense(key);
    if (result.ok) {
      const licenseData: LicenseData = {
        key,
        email:      result.email,
        verifiedAt: Date.now(),
      };
      await saveLicense(licenseData);
      set({
        isPremium:   true,
        licenseKey:  key,
        email:       result.email,
        isVerifying: false,
      });
      return true;
    } else {
      set({ isVerifying: false, errorMsg: result.error });
      return false;
    }
  },

  deactivate: async () => {
    await clearLicense();
    set({ isPremium: false, licenseKey: null, email: null, errorMsg: null });
  },

  clearError: () => set({ errorMsg: null }),
}));
