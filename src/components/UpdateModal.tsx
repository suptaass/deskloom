// src/components/UpdateModal.tsx

import React, { useEffect, useState } from "react";
import { type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateModalProps {
  update: Update | null;
  onDismiss: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ update, onDismiss }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (update) {
      const t = setTimeout(() => setIsMounted(true), 50);
      return () => clearTimeout(t);
    } else {
      setIsMounted(false);
    }
  }, [update]);

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

  if (!update) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(4px)",
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: isMounted ? 1 : 0,
    transition: "opacity 0.4s ease",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--widget-bg)",
    border: "1px solid var(--widget-border)",
    borderRadius: "14px",
    padding: "28px 28px 24px",
    width: "340px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    color: "var(--text-primary)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    transform: isMounted ? "translateY(0)" : "translateY(12px)",
    transition: "transform 0.4s ease",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "15px",
    fontWeight: "700",
    marginBottom: "2px",
  };

  const subStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
  };

  const btnPrimary: React.CSSProperties = {
    flex: 1,
    padding: "9px 0",
    borderRadius: "7px",
    border: "none",
    background: isDownloading ? "var(--btn-bg)" : "var(--accent-color)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: isDownloading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    opacity: isDownloading ? 0.7 : 1,
  };

  const btnSecondary: React.CSSProperties = {
    flex: 1,
    padding: "9px 0",
    borderRadius: "7px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)",
    color: "var(--btn-text)",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const progressBarStyle: React.CSSProperties = {
    width: "100%",
    height: "4px",
    background: "var(--input-border)",
    borderRadius: "2px",
    overflow: "hidden",
  };

  const progressFillStyle: React.CSSProperties = {
    height: "100%",
    background: "var(--accent-color)",
    transition: "width 0.2s ease",
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onDismiss();
      }}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div>
          <p style={titleStyle}>Update Available</p>
          <p style={subStyle}>
            {isDownloading ? "Downloading and installing…" : `Version ${update.version}`}
          </p>
        </div>

        {/* Release notes */}
        {update.body && !isDownloading && (
          <div style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            borderRadius: "7px",
            padding: "10px 12px",
            maxHeight: "80px",
            overflowY: "auto",
            lineHeight: "1.5",
          }}>
            {update.body}
          </div>
        )}

        {/* Progress bar (during download) */}
        {isDownloading && (
          <div style={progressBarStyle}>
            <div style={progressFillStyle} />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={btnSecondary}
            onClick={onDismiss}
            disabled={isDownloading}
          >
            Later
          </button>
          <button
            style={btnPrimary}
            onClick={handleInstall}
            disabled={isDownloading}
          >
            {isDownloading ? "Installing…" : "Install Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
