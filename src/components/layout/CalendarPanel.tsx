"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/types";
import { useRouter } from "next/navigation";

const DAYS   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TYPE_COLOR: Record<CalendarEvent["type"], string> = {
  meeting:  "#3b82f6",
  deadline: "#ef4444",
  event:    "#8b5cf6",
  holiday:  "#10b981",
  training: "#f59e0b",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}
function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default function CalendarPanel() {
  const router  = useRouter();
  const supabase = createClient();

  const today = new Date();
  const [viewDate, setViewDate]   = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected]   = useState(today);
  const [direction, setDirection] = useState(0);
  const [events, setEvents]       = useState<CalendarEvent[]>([]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Fetch all events once on mount
  useEffect(() => {
    supabase.from("events").select("*").order("start_date").order("start_time")
      .then(({ data }) => { if (data) setEvents(data); });
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase.channel("calendar-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        supabase.from("events").select("*").order("start_date").order("start_time")
          .then(({ data }) => { if (data) setEvents(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.start_date]) map[ev.start_date] = [];
      map[ev.start_date].push(ev);
    }
    return map;
  }, [events]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  function prevMonth() { setDirection(-1); setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setDirection(1);  setViewDate(new Date(year, month + 1, 1)); }

  const isToday    = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) => d === selected.getDate() && month === selected.getMonth() && year === selected.getFullYear();

  const selectedKey  = dateKey(selected.getFullYear(), selected.getMonth(), selected.getDate());
  const selectedEvts = eventsByDate[selectedKey] ?? [];

  const slideVariants: Variants = {
    enter:  (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } },
    exit:   (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2 } }),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Calendar card */}
      <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, overflow: "hidden", padding: "18px 16px 14px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth}
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={14} color="#6b7280" />
          </motion.button>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={`${year}-${month}`} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" style={{ textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{MONTHS[month]} {year}</span>
            </motion.div>
          </AnimatePresence>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth}
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronRight size={14} color="#6b7280" />
          </motion.button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#9ca3af", padding: "0 0 6px", letterSpacing: "0.04em" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={`grid-${year}-${month}`} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum  = i - firstDay + 1;
              const isValid = dayNum >= 1 && dayNum <= daysInMonth;
              const key     = isValid ? dateKey(year, month, dayNum) : null;
              const dayEvts = key ? (eventsByDate[key] ?? []) : [];
              const today_  = isValid && isToday(dayNum);
              const sel_    = isValid && isSelected(dayNum);

              return (
                <motion.div key={i}
                  whileHover={isValid ? { scale: 1.15 } : {}}
                  whileTap={isValid ? { scale: 0.95 } : {}}
                  onClick={() => isValid && setSelected(new Date(year, month, dayNum))}
                  style={{
                    width: "100%", aspectRatio: "1",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    borderRadius: 8, cursor: isValid ? "pointer" : "default",
                    background: today_ ? "#10b981" : sel_ ? "#f0fdf4" : "transparent",
                    border: sel_ && !today_ ? "1px solid #d1fae5" : "1px solid transparent",
                    position: "relative", transition: "background 0.15s ease",
                  }}
                >
                  {isValid && (
                    <>
                      <span style={{ fontSize: 12, fontWeight: today_ ? 700 : sel_ ? 600 : 400, color: today_ ? "#fff" : sel_ ? "#059669" : "#374151", lineHeight: 1 }}>
                        {dayNum}
                      </span>
                      {dayEvts.length > 0 && (
                        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                          {dayEvts.slice(0, 3).map((ev, ei) => (
                            <div key={ei} style={{ width: 4, height: 4, borderRadius: "50%", background: today_ ? "rgba(255,255,255,0.7)" : TYPE_COLOR[ev.type] }} />
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

        {/* Tambah Event */}
        <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/dashboard/calendar")}
          style={{
            width: "100%", marginTop: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 0", borderRadius: 10, background: "#111827", border: "none",
            fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}>
          <Plus size={13} /> Tambah Event
        </motion.button>
      </div>

      {/* Agenda panel */}
      <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f9fafb" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
            {selected.getDate() === today.getDate() && selected.getMonth() === today.getMonth()
              ? "Agenda Hari Ini"
              : `Agenda ${selected.getDate()} ${MONTHS[selected.getMonth()]}`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={selectedKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
            {selectedEvts.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#9ca3af" }}>Tidak ada agenda</p>
              </div>
            ) : (
              selectedEvts.map((ev, i) => (
                <motion.div key={ev.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", borderBottom: i < selectedEvts.length - 1 ? "1px solid #f9fafb" : "none" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[ev.type], marginTop: 3 }} />
                    {i < selectedEvts.length - 1 && <div style={{ width: 1, height: 20, background: "#f3f4f6" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                    {ev.start_time && (
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                        {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ""}
                      </p>
                    )}
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
