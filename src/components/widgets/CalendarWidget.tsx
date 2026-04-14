// src/components/widgets/CalendarWidget.tsx

import React, { useState, useCallback, useMemo } from "react";
import { Widget } from "../../types/widget";

interface CalendarWidgetProps {
  widget: Widget;
}

// คืนค่าจำนวนวันในเดือนนั้น
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// คืนค่า day-of-week (0=Sun) ของวันที่ 1 ของเดือน
function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_NAMES = [
  "January", "February", "March",    "April",
  "May",     "June",     "July",     "August",
  "September","October", "November", "December",
];

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ widget }) => {
  const today = useMemo(() => new Date(), []);

  const [viewYear,  setViewYear]  = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());

  const handlePrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const handleGoToday = useCallback(() => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }, [today]);

  // คำนวณ grid — array ของ day number (0 = empty cell)
  const cells = useMemo(() => {
    const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
    const firstDayOfWeek = getFirstDayOfWeek(viewYear, viewMonth);
    const result: number[] = [];

    // padding ก่อนวันที่ 1
    for (let i = 0; i < firstDayOfWeek; i++) result.push(0);
    // วันที่จริง
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    // padding หลังวันสุดท้าย ให้ครบ 7 คอลัมน์
    while (result.length % 7 !== 0) result.push(0);

    return result;
  }, [viewYear, viewMonth]);

  const isToday = useCallback(
    (day: number) =>
      day > 0 &&
      day       === today.getDate()     &&
      viewMonth === today.getMonth()    &&
      viewYear  === today.getFullYear(),
    [today, viewMonth, viewYear]
  );

  const isCurrentMonth =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();

  // ── Styles ─────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    width:          "100%",
    height:         "100%",
    background:     "var(--widget-bg)",
    borderRadius:   "14px",
    border:         "1px solid var(--widget-border)",
    backdropFilter: "blur(12px)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
    userSelect:     "none",
  };

  const headerStyle: React.CSSProperties = {
    padding:        "10px 12px 8px",
    borderBottom:   "1px solid var(--divider)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexShrink:     0,
  };

  const navBtnStyle: React.CSSProperties = {
    background:   "none",
    border:       "1px solid var(--btn-border)",
    borderRadius: "5px",
    color:        "var(--text-secondary)",
    fontSize:     "13px",
    width:        "24px",
    height:       "24px",
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    fontFamily:   "inherit",
    padding:      0,
    flexShrink:   0,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button style={navBtnStyle} onClick={handlePrevMonth} title="Previous month">‹</button>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.2 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          {!isCurrentMonth && (
            <button
              style={{
                background:  "none",
                border:      "none",
                color:       "var(--accent-color)",
                fontSize:    "10px",
                cursor:      "pointer",
                fontFamily:  "inherit",
                padding:     0,
                marginTop:   "2px",
              }}
              onClick={handleGoToday}
            >
              Today
            </button>
          )}
        </div>

        <button style={navBtnStyle} onClick={handleNextMonth} title="Next month">›</button>
      </div>

      {/* Calendar Grid */}
      <div style={{ flex: 1, padding: "8px 10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Day Labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "4px" }}>
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              style={{
                textAlign:  "center",
                fontSize:   "10px",
                fontWeight: "700",
                color:      "var(--text-dim)",
                padding:    "2px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date Cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", flex: 1 }}>
          {cells.map((day, idx) => {
            const todayFlag = isToday(day);
            const isSun     = idx % 7 === 0;
            const isSat     = idx % 7 === 6;

            return (
              <div
                key={idx}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  borderRadius:   "50%",
                  fontSize:       "11px",
                  fontWeight:     todayFlag ? "700" : "400",
                  color: day === 0
                    ? "transparent"
                    : todayFlag
                    ? "#fff"
                    : isSun || isSat
                    ? "var(--text-secondary)"
                    : "var(--text-primary)",
                  background: todayFlag ? "var(--accent-color)" : "transparent",
                  aspectRatio: "1",
                  transition:  "background 0.15s",
                }}
              >
                {day > 0 ? day : ""}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer — label */}
      <div
        style={{
          borderTop:  "1px solid var(--divider)",
          padding:    "5px 12px",
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: "10px", color: "var(--text-dim)", textAlign: "center" }}>
          {widget.label}
        </p>
      </div>
    </div>
  );
};

export default CalendarWidget;