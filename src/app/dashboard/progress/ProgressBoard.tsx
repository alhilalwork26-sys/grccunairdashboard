"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, DailyProgress } from "@/types";
import {
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Lightbulb,
  CalendarDays, Users, TrendingUp, Edit2, BarChart2,
  Lock, ChevronDown,
} from "lucide-react";

const MOOD_CFG = [
  { val: 1, emoji: "😢", label: "Sangat Buruk", color: "#ef4444" },
  { val: 2, emoji: "😕", label: "Kurang Baik",  color: "#f97316" },
  { val: 3, emoji: "😐", label: "Biasa Saja",   color: "#eab308" },
  { val: 4, emoji: "😊", label: "Baik",          color: "#22c55e" },
  { val: 5, emoji: "😁", label: "Sangat Baik",  color: "#10b981" },
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
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + n));
  return result.toISOString().split("T")[0];
}

function getWeekRange(today: string) {
  const d = new Date(today + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const toStr = (dt: Date) => dt.toISOString().split("T")[0];
  return { start: toStr(mon), end: toStr(sun) };
}

type PhaseStatus = "active" | "done" | "missed" | "locked_future" | "past_view";

function getMorningStatus(isToday: boolean, hour: number, entry?: DailyProgress | null): PhaseStatus {
  if (!isToday) return "past_view";
  if (entry?.morning_plan) return "done";
  return hour < 11 ? "active" : "missed";
}

function getEveningStatus(isToday: boolean, hour: number, entry?: DailyProgress | null): PhaseStatus {
  if (!isToday) return "past_view";
  if (entry?.activities) return "done";
  if (hour < 12) return "locked_future";
  return hour < 18 ? "active" : "missed";
}

const PHASE_CFG = {
  morning: {
    icon: "🌅", title: "Rencana Pagi", deadline: "Batas 11.00 WIB",
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", activeColor: "#d97706",
    cta: "✍️  Tulis Rencana Pagi",
    hint: "Tuliskan rencana dan targetmu sebelum jam 11.00 pagi.",
  },
  evening: {
    icon: "🌆", title: "Update Sore", deadline: "Batas 18.00 WIB",
    color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", activeColor: "#4f46e5",
    cta: "📝  Tulis Update Sore",
    hint: "Bagikan aktivitas dan pencapaianmu hari ini sebelum jam 18.00.",
  },
};

const EMPTY_MORNING = { morning_plan: "" };
const EMPTY_EVENING = { activities: "", achievements: "", obstacles: "", plan_tomorrow: "", mood: 4 };

interface WeekSummary {
  userId: string; name: string; role: string;
  entries: DailyProgress[]; avgMood: number;
  totalEntries: number; obstacles: string[]; hasObstacles: boolean;
}

interface Props {
  currentUser: UserProfile;
  initialEntries: DailyProgress[];
  profiles: { id: string; full_name: string; role: string }[];
  today: string;
}

export default function ProgressBoard({ currentUser, initialEntries, profiles, today }: Props) {
  const supabase = createClient();

  const [tab, setTab]             = useState<"daily" | "rekap">("daily");
  const [date, setDate]           = useState(today);
  const [entries, setEntries]     = useState<DailyProgress[]>(initialEntries);
  const [weekData, setWeekData]   = useState<WeekSummary[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [morningOpen, setMorningOpen] = useState(false);
  const [eveningOpen, setEveningOpen] = useState(false);
  const [morningForm, setMorningForm] = useState(EMPTY_MORNING);
  const [eveningForm, setEveningForm] = useState(EMPTY_EVENING);
  const [submitting, setSubmitting]   = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const isToday = date === today;
  const now = new Date();
  const currentHour = isToday ? now.getHours() + now.getMinutes() / 60 : 0;
  const canViewAll  = ["super_admin", "manager"].includes(currentUser.role);
  const isSuperAdmin = currentUser.role === "super_admin";

  const myEntry = entries.find(e => e.user_id === currentUser.id);
  const morningStatus = getMorningStatus(isToday, currentHour, myEntry);
  const eveningStatus = getEveningStatus(isToday, currentHour, myEntry);

  const fetchEntries = useCallback(async (d: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_progress").select("*, profiles(full_name, role)")
      .eq("date", d).order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [supabase]);

  const changeDate = (n: number) => {
    const newDate = addDays(date, n);
    if (newDate > today) return;
    setDate(newDate);
    fetchEntries(newDate);
  };

  // ── Morning ──
  const openMorning = () => {
    setMorningForm({ morning_plan: myEntry?.morning_plan ?? "" });
    setMorningOpen(true);
  };

  const saveMorning = async () => {
    if (!morningForm.morning_plan.trim()) return;
    setSubmitting(true);
    if (myEntry) {
      const { data, error } = await supabase.from("daily_progress")
        .update({ morning_plan: morningForm.morning_plan.trim() })
        .eq("id", myEntry.id).select("*, profiles(full_name, role)").single();
      if (error) showToast("Gagal menyimpan", false);
      else { setEntries(p => p.map(e => e.id === myEntry.id ? data : e)); showToast("Rencana pagi disimpan ✓"); }
    } else {
      const { data, error } = await supabase.from("daily_progress")
        .insert({ user_id: currentUser.id, date, morning_plan: morningForm.morning_plan.trim() })
        .select("*, profiles(full_name, role)").single();
      if (error) showToast("Gagal menyimpan", false);
      else { setEntries(p => [data, ...p]); showToast("Rencana pagi disimpan ✓"); }
    }
    setSubmitting(false);
    setMorningOpen(false);
  };

  // ── Evening ──
  const openEvening = () => {
    setEveningForm({
      activities: myEntry?.activities ?? "",
      achievements: myEntry?.achievements ?? "",
      obstacles: myEntry?.obstacles ?? "",
      plan_tomorrow: myEntry?.plan_tomorrow ?? "",
      mood: myEntry?.mood ?? 4,
    });
    setEveningOpen(true);
  };

  const saveEvening = async () => {
    if (!eveningForm.activities.trim()) return;
    setSubmitting(true);
    const payload = {
      activities: eveningForm.activities.trim(),
      achievements: eveningForm.achievements.trim() || null,
      obstacles: eveningForm.obstacles.trim() || null,
      plan_tomorrow: eveningForm.plan_tomorrow.trim() || null,
      mood: eveningForm.mood,
    };
    if (myEntry) {
      const { data, error } = await supabase.from("daily_progress")
        .update(payload).eq("id", myEntry.id).select("*, profiles(full_name, role)").single();
      if (error) showToast("Gagal menyimpan", false);
      else { setEntries(p => p.map(e => e.id === myEntry.id ? data : e)); showToast("Update sore disimpan ✓"); }
    } else {
      const { data, error } = await supabase.from("daily_progress")
        .insert({ user_id: currentUser.id, date, ...payload })
        .select("*, profiles(full_name, role)").single();
      if (error) showToast("Gagal menyimpan", false);
      else { setEntries(p => [data, ...p]); showToast("Update sore disimpan ✓"); }
    }
    setSubmitting(false);
    setEveningOpen(false);
  };

  // ── Rekap ──
  const fetchWeekData = useCallback(async () => {
    setWeekLoading(true);
    const { start, end } = getWeekRange(today);
    const { data } = await supabase.from("daily_progress")
      .select("*, profiles(full_name, role)").gte("date", start).lte("date", end)
      .order("date", { ascending: true });
    if (data) {
      const byUser: Record<string, DailyProgress[]> = {};
      data.forEach(e => { if (!byUser[e.user_id]) byUser[e.user_id] = []; byUser[e.user_id].push(e); });
      const summaries: WeekSummary[] = Object.entries(byUser).map(([uid, ents]) => {
        const p = profiles.find(p => p.id === uid);
        const obs = ents.filter(e => e.obstacles?.trim()).map(e => e.obstacles!);
        return {
          userId: uid,
          name: p?.full_name || (ents[0]?.profiles as any)?.full_name || "—",
          role: p?.role || (ents[0]?.profiles as any)?.role || "",
          entries: ents,
          avgMood: Math.round(ents.reduce((s, e) => s + (e.mood ?? 3), 0) / ents.length),
          totalEntries: ents.length, obstacles: obs, hasObstacles: obs.length > 0,
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
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Rencana pagi & update sore harianmu</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {canViewAll && (
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, gap: 2 }}>
              {(["daily", "rekap"] as const).map(t => (
                <motion.button key={t} whileTap={{ scale: 0.97 }} onClick={() => handleTabSwitch(t)}
                  style={{
                    padding: "7px 14px", border: "none", borderRadius: 8, cursor: "pointer",
                    fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
                    background: tab === t ? "#fff" : "transparent",
                    color: tab === t ? "#111827" : "#6b7280",
                    boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}>
                  {t === "daily" ? <><CalendarDays size={13} />Harian</> : <><BarChart2 size={13} />Rekap Mingguan</>}
                </motion.button>
              ))}
            </div>
          )}
          {tab === "rekap" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={fetchWeekData}
              style={{
                display: "flex", alignItems: "center", gap: 7, background: "#fff",
                color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: 10,
                padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>
              <TrendingUp size={15} />Refresh
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ═══ REKAP MINGGUAN ═══ */}
        {tab === "rekap" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Total Anggota Lapor",    val: weekData.length, color: "#6366f1" },
                    { label: "Total Entri Minggu Ini", val: weekData.reduce((s, d) => s + d.totalEntries, 0), color: "#10b981" },
                    { label: "Anggota Ada Hambatan",   val: weekData.filter(d => d.hasObstacles).length, color: "#f59e0b" },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px" }}>
                      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                      <p style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.val}</p>
                    </motion.div>
                  ))}
                </div>
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
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#fffbeb", color: "#d97706" }}>Ada hambatan</span>
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
                            {mc && <span style={{ fontSize: 20 }}>{mc.emoji}</span>}
                            <ChevronDown size={14} color="#9ca3af" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
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
                                      {e.morning_plan && (
                                        <div style={{ marginBottom: 6 }}>
                                          <p style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>🌅 Rencana</p>
                                          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{e.morning_plan}</p>
                                        </div>
                                      )}
                                      {e.activities && (
                                        <div>
                                          <p style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>🌆 Update</p>
                                          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{e.activities}</p>
                                        </div>
                                      )}
                                      {e.obstacles && (
                                        <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                                          <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />{e.obstacles}
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

        {/* ═══ DAILY TAB ═══ */}
        {tab === "daily" && (
          <>
            {/* Date navigator */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => changeDate(-1)}
                  style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                  <ChevronLeft size={16} color="#6b7280" />
                </button>
                <div style={{ padding: "10px 20px", borderLeft: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6", fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                  {fmt(date)}
                  {isToday && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#10b981", background: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 20, padding: "1px 7px" }}>
                      Hari Ini
                    </span>
                  )}
                </div>
                <button onClick={() => changeDate(1)} disabled={isToday}
                  style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: isToday ? "not-allowed" : "pointer", display: "flex", opacity: isToday ? 0.3 : 1 }}>
                  <ChevronRight size={16} color="#6b7280" />
                </button>
              </div>
              <div style={{ marginLeft: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={14} color="#3b82f6" />
                <div>
                  <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>Tim Melaporkan</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{entries.length} orang</p>
                </div>
              </div>
            </div>

            {/* TWO PHASE CARDS — my own */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Progress Kamu
              </p>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#10b981", borderRadius: "50%" }} />
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <PhaseCard
                    phase="morning" status={morningStatus} entry={myEntry}
                    isToday={isToday} isSuperAdmin={isSuperAdmin} onAction={openMorning}
                  />
                  <PhaseCard
                    phase="evening" status={eveningStatus} entry={myEntry}
                    isToday={isToday} isSuperAdmin={isSuperAdmin} onAction={openEvening}
                  />
                </div>
              )}
            </div>

            {/* TEAM SECTION — super admin / manager */}
            {canViewAll && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Progress Tim — {isToday ? "Hari Ini" : fmt(date)}
                  </p>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {entries.filter(e => e.user_id !== currentUser.id).length}/{profiles.filter(p => p.id !== currentUser.id).length} anggota
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {profiles
                    .filter(p => p.id !== currentUser.id)
                    .map((p, i) => {
                      const entry = entries.find(e => e.user_id === p.id);
                      const hasMorning = !!entry?.morning_plan;
                      const hasEvening = !!entry?.activities;
                      const isOpen = expandedUser === p.id;
                      const moodCfg = entry?.mood ? MOOD_CFG[(entry.mood ?? 3) - 1] : null;
                      return (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                          <div
                            style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: entry ? "pointer" : "default" }}
                            onClick={() => entry && setExpandedUser(isOpen ? null : p.id)}>
                            <div style={{
                              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                              background: entry ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#e5e7eb",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 700, color: entry ? "#fff" : "#9ca3af",
                            }}>{p.full_name.charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.full_name}</p>
                              <p style={{ fontSize: 11, color: "#9ca3af" }}>{ROLE_LABELS[p.role] ?? p.role}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <PhaseBadge phase="morning" done={hasMorning} />
                              <PhaseBadge phase="evening" done={hasEvening} />
                              {moodCfg && <span style={{ fontSize: 18 }}>{moodCfg.emoji}</span>}
                              {entry && (
                                <ChevronDown size={14} color="#9ca3af"
                                  style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                              )}
                            </div>
                          </div>
                          <AnimatePresence>
                            {isOpen && entry && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
                                <div style={{ borderTop: "1px solid #f3f4f6", padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                  {/* Morning detail */}
                                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🌅 Rencana Pagi</p>
                                    {entry.morning_plan ? (
                                      <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{entry.morning_plan}</p>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Belum diisi</p>
                                    )}
                                  </div>
                                  {/* Evening detail */}
                                  <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 12, padding: "12px 14px" }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🌆 Update Sore</p>
                                    {entry.activities ? (
                                      <>
                                        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{entry.activities}</p>
                                        {entry.achievements && (
                                          <div style={{ marginTop: 8 }}>
                                            <p style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Pencapaian</p>
                                            <p style={{ fontSize: 12, color: "#374151" }}>{entry.achievements}</p>
                                          </div>
                                        )}
                                        {entry.obstacles && (
                                          <div style={{ marginTop: 8 }}>
                                            <p style={{ fontSize: 10, fontWeight: 600, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Hambatan</p>
                                            <p style={{ fontSize: 12, color: "#d97706" }}>{entry.obstacles}</p>
                                          </div>
                                        )}
                                        {entry.plan_tomorrow && (
                                          <div style={{ marginTop: 8 }}>
                                            <p style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Rencana Besok</p>
                                            <p style={{ fontSize: 12, color: "#374151" }}>{entry.plan_tomorrow}</p>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Belum diisi</p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MORNING MODAL ═══ */}
      <AnimatePresence>
        {morningOpen && (
          <Modal onClose={() => setMorningOpen(false)}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>🌅 Rencana Pagi</h2>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(date)} · Batas 11.00 WIB</p>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setMorningOpen(false)}
                style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                <X size={16} color="#6b7280" />
              </motion.button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Rencana Hari Ini <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea rows={5} placeholder="Apa yang akan kamu kerjakan hari ini? Tuliskan rencana dan targetmu..." value={morningForm.morning_plan}
                  onChange={e => setMorningForm({ morning_plan: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #fde68a", borderRadius: 10, fontSize: 13, color: "#111827", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", background: "#fffbeb" }}
                  onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={e => (e.target.style.borderColor = "#fde68a")} />
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={saveMorning} disabled={submitting || !morningForm.morning_plan.trim()}
                style={{
                  width: "100%", padding: "12px",
                  background: submitting || !morningForm.morning_plan.trim() ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: submitting || !morningForm.morning_plan.trim() ? "not-allowed" : "pointer",
                  boxShadow: morningForm.morning_plan.trim() ? "0 4px 14px rgba(245,158,11,0.4)" : "none",
                  transition: "all 0.2s ease",
                }}>
                {submitting ? "Menyimpan..." : "Simpan Rencana Pagi"}
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ═══ EVENING MODAL ═══ */}
      <AnimatePresence>
        {eveningOpen && (
          <Modal onClose={() => setEveningOpen(false)}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>🌆 Update Sore</h2>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(date)} · Batas 18.00 WIB</p>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEveningOpen(false)}
                style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                <X size={16} color="#6b7280" />
              </motion.button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Mood */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Mood Hari Ini</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {MOOD_CFG.map(m => (
                    <motion.button key={m.val} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setEveningForm(f => ({ ...f, mood: m.val }))}
                      style={{
                        flex: 1, padding: "10px 4px", border: eveningForm.mood === m.val ? `2px solid ${m.color}` : "2px solid #e5e7eb",
                        borderRadius: 12, background: eveningForm.mood === m.val ? `${m.color}12` : "#f9fafb",
                        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        transition: "all 0.15s ease",
                      }}>
                      <span style={{ fontSize: 20 }}>{m.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: eveningForm.mood === m.val ? m.color : "#9ca3af" }}>{m.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <EveningField label="Aktivitas Hari Ini" required placeholder="Ceritakan apa yang sudah kamu kerjakan hari ini..." value={eveningForm.activities} rows={4}
                onChange={v => setEveningForm(f => ({ ...f, activities: v }))} />
              <EveningField label="Pencapaian" placeholder="Apa yang berhasil kamu selesaikan atau capai?" value={eveningForm.achievements} rows={3}
                onChange={v => setEveningForm(f => ({ ...f, achievements: v }))} />
              <EveningField label="Hambatan" placeholder="Adakah kendala atau hambatan?" value={eveningForm.obstacles} rows={2}
                onChange={v => setEveningForm(f => ({ ...f, obstacles: v }))} />
              <EveningField label="Rencana Besok" placeholder="Apa yang akan dikerjakan besok?" value={eveningForm.plan_tomorrow} rows={2}
                onChange={v => setEveningForm(f => ({ ...f, plan_tomorrow: v }))} />
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={saveEvening} disabled={submitting || !eveningForm.activities.trim()}
                style={{
                  width: "100%", padding: "12px",
                  background: submitting || !eveningForm.activities.trim() ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: submitting || !eveningForm.activities.trim() ? "not-allowed" : "pointer",
                  boxShadow: eveningForm.activities.trim() ? "0 4px 14px rgba(99,102,241,0.4)" : "none",
                  transition: "all 0.2s ease",
                }}>
                {submitting ? "Menyimpan..." : "Simpan Update Sore"}
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              background: toast.ok ? "#111827" : "#ef4444", color: "#fff",
              borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8,
            }}>
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function PhaseCard({ phase, status, entry, isToday, isSuperAdmin, onAction }: {
  phase: "morning" | "evening"; status: PhaseStatus;
  entry?: DailyProgress | null; isToday: boolean; isSuperAdmin: boolean; onAction: () => void;
}) {
  const cfg = PHASE_CFG[phase];
  const content = phase === "morning" ? entry?.morning_plan : entry?.activities;

  if (status === "done") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "#fff", border: `1.5px solid ${cfg.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{cfg.title}</p>
            <p style={{ fontSize: 10, color: cfg.activeColor, fontWeight: 600 }}>{cfg.deadline}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px" }}>✓ Diisi</span>
            {(isToday || isSuperAdmin) && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={onAction}
                style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}>
                <Edit2 size={13} color="#9ca3af" />
              </motion.button>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
              {phase === "morning" ? "Rencana Hari Ini" : "Aktivitas Hari Ini"}
            </p>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{content}</p>
          </div>
          {phase === "evening" && entry && (
            <>
              {entry.achievements && <InfoRow label="Pencapaian" value={entry.achievements} color="#10b981" />}
              {entry.obstacles && <InfoRow label="Hambatan" value={entry.obstacles} color="#f59e0b" icon={<AlertCircle size={11} />} />}
              {entry.plan_tomorrow && <InfoRow label="Rencana Besok" value={entry.plan_tomorrow} color="#8b5cf6" icon={<Lightbulb size={11} />} />}
              {entry.mood && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 18 }}>{MOOD_CFG[(entry.mood ?? 3) - 1]?.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: MOOD_CFG[(entry.mood ?? 3) - 1]?.color }}>
                    {MOOD_CFG[(entry.mood ?? 3) - 1]?.label}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  }

  if (status === "active") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
        style={{ background: "#fff", border: `1.5px solid ${cfg.border}`, borderRadius: 16, overflow: "hidden", boxShadow: `0 4px 20px ${cfg.color}18` }}>
        <div style={{ padding: "14px 16px", background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{cfg.title}</p>
            <p style={{ fontSize: 10, color: cfg.activeColor, fontWeight: 600 }}>{cfg.deadline}</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.activeColor, background: "#fff", border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "2px 8px" }}>Aktif</span>
        </div>
        <div style={{ padding: "20px 16px" }}>
          <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>{cfg.hint}</p>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onAction}
            style={{
              width: "100%", padding: "11px",
              background: `linear-gradient(135deg, ${cfg.color}, ${cfg.activeColor})`,
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 14px ${cfg.color}40`,
            }}>
            {cfg.cta}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  if (status === "missed") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "#fff", border: "1px solid #fee2e2", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", background: "#fef2f2", borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{cfg.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{cfg.title}</p>
            <p style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Lewat deadline</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 20, padding: "2px 8px" }}>✗ Terlewat</span>
        </div>
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <Lock size={22} color="#e5e7eb" style={{ margin: "0 auto 8px", display: "block" }} />
          <p style={{ fontSize: 12, color: "#9ca3af" }}>Waktu pengisian sudah berakhir</p>
          <p style={{ fontSize: 11, color: "#d1d5db", marginTop: 3 }}>{cfg.deadline}</p>
        </div>
      </motion.div>
    );
  }

  if (status === "locked_future") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, opacity: 0.5 }}>{cfg.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{cfg.title}</p>
            <p style={{ fontSize: 10, color: "#d1d5db", fontWeight: 600 }}>{cfg.deadline}</p>
          </div>
        </div>
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <Lock size={22} color="#d1d5db" style={{ margin: "0 auto 8px", display: "block" }} />
          <p style={{ fontSize: 12, color: "#9ca3af" }}>Tersedia mulai jam 12.00 siang</p>
          <p style={{ fontSize: 11, color: "#d1d5db", marginTop: 3 }}>Isi sebelum jam 18.00 WIB</p>
        </div>
      </motion.div>
    );
  }

  // past_view
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{cfg.title}</p>
        </div>
        {content ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px" }}>✓ Diisi</span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "2px 8px" }}>— Kosong</span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        {content ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {phase === "morning" ? "Rencana" : "Aktivitas"}
            </p>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{content}</p>
          </>
        ) : (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#d1d5db" }}>Tidak diisi</p>
          </div>
        )}
        {isSuperAdmin && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onAction}
            style={{ width: "100%", marginTop: 12, padding: "8px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Edit
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function PhaseBadge({ phase, done }: { phase: "morning" | "evening"; done: boolean }) {
  const icon = phase === "morning" ? "🌅" : "🌆";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: done ? "#dcfce7" : "#f3f4f6",
      border: `1px solid ${done ? "#bbf7d0" : "#e5e7eb"}`,
      color: done ? "#059669" : "#9ca3af",
    }}>
      {icon} {done ? "✓" : "–"}
    </div>
  );
}

function InfoRow({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color, lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 4 }}>
        {icon && <span style={{ flexShrink: 0, marginTop: 2 }}>{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function EveningField({ label, required, placeholder, value, onChange, rows }: {
  label: string; required?: boolean; placeholder: string; value: string; onChange: (v: string) => void; rows: number;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <textarea rows={rows} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #c7d2fe", borderRadius: 10, fontSize: 13, color: "#111827", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", background: "#fafafa", transition: "border-color 0.15s ease" }}
        onFocus={e => (e.target.style.borderColor = "#6366f1")}
        onBlur={e => (e.target.style.borderColor = "#c7d2fe")} />
    </div>
  );
}
