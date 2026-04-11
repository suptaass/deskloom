// src/components/widgets/ClockWidget.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Widget } from "../../types/widget";

interface ClockWidgetProps {
  widget: Widget;
  onConfigChange: (changes: { use24h?: boolean; locale?: string; newLabel?: string }) => void;
}

interface ClockConfig {
  use24h: boolean;
  locale: string;
}

// Step 7-5: รองรับ JSON format ใหม่ และ legacy "||" format เก่า
function parseClockConfig(label: string): { displayLabel: string; config: ClockConfig } {
  // ลอง JSON format ก่อน (format ใหม่)
  try {
    const parsed = JSON.parse(label) as Record<string, unknown>;
    if (typeof parsed.name === "string") {
      return {
        displayLabel: parsed.name,
        config: {
          use24h: parsed.use24h !== false, // default true ถ้าไม่มี field
          locale: typeof parsed.locale === "string" ? parsed.locale : "th-TH",
        },
      };
    }
  } catch {
    // ไม่ใช่ JSON — ลอง legacy format
  }

  // Legacy format: "DisplayName||24h||th-TH"
  const parts = label.split("||");
  if (parts.length === 3) {
    return {
      displayLabel: parts[0],
      config: { use24h: parts[1] === "24h", locale: parts[2] || "th-TH" },
    };
  }

  // fallback
  return { displayLabel: label, config: { use24h: true, locale: "th-TH" } };
}

// Step 7-5: encode เป็น JSON string แทน "||"
function buildLabel(displayLabel: string, config: ClockConfig): string {
  return JSON.stringify({
    name:   displayLabel,
    use24h: config.use24h,
    locale: config.locale,
  });
}

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ widget, onConfigChange }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const { displayLabel, config } = parseClockConfig(widget.label);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback(
    (date: Date): string => {
      if (config.use24h) {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
      const hours = date.getHours();
      const h12   = hours % 12 || 12;
      const ampm  = hours < 12 ? "AM" : "PM";
      return `${pad(h12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
    },
    [config.use24h]
  );

  const handleToggleFormat = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      onConfigChange({ newLabel: buildLabel(displayLabel, { ...config, use24h: !config.use24h }) });
    },
    [config, displayLabel, onConfigChange]
  );

  const handleToggleLocale = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      const newLocale = config.locale === "th-TH" ? "en-US" : "th-TH";
      onConfigChange({ newLabel: buildLabel(displayLabel, { ...config, locale: newLocale }) });
    },
    [config, displayLabel, onConfigChange]
  );

  const dateString = now.toLocaleDateString(config.locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const btnStyle: React.CSSProperties = {
    fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)", color: "var(--btn-text)",
    cursor: "pointer", pointerEvents: "all",
    letterSpacing: "0.5px", position: "relative", zIndex: 10,
    fontFamily: "inherit",
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--widget-bg)", borderRadius: "14px",
      border: "1px solid var(--widget-border)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "var(--text-primary)", padding: "16px",
      backdropFilter: "blur(8px)", gap: "6px",
      fontSize: "var(--font-size-base)",
    }}>
      <p style={{ fontSize: "11px", opacity: 0.5, letterSpacing: "2px", textTransform: "uppercase" }}>
        {displayLabel}
      </p>
      <p style={{ fontSize: "34px", fontWeight: "700", letterSpacing: "2px", fontFamily: "monospace", lineHeight: 1 }}>
        {formatTime(now)}
      </p>
      <p style={{ fontSize: "11px", opacity: 0.55, textAlign: "center" }}>
        {dateString}
      </p>
      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
        <button style={btnStyle} onClick={handleToggleFormat}>
          {config.use24h ? "12h" : "24h"}
        </button>
        <button style={btnStyle} onClick={handleToggleLocale}>
          {config.locale === "th-TH" ? "EN" : "TH"}
        </button>
      </div>
    </div>
  );
};

export default ClockWidget;