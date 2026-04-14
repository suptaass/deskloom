// src/components/widgets/HabitTrackerWidget.tsx

import React, { useState, useCallback, useMemo } from "react";
import { Widget } from "../../types/widget";

// ── Types ──────────────────────────────────────────────────────────────────

interface Habit {
  id: string;
  name: string;
  completedDates: string[]; // format: "YYYY-MM-DD"
}

interface HabitTrackerWidgetProps {
  widget: Widget;
  onUpdateData: (widgetId: string, data: Record<string, unknown>) => void;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** คืน string วันนี้ format "YYYY-MM-DD" */
function getTodayStr(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}

/** คืน string ของ Date object ที่รับมา format "YYYY-MM-DD" */
function getDateStr(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}

/**
 * คำนวณ streak: นับวันที่ทำต่อเนื่องย้อนหลังจากวันนี้
 * ถ้าวันนี้ยังไม่ได้ทำ แต่เมื่อวานทำ → streak ยังนับอยู่
 */
function calcStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  // ถ้าวันนี้ยังไม่ทำ → เริ่มนับจากเมื่อวาน
  if (!set.has(getDateStr(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (set.has(getDateStr(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getHabits(widget: Widget): Habit[] {
  const raw = widget.data.habits;
  if (!Array.isArray(raw)) return [];
  return raw as Habit[];
}

// ── Calendar helpers ───────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Component ──────────────────────────────────────────────────────────────

const HabitTrackerWidget: React.FC<HabitTrackerWidgetProps> = ({
  widget,
  onUpdateData,
}) => {
  const today  = getTodayStr();
  const habits = getHabits(widget);

  const [isAdding,        setIsAdding]        = useState(false);
  const [newName,         setNewName]         = useState("");
  const [addError,        setAddError]        = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Calendar navigation — เริ่มที่เดือนปัจจุบัน
  const now = useMemo(() => new Date(), []);
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // ── Callbacks ────────────────────────────────────────────────────────────

  const saveHabits = useCallback(
    (updated: Habit[]) => {
      onUpdateData(widget.id, { ...widget.data, habits: updated });
    },
    [widget.id, widget.data, onUpdateData]
  );

  /** Toggle เช็ควันนี้ของ habit ตัวที่เลือก */
  const handleToggleToday = useCallback(
    (habitId: string) => {
      const updated = habits.map((h) => {
        if (h.id !== habitId) return h;
        const doneToday = h.completedDates.includes(today);
        return {
          ...h,
          completedDates: doneToday
            ? h.completedDates.filter((d) => d !== today)
            : [...h.completedDates, today],
        };
      });
      saveHabits(updated);
    },
    [habits, today, saveHabits]
  );

  const handleAddHabit = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) { setAddError("Name is required"); return; }
    if (habits.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError("Habit already exists");
      return;
    }
    saveHabits([
      ...habits,
      { id: crypto.randomUUID(), name: trimmed, completedDates: [] },
    ]);
    setNewName("");
    setAddError("");
    setIsAdding(false);
  }, [newName, habits, saveHabits]);

  const handleCancelAdd = useCallback(() => {
    setNewName("");
    setAddError("");
    setIsAdding(false);
  }, []);

  const handleDeleteHabit = useCallback(
    (habitId: string) => {
      saveHabits(habits.filter((h) => h.id !== habitId));
      if (selectedHabitId === habitId) setSelectedHabitId(null);
    },
    [habits, selectedHabitId, saveHabits]
  );

  /** คลิกชื่อ habit → toggle calendar ด้านล่าง */
  const handleSelectHabit = useCallback((habitId: string) => {
    setSelectedHabitId((prev) => (prev === habitId ? null : habitId));
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  }, [now]);

  const handleCalPrev = useCallback(() => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else                { setCalMonth((m) => m - 1); }
  }, [calMonth]);

  const handleCalNext = useCallback(() => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else                 { setCalMonth((m) => m + 1); }
  }, [calMonth]);

  // ── Derived: calendar cells ───────────────────────────────────────────────

  const calendarData = useMemo(() => {
    const habit = habits.find((h) => h.id === selectedHabitId);
    if (!habit) return null;

    const completedSet  = new Set(habit.completedDates);
    const daysInMonth   = getDaysInMonth(calYear, calMonth);
    const firstDay      = getFirstDayOfWeek(calYear, calMonth);

    const cells: Array<{
      day: number;
      completed: boolean;
      isToday: boolean;
    }> = [];

    // padding ก่อนวันที่ 1
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: 0, completed: false, isToday: false });
    }
    // วันจริง
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr =
        `${calYear}-` +
        `${String(calMonth + 1).padStart(2, "0")}-` +
        `${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        completed: completedSet.has(dateStr),
        isToday:   dateStr === today,
      });
    }
    // padding หลัง
    while (cells.length % 7 !== 0) {
      cells.push({ day: 0, completed: false, isToday: false });
    }

    return { cells, habitName: habit.name };
  }, [selectedHabitId, habits, calYear, calMonth, today]);

  // ── Styles ────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    width: "100%", height: "100%",
    background:     "var(--widget-bg)",
    borderRadius:   "14px",
    border:         "1px solid var(--widget-border)",
    backdropFilter: "blur(12px)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
  };

  const btnStyle: React.CSSProperties = {
    padding:     "4px 10px",
    borderRadius:"5px",
    border:      "1px solid var(--btn-border)",
    background:  "var(--btn-bg)",
    color:       "var(--btn-text)",
    fontSize:    "11px",
    cursor:      "pointer",
    fontFamily:  "inherit",
  };

  const inputStyle: React.CSSProperties = {
    flex:        1,
    padding:     "5px 8px",
    borderRadius:"5px",
    border:      "1px solid var(--input-border)",
    background:  "var(--input-bg)",
    color:       "var(--text-primary)",
    fontSize:    "12px",
    outline:     "none",
    fontFamily:  "inherit",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>

      {/* ── Header ── */}
      <div style={{
        padding:        "10px 12px 8px",
        borderBottom:   "1px solid var(--divider)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        flexShrink:     0,
      }}>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
          🔥 {widget.label}
        </span>
        {!isAdding && (
          <button
            style={{ ...btnStyle, borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
            onClick={() => setIsAdding(true)}
          >
            + Add
          </button>
        )}
      </div>

      {/* ── Add Form ── */}
      {isAdding && (
        <div style={{
          padding:      "8px 12px",
          borderBottom: "1px solid var(--divider)",
          flexShrink:   0,
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Exercise"
              value={newName}
              maxLength={40}
              autoFocus
              onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter")  handleAddHabit();
                if (e.key === "Escape") handleCancelAdd();
              }}
            />
            <button style={btnStyle} onClick={handleCancelAdd}>✕</button>
            <button
              style={{ ...btnStyle, borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
              onClick={handleAddHabit}
            >
              ✓
            </button>
          </div>
          {addError && (
            <p style={{ fontSize: "11px", color: "var(--accent-red)", marginTop: "4px" }}>
              {addError}
            </p>
          )}
        </div>
      )}

      {/* ── Habit List ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px" }}>
        {habits.length === 0 && (
          <p style={{
            fontSize:  "12px",
            color:     "var(--text-secondary)",
            textAlign: "center",
            marginTop: "16px",
          }}>
            No habits yet.{"\n"}Click + Add to start.
          </p>
        )}

        {habits.map((habit) => {
          const doneToday  = habit.completedDates.includes(today);
          const streak     = calcStreak(habit.completedDates);
          const isSelected = selectedHabitId === habit.id;

          return (
            <div
              key={habit.id}
              style={{
                display:     "flex",
                alignItems:  "center",
                gap:         "8px",
                padding:     "7px 8px",
                borderRadius:"7px",
                marginBottom:"4px",
                border:      `1px solid ${isSelected ? "var(--accent-color)" : "var(--note-border)"}`,
                background:  isSelected
                  ? "color-mix(in srgb, var(--accent-color) 8%, transparent)"
                  : "var(--input-bg)",
                transition:  "border-color 0.15s, background 0.15s",
              }}
            >
              {/* Checkbox — toggle วันนี้ */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleToday(habit.id); }}
                title={doneToday ? "Unmark today" : "Mark done today"}
                style={{
                  width:          "18px",
                  height:         "18px",
                  borderRadius:   "4px",
                  flexShrink:     0,
                  border:         `2px solid ${doneToday ? "var(--accent-color)" : "var(--checkbox-border)"}`,
                  background:     doneToday
                    ? "color-mix(in srgb, var(--accent-color) 30%, transparent)"
                    : "transparent",
                  color:          doneToday ? "var(--accent-color)" : "transparent",
                  fontSize:       "11px",
                  cursor:         "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  padding:        0,
                  transition:     "border-color 0.15s, background 0.15s",
                }}
              >
                {doneToday ? "✓" : ""}
              </button>

              {/* ชื่อ habit — คลิกเพื่อ toggle calendar */}
              <span
                onClick={() => handleSelectHabit(habit.id)}
                style={{
                  flex:         1,
                  fontSize:     "12px",
                  color:        "var(--text-primary)",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                  cursor:       "pointer",
                }}
              >
                {habit.name}
              </span>

              {/* Streak counter */}
              <span style={{
                fontSize:  "11px",
                flexShrink:0,
                color:     streak > 0 ? "var(--accent-color)" : "var(--text-dim)",
                fontWeight: streak > 0 ? "700" : "400",
              }}>
                {streak > 0 ? `🔥 ${streak}` : "—"}
              </span>

              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                style={{
                  ...btnStyle,
                  padding:     "1px 6px",
                  fontSize:    "10px",
                  flexShrink:  0,
                  borderColor: "var(--accent-red-border)",
                  color:       "var(--accent-red)",
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Mini Calendar — แสดงเมื่อคลิกชื่อ habit ── */}
      {calendarData && (
        <div style={{
          borderTop:  "1px solid var(--divider)",
          padding:    "8px 10px",
          flexShrink: 0,
        }}>
          {/* Calendar header */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            marginBottom:   "6px",
          }}>
            <button
              style={{ ...btnStyle, padding: "1px 7px", fontSize: "12px" }}
              onClick={handleCalPrev}
            >
              ‹
            </button>
            <span style={{
              fontSize:   "10px",
              fontWeight: "700",
              color:      "var(--text-secondary)",
            }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </span>
            <button
              style={{ ...btnStyle, padding: "1px 7px", fontSize: "12px" }}
              onClick={handleCalNext}
            >
              ›
            </button>
          </div>

          {/* Day labels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "2px" }}>
            {DAY_LABELS.map((d) => (
              <div key={d} style={{
                textAlign:  "center",
                fontSize:   "9px",
                fontWeight: "700",
                color:      "var(--text-dim)",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {calendarData.cells.map((cell, idx) => (
              <div
                key={idx}
                style={{
                  aspectRatio:    "1",
                  borderRadius:   "50%",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       "9px",
                  fontWeight:     cell.isToday ? "700" : "400",
                  // completed → accent fill, today → accent border, อื่นๆ → transparent
                  background: cell.day === 0      ? "transparent"
                    : cell.completed              ? "var(--accent-color)"
                    : cell.isToday               ? "var(--input-bg)"
                    :                              "transparent",
                  color: cell.day === 0           ? "transparent"
                    : cell.completed              ? "#fff"
                    : cell.isToday               ? "var(--text-primary)"
                    :                              "var(--text-secondary)",
                  border: cell.isToday && !cell.completed
                    ? "1px solid var(--accent-color)"
                    : "1px solid transparent",
                }}
              >
                {cell.day > 0 ? cell.day : ""}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default HabitTrackerWidget;