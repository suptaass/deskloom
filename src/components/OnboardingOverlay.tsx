// src/components/OnboardingOverlay.tsx
// แสดงเฉพาะ first run — รับ isVisible และ onDismiss ผ่าน props เท่านั้น

import React, { useEffect, useState } from "react";

interface OnboardingOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

interface Hint {
  icon:  string;
  title: string;
  desc:  string;
}

const HINTS: Hint[] = [
  {
    icon:  "✋",
    title: "Drag widgets freely",
    desc:  "Click and drag any widget to move it anywhere on screen.",
  },
  {
    icon:  "⚙️",
    title: "Open Settings",
    desc:  "Press Ctrl+, to open Settings — change theme, colors, and manage widgets.",
  },
  {
    icon:  "🔲",
    title: "Resize & lock",
    desc:  "Drag the edges to resize. Lock a widget in Settings to prevent accidental moves.",
  },
];

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ isVisible, onDismiss }) => {
  const [isMounted, setIsMounted] = useState(false);

  // Fade in เมื่อ mount
  useEffect(() => {
    if (isVisible) {
      const t = setTimeout(() => setIsMounted(true), 50);
      return () => clearTimeout(t);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      onClick={onDismiss}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          9500,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        background:      "rgba(0, 0, 0, 0.55)",
        backdropFilter:  "blur(4px)",
        opacity:         isMounted ? 1 : 0,
        transition:      "opacity 0.4s ease",
        cursor:          "pointer",
      }}
    >
      {/* Card — stopPropagation ไม่ต้องการ: คลิกที่ไหนก็ dismiss */}
      <div
        style={{
          background:    "var(--widget-bg)",
          border:        "1px solid var(--widget-border)",
          borderRadius:  "18px",
          padding:       "32px 36px",
          maxWidth:      "400px",
          width:         "90vw",
          backdropFilter:"blur(16px)",
          transform:     isMounted ? "translateY(0)" : "translateY(12px)",
          transition:    "transform 0.4s ease",
          cursor:        "default",
        }}
        onClick={(e) => e.stopPropagation()} // คลิกใน card ไม่ dismiss
      >
        {/* Title */}
        <p style={{
          fontSize:      "20px",
          fontWeight:    "700",
          color:         "var(--text-primary)",
          marginBottom:  "6px",
          textAlign:     "center",
        }}>
          Welcome to DeskLoom 👋
        </p>
        <p style={{
          fontSize:      "12px",
          color:         "var(--text-secondary)",
          textAlign:     "center",
          marginBottom:  "24px",
        }}>
          Here's a quick guide to get started
        </p>

        {/* Hints */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {HINTS.map((hint) => (
            <div
              key={hint.title}
              style={{
                display:       "flex",
                gap:           "14px",
                alignItems:    "flex-start",
              }}
            >
              <span style={{ fontSize: "22px", flexShrink: 0, lineHeight: 1 }}>
                {hint.icon}
              </span>
              <div>
                <p style={{
                  fontSize:     "13px",
                  fontWeight:   "600",
                  color:        "var(--text-primary)",
                  marginBottom: "2px",
                }}>
                  {hint.title}
                </p>
                <p style={{
                  fontSize:   "12px",
                  color:      "var(--text-secondary)",
                  lineHeight: "1.5",
                }}>
                  {hint.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          style={{
            marginTop:    "28px",
            width:        "100%",
            padding:      "10px",
            borderRadius: "10px",
            border:       "1px solid var(--accent-color)",
            background:   "color-mix(in srgb, var(--accent-color) 15%, transparent)",
            color:        "var(--accent-color)",
            fontSize:     "13px",
            fontWeight:   "600",
            cursor:       "pointer",
            fontFamily:   "inherit",
          }}
        >
          Got it — let's go!
        </button>
      </div>
    </div>
  );
};

export default OnboardingOverlay;