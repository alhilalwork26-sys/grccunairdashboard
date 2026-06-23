"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const EVENTS: Record<string, { title: string; time: string; color: string }[]> = {
  "2026-06-22": [
    { title: "Rapat koordinasi tim", time: "09.00", color: "#10b981" },
    { title: "Review progres mingguan", time: "14.00", color: "#3b82f6" },
  ],
  "2026-06-23": [
    { title: "Deadline laporan Juni", time: "17.00", color: "#f59e0b" },
  ],
  "2026-06-25": [
    { title: "Training peserta baru", time: "10.00", color: "#8b5cf6" },
    { title: "Meeting finance", time: "13.00", color: "#f59e0b" },
  ],
  "2026-06-28": [
    { title: "Onboarding klien", time: "09.00", color: "#ec4899" },
  ],
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon=0
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPanel() {
  const today = new Date();
  const [viewDate, setViewDate]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected]     = useState(today);
  const [direction, setDirection]   = useState(0);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDay     = getFirstDayOfMonth(year, month);
  const totalCells   = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  function prevMonth() {
    setDirection(-1);
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setDirection(1);
    setViewDate(new Date(year, month + 1, 1));
  }

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) =>
    d === selected.getDate() && month === selected.getMonth() && year === selected.getFullYear();

  const selectedKey = dateKey(selected.getFullYear(), selected.getMonth(), selected.getDate());
  const todayEvents = EVENTS[selectedKey] ?? [];

  const slideVariants: Variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } },
    exit:  (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2 } }),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Calendar card ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #f3f4f6",
        borderRadius: 16,
        overflow: "hidden",
        padding: "18px 16px 14px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={prevMonth}
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <ChevronLeft size={14} color="#6b7280" />
          </motion.button>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${year}-${month}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ textAlign: "center" }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                {MONTHS[month]} {year}
              </span>
            </motion.div>
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={nextMonth}
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <ChevronRight size={14} color="#6b7280" />
          </motion.button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#9ca3af", padding: "0 0 6px", letterSpacing: "0.04em" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`grid-${year}-${month}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}
          >
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - firstDay + 1;
              const isValid = dayNum >= 1 && dayNum <= daysInMonth;
              const key = isValid ? dateKey(year, month, dayNum) : null;
              const hasEvent = key ? !!EVENTS[key] : false;
              const today_ = isValid && isToday(dayNum);
              const sel_   = isValid && isSelected(dayNum);

              return (
                <motion.div
                  key={i}
                  whileHover={isValid ? { scale: 1.15 } : {}}
                  whileTap={isValid ? { scale: 0.95 } : {}}
                  onClick={() => isValid && setSelected(new Date(year, month, dayNum))}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    cursor: isValid ? "pointer" : "default",
                    background: today_
                      ? "#10b981"
                      : sel_
                      ? "#f0fdf4"
                      : "transparent",
                    border: sel_ && !today_ ? "1px solid #d1fae5" : "1px solid transparent",
                    position: "relative",
                    transition: "background 0.15s ease",
                  }}
                >
                  {isValid && (
                    <>
                      <span style={{
                        fontSize: 12,
                        fontWeight: today_ ? 700 : sel_ ? 600 : 400,
                        color: today_ ? "white" : sel_ ? "#059669" : dayNum > 0 ? "#374151" : "transparent",
                        lineHeight: 1,
                      }}>
                        {isValid ? dayNum : ""}
                      </span>
                      {hasEvent && (
                        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                          {(EVENTS[key!] ?? []).slice(0, 3).map((ev, ei) => (
                            <div
                              key={ei}
                              style={{ width: 4, height: 4, borderRadius: "50%", background: today_ ? "rgba(255,255,255,0.7)" : ev.color }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Add event button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%", marginTop: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 0", borderRadius: 10,
            background: "#111827", border: "none",
            fontSize: 12, fontWeight: 600, color: "white",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          <Plus size={13} /> Tambah Event
        </motion.button>
      </div>

      {/* ── Today's timeline ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #f3f4f6",
        borderRadius: 16,
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f9fafb" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
            {selected.getDate() === today.getDate() && selected.getMonth() === today.getMonth()
              ? "Agenda Hari Ini"
              : `Agenda ${selected.getDate()} ${MONTHS[selected.getMonth()]}`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {todayEvents.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#9ca3af" }}>Tidak ada agenda</p>
              </div>
            ) : (
              todayEvents.map((ev, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "11px 16px",
                    borderBottom: i < todayEvents.length - 1 ? "1px solid #f9fafb" : "none",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color, marginTop: 3 }} />
                    {i < todayEvents.length - 1 && (
                      <div style={{ width: 1, height: 20, background: "#f3f4f6" }} />
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", lineHeight: 1.3 }}>{ev.title}</p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{ev.time}</p>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
