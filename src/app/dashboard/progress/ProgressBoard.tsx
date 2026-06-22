"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, DailyProgress } from "@/types";
import {
  ChevronLeft, ChevronRight, Plus, X, Check,
  AlertCircle, Lightbulb, CalendarDays,
  Users, TrendingUp, Edit2, Trash2, BarChart2,
} from "lucide-react";

const MOOD_CFG = [
  { val: 1, emoji: "😢", label: "Sangat Buruk", color: "#ef4444" },
  { val: 2, emoji: "😕", label: "Kurang Baik", color: "#f97316" },
  { val: 3, emoji: "😐", label: "Biasa Saja", color: "#eab308" },
  { val: 4, emoji: "😊", label: "Baik", color: "#22c55e" },
  { val: 5, emoji: "😁", label: "Sangat Baik", color: "#10b981" },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", manager: "Manager", program_admin: "Program Admin",
  kep_marketing: "Kep. Marketing", staff_kreatif: "Staff Kreatif",
  staff_marketing: "Staff Marketing", kep_finance: "Kep. Finance",
  staff_finance: "Staff Finance", staff_dokumen: "Staff Dokumen",
  kep_trainer: "Kep. Trainer",
};

function fmt(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

const EMPTY_FORM = { activities: "", achievements: "", obstacles: "", plan_tomorrow: "", mood: 4 };

function getWeekRange(today: string) {
  const d = new Date(today + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const toStr = (dt: Date) => dt.toISOString().split("T")[0];
  return { start: toStr(mon), end: toStr(sun) };
}

interface WeekSummary {
  userId: string;
  name: string;
  role: string;
  entries: DailyProgress[];
  avgMood: number;
  totalEntries: number;
  obstacles: string[];
  hasObstacles: boolean;
}

interface Props {
  currentUser: UserProfile;
  initialEntries: DailyProgress[];
  profiles: { id: string; full_name: string; role: string }[];
  today: string;
}

export default function ProgressBoard({ currentUser, initialEntries, profiles, today }: Props) {
  const supabase = createClient();

  const [tab, setTab] = useState<"daily" | "rekap">("daily");
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<DailyProgress[]>(initialEntries);
  const [weekData, setWeekData] = useState<WeekSummary[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DailyProgress | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchEntries = useCallback(async (d: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_progress")
      .select("*, profiles(full_name, role)")
      .eq("date", d)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [supabase]);

  const changeDate = (n: number) => {
    const newDate = addDays(date, n);
    if (newDate > today) return;
    setDate(newDate);
    fetchEntries(newDate);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (e: DailyProgress) => {
    setEditing(e);
    setForm({
      activities: e.activities,
      achievements: e.achievements ?? "",
      obstacles: e.obstacles ?? "",
      plan_tomorrow: e.plan_tomorrow ?? "",
      mood: e.mood ?? 4,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.activities.trim()) return;
    setSubmitting(true);
    const payload = {
      user_id: currentUser.id,
      date,
      activities: form.activities.trim(),
      achievements: form.achievements.trim() || null,
      obstacles: form.obstacles.trim() || null,
      plan_tomorrow: form.plan_tomorrow.trim() || null,
      mood: form.mood,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("daily_progress").update(payload).eq("id", editing.id).select("*, profiles(full_name, role)").single();
      if (error) { showToast("Gagal memperbarui", false); }
      else {
        setEntries(prev => prev.map(e => e.id === editing.id ? data : e));
        showToast("Progress diperbarui");
      }
    } else {
      const { data, error } = await supabase
        .from("daily_progress").insert(payload).select("*, profiles(full_name, role)").single();
      if (error) { showToast("Gagal menyimpan", false); }
      else {
        setEntries(prev => [data, ...prev]);
        showToast("Progress ditambahkan");
      }
    }
    setSubmitting(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("daily_progress").delete().eq("id", id);
    if (error) { showToast("Gagal menghapus", false); }
    else {
      setEntries(prev => prev.filter(e => e.id !== id));
      showToast("Progress dihapus");
    }
    setDeleteId(null);
  };

  const fetchWeekData = useCallback(async () => {
    setWeekLoading(true);
    const { start, end } = getWeekRange(today);
    const { data } = await supabase
      .from("daily_progress")
      .select("*, profiles(full_name, role)")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (data) {
      const byUser: Record<string, DailyProgress[]> = {};
      data.forEach(e => {
        if (!byUser[e.user_id]) byUser[e.user_id] = [];
        byUser[e.user_id].push(e);
      });
      const summaries: WeekSummary[] = Object.entries(byUser).map(([uid, ents]) => {
        const p = profiles.find(p => p.id === uid);
        const obs = ents.filter(e => e.obstacles?.trim()).map(e => e.obstacles!.trim());
        return {
          userId: uid,
          name: p?.full_name || (ents[0]?.profiles as any)?.full_name || "—",
          role: p?.role || (ents[0]?.profiles as any)?.role || "",
          entries: ents,
          avgMood: Math.round(ents.reduce((s, e) => s + (e.mood ?? 3), 0) / ents.length),
          totalEntries: ents.length,
          obstacles: obs,
          hasObstacles: obs.length > 0,
        };
      });
      summaries.sort((a, b) => b.totalEntries - a.totalEntries);
      setWeekData(summaries);
    }
    setWeekLoading(false);
  }, [supabase, today, profiles]);

  const handleTabSwitch = (t: "daily" | "rekap") => {
    setTab(t);
    if (t === "rekap" && weekData.length === 0) fetchWeekData();
  };

  const myEntry = entries.find(e => e.user_id === currentUser.id);
  const avgMood = entries.length
    ? Math.round(entries.reduce((s, e) => s + (e.mood ?? 3), 0) / entries.length)
    : null;
  const isToday = date === today;
  const canViewAll = ["super_admin", "manager"].includes(currentUser.role);
  const canManage  = ["super_admin", "manager", "program_admin"].includes(currentUser.role);
  const { start: weekStart, end: weekEnd } = getWeekRange(today);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0, gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Daily Progress</h1>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Catat aktivitas dan pencapaian harianmu</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {canViewAll && (
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, gap: 2 }}>
              {(["daily", "rekap"] as const).map(t => (
                <motion.button key={t} whileTap={{ scale: 0.97 }}
                  onClick={() => handleTabSwitch(t)}
                  style={{
                    padding: "7px 14px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 5,
                    background: tab === t ? "#fff" : "transparent",
                    color: tab === t ? "#111827" : "#6b7280",
                    boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}>
                  {t === "daily" ? <><CalendarDays size={13} /> Harian</> : <><BarChart2 size={13} /> Rekap Mingguan</>}
                </motion.button>
              ))}
            </div>
          )}
          {tab === "daily" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
              }}>
              <Plus size={15} />
              {myEntry && isToday ? "Edit Progress Hari Ini" : "Tambah Progress"}
            </motion.button>
          )}
          {tab === "rekap" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={fetchWeekData}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb",
                borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>
              <TrendingUp size={15} /> Refresh
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Rekap Mingguan Tab */}
        {tab === "rekap" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Week range header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={16} color="#6366f1" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Rekap Mingguan Tim</span>
              </div>
              <span style={{ fontSize: 12, color: "#9ca3af", background: "#f3f4f6", padding: "4px 10px", borderRadius: 20 }}>
                {new Date(weekStart + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" })} –{" "}
                {new Date(weekEnd + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {weekLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%" }} />
              </div>
            ) : weekData.length === 0 ? (
              <div style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada progress minggu ini</p>
                <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Anggota tim belum mencatat progress untuk pekan ini</p>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Total Anggota Lapor", val: weekData.length, color: "#6366f1", bg: "#eef2ff" },
                    { label: "Total Entri Minggu Ini", val: weekData.reduce((s, d) => s + d.totalEntries, 0), color: "#10b981", bg: "#f0fdf4" },
                    { label: "Anggota Ada Hambatan", val: weekData.filter(d => d.hasObstacles).length, color: "#f59e0b", bg: "#fffbeb" },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px" }}>
                      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.val}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Per-user cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {weekData.map((u, i) => {
                    const mc = MOOD_CFG[u.avgMood - 1];
                    const isOpen = expandedUser === u.userId;
                    const pct = Math.min(100, Math.round((u.totalEntries / 5) * 100));
                    return (
                      <motion.div key={u.userId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                          onClick={() => setExpandedUser(isOpen ? null : u.userId)}>
                          <div style={{
                            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, color: "#fff",
                          }}>{u.name.charAt(0).toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{u.name}</p>
                              <span style={{ fontSize: 10, color: "#9ca3af" }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                              {u.hasObstacles && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#fffbeb", color: "#d97706" }}>
                                  Ada hambatan
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1, height: 6, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: "easeOut" }}
                                  style={{ height: "100%", background: pct >= 80 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#f59e0b", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{u.totalEntries}/5 hari</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {mc && <span title={mc.label} style={{ fontSize: 20 }}>{mc.emoji}</span>}
                            <ChevronRight size={14} color="#9ca3af" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                              style={{ overflow: "hidden" }}>
                              <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f3f4f6", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                                {u.entries.map(e => {
                                  const dm = MOOD_CFG[(e.mood ?? 3) - 1];
                                  return (
                                    <div key={e.id} style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: 10 }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1" }}>
                                          {new Date(e.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}
                                        </span>
                                        {dm && <span style={{ fontSize: 13 }}>{dm.emoji}</span>}
                                      </div>
                                      <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{e.activities}</p>
                                      {e.obstacles && (
                                        <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                                          <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {e.obstacles}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Daily Tab */}
        {tab === "daily" && <>
        {/* Date navigator + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Date nav */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
            overflow: "hidden",
          }}>
            <button
              onClick={() => changeDate(-1)}
              style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex" }}
            >
              <ChevronLeft size={16} color="#6b7280" />
            </button>
            <div style={{
              padding: "10px 20px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6",
              fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap",
            }}>
              {fmt(date)}
              {isToday && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#10b981",
                  background: "#f0fdf4", border: "1px solid #d1fae5",
                  borderRadius: 20, padding: "1px 7px",
                }}>Hari Ini</span>
              )}
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              style={{
                padding: "10px 14px", border: "none", background: "transparent",
                cursor: isToday ? "not-allowed" : "pointer", display: "flex",
                opacity: isToday ? 0.3 : 1,
              }}
            >
              <ChevronRight size={16} color="#6b7280" />
            </button>
          </div>

          {/* Mini stats */}
          <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
            {[
              { icon: <Users size={14} />, label: "Tim Lapor", val: `${entries.length} orang`, color: "#3b82f6" },
              { icon: <TrendingUp size={14} />, label: "Mood Rata-rata", val: avgMood ? MOOD_CFG[avgMood - 1]?.emoji + " " + MOOD_CFG[avgMood - 1]?.label : "—", color: "#10b981" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
                padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "#10b981", borderRadius: "50%" }}
            />
          </div>
        ) : (canViewAll ? entries : entries.filter(e => e.user_id === currentUser.id)).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16,
              padding: "60px 40px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
              {isToday ? "Belum ada progress hari ini" : "Tidak ada progress di tanggal ini"}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
              {isToday ? "Yuk, catat apa yang sudah kamu kerjakan!" : "Tim tidak mencatat progress di tanggal ini"}
            </p>
            {isToday && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={openCreate}
                style={{
                  marginTop: 20, background: "#10b981", color: "#fff", border: "none",
                  borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Tambah Progress Pertama
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <AnimatePresence mode="popLayout">
              {(canViewAll ? entries : entries.filter(e => e.user_id === currentUser.id)).map((entry, i) => {
                const moodCfg = MOOD_CFG[(entry.mood ?? 3) - 1];
                const isMe = entry.user_id === currentUser.id;
                const name = (entry.profiles as any)?.full_name || "—";
                const role = (entry.profiles as any)?.role || "";
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.06, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      background: "#fff",
                      border: isMe ? "1.5px solid #d1fae5" : "1px solid #f3f4f6",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    {/* Card header */}
                    <div style={{
                      padding: "14px 20px",
                      background: isMe ? "#f0fdf4" : "#f9fafb",
                      borderBottom: "1px solid #f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: isMe
                            ? "linear-gradient(135deg, #10b981, #059669)"
                            : "linear-gradient(135deg, #6366f1, #4f46e5)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
                        }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{name}</p>
                            {isMe && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, color: "#059669",
                                background: "#dcfce7", border: "1px solid #bbf7d0",
                                borderRadius: 20, padding: "1px 6px",
                              }}>Kamu</span>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{ROLE_LABELS[role] ?? role}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {moodCfg && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: `${moodCfg.color}12`, border: `1px solid ${moodCfg.color}30`,
                            borderRadius: 20, padding: "4px 10px",
                          }}>
                            <span style={{ fontSize: 14 }}>{moodCfg.emoji}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: moodCfg.color }}>{moodCfg.label}</span>
                          </div>
                        )}
                        {(isMe || canManage) && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              onClick={() => openEdit(entry)}
                              style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}
                            >
                              <Edit2 size={14} color="#6b7280" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              onClick={() => setDeleteId(entry.id)}
                              style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                      <Section icon={<CalendarDays size={14} />} title="Aktivitas Hari Ini" color="#3b82f6">
                        {entry.activities}
                      </Section>
                      {entry.achievements && (
                        <Section icon={<Check size={14} />} title="Pencapaian" color="#10b981">
                          {entry.achievements}
                        </Section>
                      )}
                      {entry.obstacles && (
                        <Section icon={<AlertCircle size={14} />} title="Hambatan" color="#f59e0b">
                          {entry.obstacles}
                        </Section>
                      )}
                      {entry.plan_tomorrow && (
                        <Section icon={<Lightbulb size={14} />} title="Rencana Besok" color="#8b5cf6">
                          {entry.plan_tomorrow}
                        </Section>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        </>}
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
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560,
                maxHeight: "90vh", overflow: "auto",
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                position: "sticky", top: 0, background: "#fff", zIndex: 1,
              }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {editing ? "Edit Progress" : "Tambah Daily Progress"}
                  </h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(date)}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}
                >
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Mood selector */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
                    Mood Hari Ini <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {MOOD_CFG.map(m => (
                      <motion.button
                        key={m.val}
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setForm(f => ({ ...f, mood: m.val }))}
                        style={{
                          flex: 1, padding: "10px 4px",
                          border: form.mood === m.val ? `2px solid ${m.color}` : "2px solid #e5e7eb",
                          borderRadius: 12, background: form.mood === m.val ? `${m.color}12` : "#f9fafb",
                          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{m.emoji}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: form.mood === m.val ? m.color : "#9ca3af" }}>
                          {m.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Activities */}
                <ModalField
                  label="Aktivitas Hari Ini"
                  required
                  placeholder="Jelaskan apa yang sudah kamu kerjakan hari ini..."
                  value={form.activities}
                  onChange={v => setForm(f => ({ ...f, activities: v }))}
                  rows={4}
                />
                <ModalField
                  label="Pencapaian"
                  placeholder="Apa yang berhasil kamu selesaikan atau capai?"
                  value={form.achievements}
                  onChange={v => setForm(f => ({ ...f, achievements: v }))}
                  rows={3}
                />
                <ModalField
                  label="Hambatan"
                  placeholder="Adakah kendala atau hambatan yang dihadapi?"
                  value={form.obstacles}
                  onChange={v => setForm(f => ({ ...f, obstacles: v }))}
                  rows={2}
                />
                <ModalField
                  label="Rencana Besok"
                  placeholder="Apa yang akan dikerjakan besok?"
                  value={form.plan_tomorrow}
                  onChange={v => setForm(f => ({ ...f, plan_tomorrow: v }))}
                  rows={2}
                />

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting || !form.activities.trim()}
                  style={{
                    width: "100%", padding: "12px",
                    background: submitting || !form.activities.trim()
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: submitting || !form.activities.trim() ? "not-allowed" : "pointer",
                    boxShadow: submitting || !form.activities.trim() ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {submitting ? "Menyimpan..." : editing ? "Perbarui Progress" : "Simpan Progress"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%",
                boxShadow: "0 25px 50px rgba(0,0,0,0.2)", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Progress?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                Progress ini akan dihapus permanen dan tidak bisa dikembalikan.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDeleteId(null)}
                  style={{
                    flex: 1, padding: "10px", border: "1px solid #e5e7eb",
                    borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
                  }}
                >
                  Batal
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDelete(deleteId)}
                  style={{
                    flex: 1, padding: "10px", border: "none",
                    borderRadius: 10, background: "#ef4444", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, color: "#fff",
                  }}
                >
                  Hapus
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              background: toast.ok ? "#111827" : "#ef4444",
              color: "#fff", borderRadius: 12, padding: "12px 18px",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
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

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${color}12`, display: "flex", alignItems: "center",
        justifyContent: "center", marginTop: 1,
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{children}</p>
      </div>
    </div>
  );
}

function ModalField({ label, required, placeholder, value, onChange, rows }: {
  label: string; required?: boolean; placeholder: string;
  value: string; onChange: (v: string) => void; rows: number;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px",
          border: "1.5px solid #e5e7eb", borderRadius: 10,
          fontSize: 13, color: "#111827", resize: "vertical",
          outline: "none", fontFamily: "inherit", lineHeight: 1.6,
          transition: "border-color 0.15s ease", boxSizing: "border-box",
          background: "#fafafa",
        }}
        onFocus={e => (e.target.style.borderColor = "#10b981")}
        onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
      />
    </div>
  );
}
