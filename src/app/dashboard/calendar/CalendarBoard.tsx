"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, CalendarEvent } from "@/types";
import { ChevronLeft, ChevronRight, Plus, X, Check, Clock, Calendar, CalendarDays, Trash2, AlertTriangle } from "lucide-react";

const TYPE_CFG = {
  meeting:  { label: "Meeting",   color: "#3b82f6", bg: "#eff6ff" },
  deadline: { label: "Deadline",  color: "#ef4444", bg: "#fef2f2" },
  event:    { label: "Event",     color: "#8b5cf6", bg: "#f5f3ff" },
  holiday:  { label: "Libur",     color: "#10b981", bg: "#f0fdf4" },
  training: { label: "Training",  color: "#f59e0b", bg: "#fffbeb" },
};

const DAYS   = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function toLocal(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  title: "", description: "", start_date: "",
  end_date: "", start_time: "", end_time: "",
  type: "meeting" as CalendarEvent["type"],
};

interface Props {
  currentUser: UserProfile;
  initialEvents: CalendarEvent[];
}

export default function CalendarBoard({ currentUser, initialEvents }: Props) {
  const supabase = createClient();
  const canManage = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"].includes(currentUser.role);

  const today = fmt(new Date());
  const todayYear  = new Date().getFullYear();
  const todayMonth = new Date().getMonth();

  const [year, setYear]           = useState(todayYear);
  const [month, setMonth]         = useState(todayMonth);
  const [events, setEvents]       = useState<CalendarEvent[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<CalendarEvent | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [direction, setDirection] = useState(1);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchEvents = useCallback(async (y: number, m: number) => {
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;
    const { data } = await supabase
      .from("events").select("*, profiles(full_name)")
      .or(`start_date.gte.${start},end_date.gte.${start}`)
      .lte("start_date", end)
      .order("start_date");
    setEvents(data ?? []);
  }, [supabase]);

  const changeMonth = (delta: number) => {
    setDirection(delta);
    let m = month + delta;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m);
    setYear(y);
    fetchEvents(y, m);
  };

  const goToToday = () => {
    const delta = todayMonth - month + (todayYear - year) * 12;
    setDirection(delta >= 0 ? 1 : -1);
    setMonth(todayMonth);
    setYear(todayYear);
    setSelectedDate(today);
    fetchEvents(todayYear, todayMonth);
  };

  const isCurrentMonthView = year === todayYear && month === todayMonth;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Build eventsByDate including multi-day events on every day they span
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach(e => {
    const startD = toLocal(e.start_date);
    const endD   = e.end_date ? toLocal(e.end_date) : startD;
    let cur = new Date(startD);
    while (cur <= endD) {
      const ds = fmt(cur);
      if (!eventsByDate[ds]) eventsByDate[ds] = [];
      if (!eventsByDate[ds].find(ev => ev.id === e.id)) {
        eventsByDate[ds].push(e);
      }
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  });

  // For the side panel: events active on selectedDate (started on or before, ending on or after)
  const selectedEvents = selectedDate
    ? (eventsByDate[selectedDate] ?? []).sort((a, b) => {
        // sort: events starting today first, then ongoing from earlier
        if (a.start_date === selectedDate && b.start_date !== selectedDate) return -1;
        if (b.start_date === selectedDate && a.start_date !== selectedDate) return 1;
        return (a.start_time ?? "").localeCompare(b.start_time ?? "");
      })
    : [];

  const openCreate = (date?: string) => {
    setEditing(null);
    setFormError(null);
    setForm({ ...EMPTY_FORM, start_date: date ?? today });
    setShowModal(true);
  };

  const openEdit = (e: CalendarEvent) => {
    setEditing(e);
    setFormError(null);
    setForm({
      title: e.title, description: e.description ?? "",
      start_date: e.start_date, end_date: e.end_date ?? "",
      start_time: e.start_time ?? "", end_time: e.end_time ?? "",
      type: e.type,
    });
    setShowModal(true);
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return "Judul wajib diisi";
    if (!form.start_date)   return "Tanggal mulai wajib diisi";
    if (form.end_date && form.end_date < form.start_date)
      return "Tanggal selesai tidak boleh sebelum tanggal mulai";
    if (form.start_time && form.end_time && form.end_date === form.start_date && form.end_time < form.start_time)
      return "Waktu selesai tidak boleh sebelum waktu mulai";
    return null;
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      type: form.type,
      created_by: currentUser.id,
    };
    if (editing) {
      const { data, error } = await supabase.from("events").update(payload).eq("id", editing.id)
        .select("*, profiles(full_name)").single();
      if (error) showToast("Gagal memperbarui", false);
      else { setEvents(prev => prev.map(e => e.id === editing.id ? data : e)); showToast("Event diperbarui"); }
    } else {
      const { data, error } = await supabase.from("events").insert(payload)
        .select("*, profiles(full_name)").single();
      if (error) showToast("Gagal menyimpan", false);
      else {
        setEvents(prev => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
        showToast("Event ditambahkan");
      }
    }
    setSubmitting(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) showToast("Gagal menghapus", false);
    else {
      setEvents(prev => prev.filter(e => e.id !== id));
      setDeleteConfirm(null);
      showToast("Event dihapus");
    }
  };

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  // Count events starting this month (for header subtitle)
  const monthEventsCount = events.filter(e => e.start_date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
          }}>
            <Calendar size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Kalender</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{monthEventsCount} event dimulai bulan ini</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isCurrentMonthView && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={goToToday}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 10,
                background: "#f5f3ff", border: "1px solid #ede9fe",
                color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <CalendarDays size={14} /> Hari Ini
            </motion.button>
          )}
          {canManage && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => openCreate(selectedDate)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
              }}
            >
              <Plus size={15} /> Tambah Event
            </motion.button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Calendar grid */}
        <div style={{ flex: 1, padding: 24, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Month nav */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => changeMonth(-1)}
                style={{ padding: 8, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}
              >
                <ChevronLeft size={16} color="#6b7280" />
              </motion.button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.h2
                    key={`${year}-${month}`}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}
                  >
                    {MONTHS[month]} {year}
                  </motion.h2>
                </AnimatePresence>
                {isCurrentMonthView && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", padding: "2px 7px", borderRadius: 20, border: "1px solid #ede9fe" }}>
                    Bulan ini
                  </span>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => changeMonth(1)}
                style={{ padding: 8, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}
              >
                <ChevronRight size={16} color="#6b7280" />
              </motion.button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
              {DAYS.map((d, i) => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#9ca3af", padding: "4px 0" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${year}-${month}-grid`}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}
              >
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday    = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  const dayEvents  = eventsByDate[dateStr] ?? [];
                  const isSunday   = i % 7 === 0;
                  const isSaturday = i % 7 === 6;

                  return (
                    <motion.button
                      key={dateStr}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      onDoubleClick={() => canManage && openCreate(dateStr)}
                      onClick={() => setSelectedDate(dateStr)}
                      title={canManage ? "Klik untuk pilih · Klik 2x untuk tambah event" : undefined}
                      style={{
                        position: "relative", padding: "8px 4px",
                        border: isSelected ? "2px solid #8b5cf6" : "1.5px solid transparent",
                        borderRadius: 10,
                        background: isToday ? "#f5f3ff" : isSelected ? "#faf5ff" : "transparent",
                        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        minHeight: 56,
                      }}
                    >
                      <span style={{
                        fontSize: 13, fontWeight: isToday ? 800 : isSelected ? 700 : 500,
                        width: 26, height: 26, borderRadius: "50%",
                        background: isToday ? "#8b5cf6" : isSelected ? "#ede9fe" : "transparent",
                        color: isToday
                          ? "#fff"
                          : isSelected
                            ? "#6d28d9"
                            : isSunday
                              ? "#ef4444"
                              : isSaturday
                                ? "#3b82f6"
                                : "#374151",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                          {dayEvents.slice(0, 3).map(e => (
                            <div
                              key={e.id}
                              style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: TYPE_CFG[e.type]?.color ?? "#9ca3af",
                              }}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700 }}>+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(TYPE_CFG).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />
                <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{v.label}</span>
              </div>
            ))}
            {canManage && (
              <span style={{ fontSize: 11, color: "#d1d5db", marginLeft: "auto" }}>
                Klik 2× pada tanggal untuk tambah event
              </span>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 300, flexShrink: 0, background: "#fff",
          borderLeft: "1px solid #f3f4f6", padding: 20,
          overflow: "auto", display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {selectedDate
                ? toLocal(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
                : "Pilih tanggal"}
            </p>
            {canManage && selectedDate && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => openCreate(selectedDate)}
                style={{
                  marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px", border: "1.5px dashed #d1d5db", borderRadius: 10,
                  background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#9ca3af",
                }}
              >
                <Plus size={13} /> Tambah Event
              </motion.button>
            )}
          </div>

          {selectedEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Tidak ada event</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {selectedEvents.map((e, i) => {
                const cfg = TYPE_CFG[e.type];
                const isOngoing = e.start_date !== selectedDate;
                const isDeleteTarget = deleteConfirm === e.id;
                return (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.06, duration: 0.22 }}
                    style={{
                      borderLeft: `3px solid ${cfg.color}`,
                      background: isDeleteTarget ? "#fef2f2" : cfg.bg,
                      borderRadius: "0 10px 10px 0",
                      padding: "12px 14px",
                      border: isDeleteTarget ? `1px solid #fecaca` : `1px solid transparent`,
                      borderLeftWidth: 3,
                      borderLeftColor: cfg.color,
                      transition: "background 0.2s",
                    }}
                  >
                    {isDeleteTarget ? (
                      /* Confirm delete UI */
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <AlertTriangle size={13} color="#ef4444" />
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>Hapus event ini?</p>
                        </div>
                        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.4 }}>
                          &ldquo;{e.title}&rdquo; akan dihapus permanen.
                        </p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleDelete(e.id)}
                            style={{
                              flex: 1, padding: "7px", borderRadius: 8,
                              background: "#ef4444", border: "none", color: "#fff",
                              fontSize: 12, fontWeight: 700, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}
                          >
                            <Trash2 size={11} /> Hapus
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setDeleteConfirm(null)}
                            style={{
                              flex: 1, padding: "7px", borderRadius: 8,
                              background: "#f3f4f6", border: "none", color: "#6b7280",
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            Batal
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {cfg.label}
                            </span>
                            {isOngoing && (
                              <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>
                                berlangsung
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{e.title}</p>
                          {e.description && e.description.replace(/\[ts:[^\]]+\]/g, "").trim() && (
                            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                              {e.description.replace(/\[ts:[^\]]+\]/g, "").trim()}
                            </p>
                          )}
                          {isOngoing && (
                            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                              Mulai {toLocal(e.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              {e.end_date && ` · Selesai ${toLocal(e.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                            </p>
                          )}
                          {(e.start_time || e.end_time) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                              <Clock size={10} color={cfg.color} />
                              <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>
                                {e.start_time?.slice(0, 5)} {e.end_time ? `– ${e.end_time.slice(0, 5)}` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        {canManage && (
                          <div style={{ display: "flex", gap: 2, marginLeft: 8, flexShrink: 0 }}>
                            <motion.button
                              whileHover={{ background: "#ede9fe" }} whileTap={{ scale: 0.93 }}
                              onClick={() => openEdit(e)}
                              style={{ width: 26, height: 26, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s" }}
                            >
                              <span style={{ fontSize: 13 }}>✏️</span>
                            </motion.button>
                            <motion.button
                              whileHover={{ background: "#fef2f2" }} whileTap={{ scale: 0.93 }}
                              onClick={() => setDeleteConfirm(e.id)}
                              style={{ width: 26, height: 26, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s" }}
                            >
                              <Trash2 size={13} color="#ef4444" />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Upcoming events */}
          {(() => {
            const upcoming = events
              .filter(e => e.start_date > (selectedDate ?? today))
              .slice(0, 5);
            if (!upcoming.length) return null;
            return (
              <div style={{ marginTop: 8, borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  Upcoming
                </p>
                {upcoming.map(e => {
                  const cfg = TYPE_CFG[e.type];
                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        // Navigate to event month if needed
                        const evYear  = parseInt(e.start_date.slice(0, 4));
                        const evMonth = parseInt(e.start_date.slice(5, 7)) - 1;
                        if (evYear !== year || evMonth !== month) {
                          const delta = (evYear - year) * 12 + (evMonth - month);
                          setDirection(delta > 0 ? 1 : -1);
                          setYear(evYear);
                          setMonth(evMonth);
                          fetchEvents(evYear, evMonth);
                        }
                        setSelectedDate(e.start_date);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                        borderBottom: "1px solid #f9fafb", cursor: "pointer",
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{e.title}</p>
                        <p style={{ fontSize: 10, color: "#9ca3af" }}>
                          {toLocal(e.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          {e.end_date && e.end_date !== e.start_date && ` – ${toLocal(e.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)", overflow: "auto", maxHeight: "90vh",
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                position: "sticky", top: 0, background: "#fff", zIndex: 1,
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  {editing ? "Edit Event" : "Tambah Event"}
                </h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Validation error */}
                <AnimatePresence>
                  {formError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <AlertTriangle size={13} color="#ef4444" />
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Type */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Tipe</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(Object.entries(TYPE_CFG) as [CalendarEvent["type"], typeof TYPE_CFG[keyof typeof TYPE_CFG]][]).map(([k, v]) => (
                      <motion.button
                        key={k} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setForm(f => ({ ...f, type: k }))}
                        style={{
                          padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                          border: form.type === k ? `1.5px solid ${v.color}` : "1.5px solid #e5e7eb",
                          background: form.type === k ? v.bg : "#f9fafb",
                          fontSize: 12, fontWeight: 600,
                          color: form.type === k ? v.color : "#9ca3af",
                          transition: "all 0.12s",
                        }}
                      >{v.label}</motion.button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Judul <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text" placeholder="Nama event..." value={form.title}
                    onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormError(null); }}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#8b5cf6")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                {/* Dates */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Tanggal Mulai *", key: "start_date" },
                    { label: "Tanggal Selesai",  key: "end_date" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input
                        type="date" value={(form as Record<string, string>)[f.key]}
                        min={f.key === "end_date" ? form.start_date : undefined}
                        onChange={e => { setForm(prev => ({ ...prev, [f.key]: e.target.value })); setFormError(null); }}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        onFocus={e => (e.target.style.borderColor = "#8b5cf6")}
                        onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                      />
                    </div>
                  ))}
                </div>

                {/* Times */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Waktu Mulai",   key: "start_time" },
                    { label: "Waktu Selesai", key: "end_time" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input
                        type="time" value={(form as Record<string, string>)[f.key]}
                        onChange={e => { setForm(prev => ({ ...prev, [f.key]: e.target.value })); setFormError(null); }}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        onFocus={e => (e.target.style.borderColor = "#8b5cf6")}
                        onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                      />
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea
                    rows={3} placeholder="Deskripsi event (opsional)..." value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#8b5cf6")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.start_date}
                  style={{
                    width: "100%", padding: "12px",
                    background: submitting || !form.title.trim() || !form.start_date
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 14px rgba(139,92,246,0.3)", transition: "all 0.2s",
                  }}
                >
                  {submitting ? (
                    <><div className="spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%" }} /> Menyimpan...</>
                  ) : (
                    <><Check size={14} /> {editing ? "Perbarui Event" : "Simpan Event"}</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              background: toast.ok ? "#111827" : "#ef4444",
              color: "#fff", borderRadius: 12, padding: "12px 18px",
              fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
