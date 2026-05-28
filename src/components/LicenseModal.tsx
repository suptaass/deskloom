// src/components/LicenseModal.tsx

import React, { useState, useEffect, useRef } from "react";
import { useLicenseStore } from "../store/licenseStore";

interface LicenseModalProps {
  onClose: () => void;
}

const LicenseModal: React.FC<LicenseModalProps> = ({ onClose }) => {
  const [keyInput, setKeyInput] = useState("");

  const isPremium    = useLicenseStore((s) => s.isPremium);
  const email        = useLicenseStore((s) => s.email);
  const licenseKey   = useLicenseStore((s) => s.licenseKey);
  const isVerifying  = useLicenseStore((s) => s.isVerifying);
  const errorMsg     = useLicenseStore((s) => s.errorMsg);
  const activate     = useLicenseStore((s) => s.activateLicense);
  const deactivate   = useLicenseStore((s) => s.deactivate);
  const clearError   = useLicenseStore((s) => s.clearError);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPremium) inputRef.current?.focus();
    return () => clearError();
  }, []);

  const handleActivate = async () => {
    if (!keyInput.trim()) return;
    await activate(keyInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleActivate();
    if (e.key === "Escape") onClose();
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position:        "fixed",
    inset:           0,
    background:      "rgba(0,0,0,0.55)",
    backdropFilter:  "blur(4px)",
    zIndex:          99999,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
  };

  const cardStyle: React.CSSProperties = {
    background:    "var(--widget-bg)",
    border:        "1px solid var(--widget-border)",
    borderRadius:  "14px",
    padding:       "28px 28px 24px",
    width:         "340px",
    display:       "flex",
    flexDirection: "column",
    gap:           "16px",
    color:         "var(--text-primary)",
    boxShadow:     "0 24px 60px rgba(0,0,0,0.5)",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "15px", fontWeight: "700", marginBottom: "2px",
  };

  const subStyle: React.CSSProperties = {
    fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5",
  };

  const inputStyle: React.CSSProperties = {
    width:        "100%",
    padding:      "9px 12px",
    borderRadius: "7px",
    border:       "1px solid var(--input-border)",
    background:   "var(--input-bg)",
    color:        "var(--text-primary)",
    fontSize:     "13px",
    outline:      "none",
    fontFamily:   "inherit",
    boxSizing:    "border-box",
  };

  const btnPrimary: React.CSSProperties = {
    flex:          1,
    padding:       "9px 0",
    borderRadius:  "7px",
    border:        "none",
    background:    isVerifying ? "var(--btn-bg)" : "var(--accent-color)",
    color:         "#fff",
    fontSize:      "13px",
    fontWeight:    "600",
    cursor:        isVerifying ? "not-allowed" : "pointer",
    fontFamily:    "inherit",
    opacity:       isVerifying ? 0.7 : 1,
  };

  const btnSecondary: React.CSSProperties = {
    flex:         1,
    padding:      "9px 0",
    borderRadius: "7px",
    border:       "1px solid var(--btn-border)",
    background:   "var(--btn-bg)",
    color:        "var(--btn-text)",
    fontSize:     "13px",
    cursor:       "pointer",
    fontFamily:   "inherit",
  };

  const errorStyle: React.CSSProperties = {
    fontSize:     "12px",
    color:        "#F56C8E",
    background:   "color-mix(in srgb, #F56C8E 10%, transparent)",
    border:       "1px solid color-mix(in srgb, #F56C8E 30%, transparent)",
    borderRadius: "6px",
    padding:      "8px 10px",
    lineHeight:   "1.4",
  };

  const successBadgeStyle: React.CSSProperties = {
    display:      "flex",
    alignItems:   "center",
    gap:          "8px",
    background:   "color-mix(in srgb, #4CAF50 12%, transparent)",
    border:       "1px solid color-mix(in srgb, #4CAF50 30%, transparent)",
    borderRadius: "8px",
    padding:      "10px 12px",
    fontSize:     "13px",
    color:        "#4CAF50",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={cardStyle}>

        {/* Header */}
        <div>
          <p style={titleStyle}>DeskLoom Premium</p>
          <p style={subStyle}>
            {isPremium
              ? "Your license is active."
              : "Enter your license key to unlock Pomodoro, Habit Tracker, and more."}
          </p>
        </div>

        {/* Premium active */}
        {isPremium && (
          <>
            <div style={successBadgeStyle}>
              <span style={{ fontSize: "16px" }}>✓</span>
              <div>
                <p style={{ fontWeight: "600", marginBottom: "2px" }}>Premium Active</p>
                {email && <p style={{ fontSize: "11px", opacity: 0.8 }}>{email}</p>}
                {licenseKey && (
                  <p style={{ fontSize: "10px", opacity: 0.5, marginTop: "2px", fontFamily: "monospace" }}>
                    {licenseKey.slice(0, 8)}••••
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button style={btnSecondary} onClick={onClose}>Close</button>
              <button
                style={{ ...btnSecondary, color: "#F56C8E", borderColor: "color-mix(in srgb, #F56C8E 40%, transparent)" }}
                onClick={async () => { await deactivate(); }}
              >
                Deactivate
              </button>
            </div>
          </>
        )}

        {/* Activation form */}
        {!isPremium && (
          <>
            <input
              ref={inputRef}
              style={inputStyle}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); clearError(); }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />

            {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

            <div style={{ display: "flex", gap: "8px" }}>
              <button style={btnSecondary} onClick={onClose}>Cancel</button>
              <button
                style={btnPrimary}
                onClick={handleActivate}
                disabled={isVerifying || !keyInput.trim()}
              >
                {isVerifying ? "Verifying…" : "Activate License"}
              </button>
            </div>

            <p style={{ ...subStyle, textAlign: "center", marginTop: "-4px" }}>
              Don't have a license?{" "}
              <span
                style={{ color: "var(--accent-color)", cursor: "pointer" }}
                onClick={() => {
                  // Opens system browser — requires shell:allow-open in capabilities
                  import("@tauri-apps/plugin-shell").then(({ open }) =>
                    open("https://sutasiripa.gumroad.com/l/wqjgje")
                  );
                }}
              >
                Get Premium →
              </span>
            </p>
          </>
        )}

      </div>
    </div>
  );
};

export default LicenseModal;
