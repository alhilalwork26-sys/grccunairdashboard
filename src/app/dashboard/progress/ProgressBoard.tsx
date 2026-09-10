"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, DailyProgress, TodoCategory, PersonalTodo } from "@/types";
import {
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Lightbulb,
  CalendarDays, Users, TrendingUp, Edit2, BarChart2,
  ChevronDown, Paperclip, Link as LinkIcon, Upload, FileText, ExternalLink, Bell,
  Plus, FolderKanban, Home, CheckCircle2, Briefcase, User,
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

function getGreeting(hour: number) {
  if (hour < 11) return { text: "Selamat Pagi", emoji: "☀️" };
  if (hour < 15) return { text: "Selamat Siang", emoji: "🌤️" };
  if (hour < 18) return { text: "Selamat Sore", emoji: "🌇" };
  return { text: "Selamat Malam", emoji: "🌙" };
}

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

type PhaseStatus = "active" | "done" | "past_view";

function getMorningStatus(isToday: boolean, entry?: DailyProgress | null): PhaseStatus {
  if (!isToday) return "past_view";
  if ((entry?.todos && entry.todos.length > 0) || entry?.morning_plan) return "done";
  return "active";
}

function getEveningStatus(isToday: boolean, entry?: DailyProgress | null): PhaseStatus {
  if (!isToday) return "past_view";
  if (entry?.activities) return "done";
  return "active";
}

const PHASE_CFG = {
  morning: {
    icon: "🌅", title: "Rencana Pagi",
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", activeColor: "#d97706",
    cta: "✍️  Buat To Do List",
    hint: "Tuliskan daftar tugas yang ingin kamu selesaikan hari ini.",
  },
  evening: {
    icon: "🌆", title: "Update Sore",
    color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", activeColor: "#4f46e5",
    cta: "✅  Centang To Do List",
    hint: "Centang tugas yang sudah kamu selesaikan hari ini.",
  },
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyCategory(name = ""): TodoCategory {
  return { id: genId(), name, items: [{ id: genId(), text: "", done: false }] };
}

// Older entries saved `todos` as a flat TodoItem[] (before the bab-pekerjaan grouping) —
// wrap those into a single category instead of crashing on `.items`.
function normalizeTodoCategories(raw: unknown): TodoCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0] as { items?: unknown };
  if (first && Array.isArray(first.items)) return raw as TodoCategory[];
  return [{ id: genId(), name: "To Do List", items: raw as TodoCategory["items"] }];
}

function seedMorningCategories(entry?: DailyProgress | null): TodoCategory[] {
  const normalized = normalizeTodoCategories(entry?.todos).map(c => ({ ...c, items: c.items.map(i => ({ ...i })) }));
  if (normalized.length > 0) return normalized;
  if (entry?.morning_plan) return [{ id: genId(), name: "Pekerjaan", items: [{ id: genId(), text: entry.morning_plan, done: false }] }];
  return [emptyCategory("Pekerjaan")];
}

const EMPTY_MORNING = { categories: [] as TodoCategory[] };
const EMPTY_EVENING = { categories: [] as TodoCategory[], achievements: "", obstacles: "", plan_tomorrow: "", mood: 4, proof_url: "" };

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

  const [sidebarView, setSidebarView] = useState<"home" | "completed" | "today" | "personal" | "work">("home");
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [newPersonalText, setNewPersonalText] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("personal_todos").select("*")
        .eq("user_id", currentUser.id)
        .order("position", { ascending: true }).order("created_at", { ascending: true });
      setPersonalTodos(data ?? []);
      setPersonalLoading(false);
    })();
  }, [supabase, currentUser.id]);

  const addPersonalTodo = async () => {
    const text = newPersonalText.trim();
    if (!text) return;
    setNewPersonalText("");
    try {
      const { data, error } = await supabase
        .from("personal_todos")
        .insert({ user_id: currentUser.id, text, position: personalTodos.length })
        .select("*").single();
      if (error) { console.error("[personal_todos] insert failed:", error); showToast(`Gagal menambah to-do: ${error.message}`, false); return; }
      if (data) setPersonalTodos(p => [...p, data]);
    } catch (e) {
      console.error("[personal_todos] insert threw:", e);
      showToast(`Gagal menambah to-do: ${e instanceof Error ? e.message : "kesalahan tak dikenal"}`, false);
    }
  };

  const togglePersonalTodo = async (id: string) => {
    const item = personalTodos.find(t => t.id === id);
    if (!item) return;
    setPersonalTodos(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
    try {
      const { error } = await supabase.from("personal_todos").update({ done: !item.done }).eq("id", id);
      if (error) {
        console.error("[personal_todos] update failed:", error);
        setPersonalTodos(p => p.map(t => t.id === id ? { ...t, done: item.done } : t));
        showToast(`Gagal menyimpan: ${error.message}`, false);
      }
    } catch (e) {
      console.error("[personal_todos] update threw:", e);
      setPersonalTodos(p => p.map(t => t.id === id ? { ...t, done: item.done } : t));
      showToast(`Gagal menyimpan: ${e instanceof Error ? e.message : "kesalahan tak dikenal"}`, false);
    }
  };

  const removePersonalTodo = async (id: string) => {
    const removed = personalTodos.find(t => t.id === id);
    setPersonalTodos(p => p.filter(t => t.id !== id));
    try {
      const { error } = await supabase.from("personal_todos").delete().eq("id", id);
      if (error) {
        console.error("[personal_todos] delete failed:", error);
        if (removed) setPersonalTodos(p => [...p, removed].sort((a, b) => a.position - b.position));
        showToast(`Gagal menghapus: ${error.message}`, false);
      }
    } catch (e) {
      console.error("[personal_todos] delete threw:", e);
      if (removed) setPersonalTodos(p => [...p, removed].sort((a, b) => a.position - b.position));
      showToast(`Gagal menghapus: ${e instanceof Error ? e.message : "kesalahan tak dikenal"}`, false);
    }
  };

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
  const [proofFile, setProofFile]     = useState<File | null>(null);
  const [proofMode, setProofMode]     = useState<"file" | "url">("file");
  const [proofUploading, setProofUploading] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const toggleCollapsedCat = (id: string) => setCollapsedCats(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const isToday = date === today;
  const now = new Date();
  const canViewAll  = ["super_admin", "manager"].includes(currentUser.role);
  const isSuperAdmin = currentUser.role === "super_admin";

  const myEntry = entries.find(e => e.user_id === currentUser.id);
  const morningStatus = getMorningStatus(isToday, myEntry);
  const eveningStatus = getEveningStatus(isToday, myEntry);

  const workItems = normalizeTodoCategories(myEntry?.todos).flatMap(c => c.items);
  const workDoneCount = workItems.filter(i => i.done).length;
  const personalDoneCount = personalTodos.filter(t => t.done).length;
  const sidebarCounts = {
    home: workItems.length + personalTodos.length,
    completed: workDoneCount + personalDoneCount,
    today: workItems.length,
    personal: personalTodos.length,
    work: workItems.length,
  };

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
    setMorningForm({ categories: seedMorningCategories(myEntry) });
    setMorningOpen(true);
  };

  const addMorningCategory = () => setMorningForm(f => ({ ...f, categories: [...f.categories, emptyCategory()] }));
  const removeMorningCategory = (catId: string) => setMorningForm(f => ({ ...f, categories: f.categories.filter(c => c.id !== catId) }));
  const editMorningCategoryName = (catId: string, name: string) => setMorningForm(f => ({
    ...f, categories: f.categories.map(c => c.id === catId ? { ...c, name } : c),
  }));
  const addMorningItem = (catId: string) => setMorningForm(f => ({
    ...f, categories: f.categories.map(c => c.id === catId ? { ...c, items: [...c.items, { id: genId(), text: "", done: false }] } : c),
  }));
  const removeMorningItem = (catId: string, itemId: string) => setMorningForm(f => ({
    ...f, categories: f.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c),
  }));
  const editMorningItem = (catId: string, itemId: string, text: string) => setMorningForm(f => ({
    ...f, categories: f.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, text } : i) } : c),
  }));

  const saveMorning = async () => {
    const cleaned = morningForm.categories
      .map(c => ({ ...c, name: c.name.trim() || "Pekerjaan", items: c.items.map(i => ({ ...i, text: i.text.trim() })).filter(i => i.text) }))
      .filter(c => c.items.length > 0);
    if (cleaned.length === 0) return;
    setSubmitting(true);
    try {
      const summary = cleaned.map(c => `${c.name}: ${c.items.map(i => i.text).join(", ")}`).join(" | ");
      const payload = { todos: cleaned, morning_plan: summary };
      if (myEntry) {
        const { data, error } = await supabase.from("daily_progress")
          .update(payload)
          .eq("id", myEntry.id).select("*, profiles(full_name, role)").single();
        if (error) showToast("Gagal menyimpan", false);
        else { setEntries(p => p.map(e => e.id === myEntry.id ? data : e)); showToast("To do list pagi disimpan ✓"); setMorningOpen(false); }
      } else {
        const { data, error } = await supabase.from("daily_progress")
          .insert({ user_id: currentUser.id, date, ...payload })
          .select("*, profiles(full_name, role)").single();
        if (error) showToast("Gagal menyimpan", false);
        else { setEntries(p => [data, ...p]); showToast("To do list pagi disimpan ✓"); setMorningOpen(false); }
      }
    } catch {
      showToast("Gagal menyimpan", false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Evening ──
  const openEvening = () => {
    setEveningForm({
      categories: normalizeTodoCategories(myEntry?.todos).map(c => ({ ...c, items: c.items.map(i => ({ ...i })) })),
      achievements: myEntry?.achievements ?? "",
      obstacles: myEntry?.obstacles ?? "",
      plan_tomorrow: myEntry?.plan_tomorrow ?? "",
      mood: myEntry?.mood ?? 4,
      proof_url: myEntry?.proof_url ?? "",
    });
    setProofFile(null);
    setProofMode(myEntry?.proof_url ? "url" : "file");
    setEveningOpen(true);
  };

  const toggleEveningTodo = (catId: string, itemId: string) => setEveningForm(f => ({
    ...f,
    categories: f.categories.map(c => c.id === catId
      ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) }
      : c),
  }));

  const saveEvening = async () => {
    const hasProof = proofFile !== null || eveningForm.proof_url.trim() !== "";
    if (!hasProof) return;
    setSubmitting(true);

    try {
      let finalProofUrl = eveningForm.proof_url.trim() || null;

      if (proofFile) {
        setProofUploading(true);
        const ext = proofFile.name.split(".").pop();
        const path = `${currentUser.id}/${date}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("progress-proofs").upload(path, proofFile, { upsert: true });
        if (uploadError) {
          showToast("Gagal upload bukti kerja", false);
          return;
        }
        const { data: urlData } = supabase.storage.from("progress-proofs").getPublicUrl(path);
        finalProofUrl = urlData.publicUrl;
      }

      const allItems = eveningForm.categories.flatMap(c => c.items);
      const doneItems = allItems.filter(i => i.done);
      const activitiesSummary = allItems.length > 0
        ? `${doneItems.length}/${allItems.length} to do selesai${doneItems.length ? ": " + doneItems.map(i => i.text).join(", ") : ""}`
        : "Tidak ada to do list pagi ini";

      const payload = {
        todos: eveningForm.categories,
        activities: activitiesSummary,
        achievements: eveningForm.achievements.trim() || null,
        obstacles: eveningForm.obstacles.trim() || null,
        plan_tomorrow: eveningForm.plan_tomorrow.trim() || null,
        mood: eveningForm.mood,
        proof_url: finalProofUrl,
      };
      if (myEntry) {
        const { data, error } = await supabase.from("daily_progress")
          .update(payload).eq("id", myEntry.id).select("*, profiles(full_name, role)").single();
        if (error) showToast("Gagal menyimpan", false);
        else { setEntries(p => p.map(e => e.id === myEntry.id ? data : e)); showToast("Update sore disimpan ✓"); setEveningOpen(false); }
      } else {
        const { data, error } = await supabase.from("daily_progress")
          .insert({ user_id: currentUser.id, date, ...payload })
          .select("*, profiles(full_name, role)").single();
        if (error) showToast("Gagal menyimpan", false);
        else { setEntries(p => [data, ...p]); showToast("Update sore disimpan ✓"); setEveningOpen(false); }
      }
    } catch {
      showToast("Gagal menyimpan", false);
    } finally {
      setSubmitting(false);
      setProofUploading(false);
    }
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

  const blastNotif = async () => {
    setBlasting(true);
    try {
      const res = await fetch("/api/notifications/blast-progress", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal");
      if (json.phase === "off_hours") {
        showToast("Di luar jam pengisian (11:00 & 12:00–18:00 WIB)", false);
      } else if (json.sent === 0) {
        showToast("Semua anggota sudah mengisi! 🎉", true);
      } else {
        const label = json.phase === "evening" ? "Update Sore" : "Rencana Pagi";
        showToast(`Notifikasi ${label} dikirim ke ${json.sent} anggota 🔔`, true);
      }
    } catch {
      showToast("Gagal mengirim notifikasi", false);
    } finally {
      setBlasting(false);
    }
  };

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>

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
          {canViewAll && isToday && (
            <motion.button
              whileHover={{ scale: blasting ? 1 : 1.02 }}
              whileTap={{ scale: blasting ? 1 : 0.97 }}
              onClick={blastNotif}
              disabled={blasting}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: blasting ? "#e0e7ff" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: blasting ? "#6366f1" : "#fff",
                border: "none", borderRadius: 10, padding: "8px 14px",
                cursor: blasting ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                boxShadow: blasting ? "none" : "0 2px 8px rgba(99,102,241,0.35)",
              }}>
              {blasting
                ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    style={{ width: 13, height: 13, border: "2px solid #c7d2fe", borderTopColor: "#6366f1", borderRadius: "50%" }} />Mengirim...</>
                : <><Bell size={13} />Blast Notif</>}
            </motion.button>
          )}
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

      <div className="board-main" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 20 }}>

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
                                      {((e.todos && e.todos.length > 0) || e.morning_plan) && (
                                        <div>
                                          <p style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>📋 To Do List</p>
                                          <TodoChecklist todos={e.todos} fallbackText={e.morning_plan} size={11} />
                                        </div>
                                      )}
                                      {e.obstacles && (
                                        <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                                          <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />{e.obstacles}
                                        </p>
                                      )}
                                      {e.proof_url && (
                                        <a href={e.proof_url} target="_blank" rel="noreferrer"
                                          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, fontWeight: 600, color: "#4f46e5", textDecoration: "none", background: "#eef2ff", padding: "4px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                                          <Paperclip size={10} />Bukti Kerja<ExternalLink size={10} />
                                        </a>
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
            {/* Greeting */}
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                {getGreeting(now.getHours()).text}, {currentUser.full_name.split(" ")[0]}
                <span>{getGreeting(now.getHours()).emoji}</span>
              </h2>
              <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>Ini {fmt(today)}</p>
            </div>

            {/* Tip banner */}
            <AnimatePresence>
              {!tipDismissed && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 14, padding: "14px 16px" }}>
                  <Lightbulb size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ flex: 1, fontSize: 12.5, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
                    Susun tugasmu ke dalam beberapa bab pekerjaan di Rencana Pagi, lalu tinggal centang satu-satu di Update Sore — bisa diisi kapan pun, cara sederhana melacak progres harianmu.
                  </p>
                  <button onClick={() => setTipDismissed(true)}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                    <X size={14} color="#9ca3af" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <ProgressSidebar view={sidebarView} onChange={setSidebarView} counts={sidebarCounts} />

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                {(sidebarView === "home" || sidebarView === "today" || sidebarView === "work") && (
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
                  </>
                )}

                {(sidebarView === "home" || sidebarView === "personal") && (
                  <PersonalTodoPanel
                    todos={personalTodos} loading={personalLoading} newText={newPersonalText}
                    onNewTextChange={setNewPersonalText} onAdd={addPersonalTodo}
                    onToggle={togglePersonalTodo} onRemove={removePersonalTodo}
                  />
                )}

                {sidebarView === "completed" && (
                  <CompletedView workCategories={normalizeTodoCategories(myEntry?.todos)} personalTodos={personalTodos} />
                )}
              </div>
            </div>
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
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(date)}</p>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setMorningOpen(false)}
                style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                <X size={16} color="#6b7280" />
              </motion.button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Kelompokkan tugasmu ke dalam beberapa bab pekerjaan.</p>
              <AnimatePresence initial={false}>
                {morningForm.categories.map((cat, ci) => (
                  <motion.div key={cat.id} layout
                    initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: -12 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    style={{ border: "1.5px solid #fde68a", borderRadius: 14, overflow: "hidden", background: "#fffbeb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: collapsedCats.has(cat.id) ? "none" : "1px solid #fde68a" }}>
                      <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => toggleCollapsedCat(cat.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                        <ChevronDown size={13} color="#d97706" style={{ transform: collapsedCats.has(cat.id) ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
                      </motion.button>
                      <FolderKanban size={14} color="#d97706" style={{ flexShrink: 0 }} />
                      <input type="text" placeholder={`Bab Pekerjaan ${ci + 1}`} value={cat.name}
                        onChange={e => editMorningCategoryName(cat.id, e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: "inherit" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 20, padding: "2px 7px", flexShrink: 0 }}>
                        {cat.items.length}
                      </span>
                      {morningForm.categories.length > 1 && (
                        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => removeMorningCategory(cat.id)}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
                          <X size={13} color="#ef4444" />
                        </motion.button>
                      )}
                    </div>
                    {!collapsedCats.has(cat.id) && (
                    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <AnimatePresence initial={false}>
                        {cat.items.map(it => (
                          <motion.div key={it.id} layout
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: -6 }} transition={{ duration: 0.16 }}
                            style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, marginLeft: 2 }} />
                            <input type="text" placeholder="Tulis satu tugas…" value={it.text}
                              onChange={e => editMorningItem(cat.id, it.id, e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMorningItem(cat.id); } }}
                              style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#111827", outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
                              onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                              onBlur={e => (e.target.style.borderColor = "#fde68a")} />
                            {cat.items.length > 1 && (
                              <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => removeMorningItem(cat.id, it.id)}
                                style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
                                <X size={12} color="#ef4444" />
                              </motion.button>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} type="button" onClick={() => addMorningItem(cat.id)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          border: "1.5px dashed #fcd34d", background: "#fff", borderRadius: 8,
                          padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#d97706", cursor: "pointer", marginTop: 2,
                        }}>
                        <Plus size={11} /> Tambah Tugas
                      </motion.button>
                    </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} type="button" onClick={addMorningCategory}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  border: "1.5px dashed #d97706", background: "none", borderRadius: 10,
                  padding: "9px 10px", fontSize: 12, fontWeight: 700, color: "#d97706", cursor: "pointer",
                }}>
                <Plus size={13} /> Tambah Bab Pekerjaan
              </motion.button>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={saveMorning} disabled={submitting || morningForm.categories.every(c => c.items.every(i => !i.text.trim()))}
                style={{
                  width: "100%", padding: "12px",
                  background: submitting || morningForm.categories.every(c => c.items.every(i => !i.text.trim())) ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: submitting || morningForm.categories.every(c => c.items.every(i => !i.text.trim())) ? "not-allowed" : "pointer",
                  boxShadow: morningForm.categories.some(c => c.items.some(i => i.text.trim())) ? "0 4px 14px rgba(245,158,11,0.4)" : "none",
                  transition: "all 0.2s ease",
                }}>
                {submitting ? "Menyimpan..." : "Simpan To Do List"}
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
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(date)}</p>
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
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>To Do List Pagi Ini</label>
                  {eveningForm.categories.length > 0 && (() => {
                    const allItems = eveningForm.categories.flatMap(c => c.items);
                    return allItems.length > 0 ? (
                      <motion.span key={allItems.filter(i => i.done).length}
                        initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ duration: 0.18 }}
                        style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "2px 8px", borderRadius: 20 }}>
                        {allItems.filter(i => i.done).length}/{allItems.length} selesai
                      </motion.span>
                    ) : null;
                  })()}
                </div>
                {eveningForm.categories.every(c => c.items.length === 0) || eveningForm.categories.length === 0 ? (
                  <div style={{ padding: "20px 14px", textAlign: "center", border: "1.5px dashed #e5e7eb", borderRadius: 12, background: "#fafafa" }}>
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>Kamu belum membuat to do list pagi ini.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {eveningForm.categories.filter(c => c.items.length > 0).map(cat => {
                      const doneCount = cat.items.filter(i => i.done).length;
                      return (
                        <div key={cat.id} style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                          <button type="button" onClick={() => toggleCollapsedCat(cat.id)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "#f9fafb", border: "none", borderBottom: collapsedCats.has(cat.id) ? "none" : "1px solid #f3f4f6", cursor: "pointer", textAlign: "left" }}>
                            <ChevronDown size={12} color="#9ca3af" style={{ flexShrink: 0, transform: collapsedCats.has(cat.id) ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
                            <FolderKanban size={13} color="#6366f1" style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#374151" }}>{cat.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>
                              {doneCount}/{cat.items.length}
                            </span>
                          </button>
                          {!collapsedCats.has(cat.id) && (
                          <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                            {cat.items.map(it => (
                              <motion.button key={it.id} type="button" layout whileTap={{ scale: 0.99 }} onClick={() => toggleEveningTodo(cat.id, it.id)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", textAlign: "left",
                                  border: "none", borderRadius: 8, cursor: "pointer",
                                  background: it.done ? "#eef2ff" : "transparent", transition: "background 0.15s",
                                }}>
                                <motion.span animate={{ scale: it.done ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.28 }}
                                  style={{
                                    width: 17, height: 17, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                    background: it.done ? "#4f46e5" : "#fff", border: `1.5px solid ${it.done ? "#4f46e5" : "#d1d5db"}`, transition: "background 0.15s, border-color 0.15s",
                                  }}>
                                  {it.done && <Check size={11} color="#fff" strokeWidth={3} />}
                                </motion.span>
                                <span style={{ fontSize: 13, color: it.done ? "#9ca3af" : "#111827", textDecoration: it.done ? "line-through" : "none", transition: "color 0.15s" }}>
                                  {it.text}
                                </span>
                              </motion.button>
                            ))}
                          </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <EveningField label="Pencapaian" placeholder="Apa yang berhasil kamu selesaikan atau capai?" value={eveningForm.achievements} rows={3}
                onChange={v => setEveningForm(f => ({ ...f, achievements: v }))} />
              <EveningField label="Hambatan" placeholder="Adakah kendala atau hambatan?" value={eveningForm.obstacles} rows={2}
                onChange={v => setEveningForm(f => ({ ...f, obstacles: v }))} />
              <EveningField label="Rencana Besok" placeholder="Apa yang akan dikerjakan besok?" value={eveningForm.plan_tomorrow} rows={2}
                onChange={v => setEveningForm(f => ({ ...f, plan_tomorrow: v }))} />

              {/* Bukti Kerja */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Paperclip size={13} color="#6366f1" />
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Bukti Kerja <span style={{ color: "#ef4444" }}>*</span></label>
                </div>
                {/* Mode toggle */}
                <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3, gap: 2, marginBottom: 10 }}>
                  {([["file", "Upload File", <Upload key="u" size={11} />], ["url", "Link URL", <LinkIcon key="l" size={11} />]] as const).map(([mode, label, icon]) => (
                    <button key={mode} onClick={() => { setProofMode(mode); if (mode === "file") setEveningForm(f => ({ ...f, proof_url: "" })); else setProofFile(null); }}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        padding: "6px 0", border: "none", borderRadius: 6, cursor: "pointer",
                        background: proofMode === mode ? "#fff" : "transparent",
                        color: proofMode === mode ? "#4f46e5" : "#6b7280",
                        fontWeight: proofMode === mode ? 700 : 500, fontSize: 12,
                        boxShadow: proofMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.15s",
                      }}>
                      {icon}{label}
                    </button>
                  ))}
                </div>

                {proofMode === "file" ? (
                  <div>
                    <label style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "16px", border: "1.5px dashed #c7d2fe", borderRadius: 10,
                      cursor: "pointer", background: proofFile ? "#eef2ff" : "#fafafa", transition: "all 0.15s",
                    }}>
                      <input type="file" style={{ display: "none" }}
                        accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                      {proofFile ? (
                        <>
                          <FileText size={20} color="#6366f1" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5", textAlign: "center", wordBreak: "break-all" }}>{proofFile.name}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{(proofFile.size / 1024).toFixed(0)} KB · Klik untuk ganti</span>
                        </>
                      ) : (
                        <>
                          <Upload size={20} color="#9ca3af" />
                          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Klik untuk upload foto, PDF, Word, PPT, Excel</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>Maks. 20 MB</span>
                        </>
                      )}
                    </label>
                    {/* Show existing proof if no new file selected */}
                    {!proofFile && eveningForm.proof_url && (
                      <a href={eveningForm.proof_url} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#4f46e5", textDecoration: "none", fontWeight: 500 }}>
                        <ExternalLink size={12} />Bukti sebelumnya tersimpan — klik untuk lihat
                      </a>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #c7d2fe", borderRadius: 10, padding: "10px 12px", background: "#fafafa" }}>
                      <LinkIcon size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                      <input type="url" placeholder="https://drive.google.com/... atau link lainnya"
                        value={eveningForm.proof_url}
                        onChange={e => setEveningForm(f => ({ ...f, proof_url: e.target.value }))}
                        style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent", fontFamily: "inherit" }} />
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Google Drive, Notion, GitHub, atau link apapun sebagai bukti</p>
                  </div>
                )}
              </div>

              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={saveEvening} disabled={submitting || proofUploading || (!proofFile && !eveningForm.proof_url.trim())}
                style={{
                  width: "100%", padding: "12px",
                  background: submitting || proofUploading || (!proofFile && !eveningForm.proof_url.trim()) ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: submitting || proofUploading || (!proofFile && !eveningForm.proof_url.trim()) ? "not-allowed" : "pointer",
                  boxShadow: proofFile || eveningForm.proof_url.trim() ? "0 4px 14px rgba(99,102,241,0.4)" : "none",
                  transition: "all 0.2s ease",
                }}>
                {proofUploading ? "Mengupload bukti..." : submitting ? "Menyimpan..." : "Simpan Update Sore"}
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

function TodoChecklist({ todos, fallbackText, size = 13 }: { todos?: TodoCategory[] | null; fallbackText?: string | null; size?: number }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const categories = normalizeTodoCategories(todos).filter(c => c.items.length > 0);
  if (categories.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {categories.map(cat => {
          const isCollapsed = collapsed.has(cat.id);
          const doneCount = cat.items.filter(i => i.done).length;
          return (
            <div key={cat.id} style={{ border: "1px solid #f3f4f6", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => toggle(cat.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", border: "none", background: "#fafafa", cursor: "pointer", textAlign: "left" }}>
                <ChevronDown size={12} color="#9ca3af" style={{ flexShrink: 0, transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{cat.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 20, padding: "1px 6px", flexShrink: 0 }}>
                  {doneCount}/{cat.items.length}
                </span>
              </button>
              {!isCollapsed && (
                <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {cat.items.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{
                        width: size, height: size, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: t.done ? "#4f46e5" : "#fff", border: `1.5px solid ${t.done ? "#4f46e5" : "#d1d5db"}`,
                      }}>
                        {t.done && <Check size={size - 5} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ fontSize: 12, color: t.done ? "#9ca3af" : "#374151", textDecoration: t.done ? "line-through" : "none", lineHeight: 1.5 }}>
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (fallbackText) return <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{fallbackText}</p>;
  return <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Belum diisi</p>;
}

type SidebarView = "home" | "completed" | "today" | "personal" | "work";

function ProgressSidebar({ view, onChange, counts }: {
  view: SidebarView; onChange: (v: SidebarView) => void; counts: Record<SidebarView, number>;
}) {
  const [open, setOpen] = useState(true);
  const items: { key: SidebarView; label: string; icon: typeof Home; color: string }[] = [
    { key: "home", label: "Home", icon: Home, color: "#6366f1" },
    { key: "completed", label: "Completed", icon: CheckCircle2, color: "#10b981" },
    { key: "today", label: "Today", icon: CalendarDays, color: "#f59e0b" },
    { key: "personal", label: "Personal", icon: User, color: "#3b82f6" },
    { key: "work", label: "Work", icon: Briefcase, color: "#92400e" },
  ];
  return (
    <div style={{ width: 200, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 8px", border: "none", background: "none", cursor: "pointer", marginBottom: 2 }}>
        <ChevronDown size={13} color="#9ca3af" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>To Do Lists</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
              {items.map((it, i) => {
                const active = view === it.key;
                const Icon = it.icon;
                return (
                  <motion.button key={it.key} type="button" onClick={() => onChange(it.key)}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10,
                      border: "none", cursor: "pointer", textAlign: "left",
                      background: active ? "#eef2ff" : "transparent", transition: "background 0.15s",
                    }}>
                    <Icon size={15} color={active ? "#4f46e5" : it.color} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 600, color: active ? "#4f46e5" : "#374151" }}>{it.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: active ? "#4f46e5" : "#9ca3af",
                      background: active ? "#fff" : "#f3f4f6", borderRadius: 20, padding: "1px 8px", minWidth: 18, textAlign: "center", flexShrink: 0,
                    }}>
                      {counts[it.key]}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PersonalTodoPanel({ todos, loading, newText, onNewTextChange, onAdd, onToggle, onRemove }: {
  todos: PersonalTodo[]; loading: boolean; newText: string;
  onNewTextChange: (v: string) => void; onAdd: () => void;
  onToggle: (id: string) => void; onRemove: (id: string) => void;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <User size={16} color="#3b82f6" />
        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Personal</p>
        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>Bebas diisi kapan pun, tidak terikat tanggal</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="text" placeholder="Tambah to-do pribadi…" value={newText}
          onChange={e => onNewTextChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          style={{ flex: 1, padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          onFocus={e => (e.target.style.borderColor = "#3b82f6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
        <motion.button whileTap={{ scale: newText.trim() ? 0.95 : 1 }} type="button" onClick={onAdd} disabled={!newText.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "0 14px", border: "none", borderRadius: 10,
            background: newText.trim() ? "#3b82f6" : "#d1d5db", color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: newText.trim() ? "pointer" : "not-allowed",
          }}>
          <Plus size={14} /> Tambah
        </motion.button>
      </div>
      {loading ? (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Memuat…</p>
      ) : todos.length === 0 ? (
        <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic", padding: "12px 0" }}>Belum ada to-do pribadi.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <AnimatePresence initial={false}>
            {todos.map(t => (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", borderRadius: 9, background: t.done ? "#eff6ff" : "transparent" }}>
                <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => onToggle(t.id)}
                  style={{
                    width: 17, height: 17, borderRadius: 5, flexShrink: 0, padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    background: t.done ? "#3b82f6" : "#fff", border: `1.5px solid ${t.done ? "#3b82f6" : "#d1d5db"}`,
                  }}>
                  {t.done && <Check size={11} color="#fff" strokeWidth={3} />}
                </motion.button>
                <span style={{ flex: 1, fontSize: 13, color: t.done ? "#9ca3af" : "#111827", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                <button type="button" onClick={() => onRemove(t.id)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
                  <X size={13} color="#ef4444" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function CompletedView({ workCategories, personalTodos }: { workCategories: TodoCategory[]; personalTodos: PersonalTodo[] }) {
  const doneWork = workCategories.flatMap(c => c.items.filter(i => i.done).map(i => ({ id: i.id, text: i.text, source: c.name || "Kerjaan" })));
  const donePersonal = personalTodos.filter(t => t.done).map(t => ({ id: t.id, text: t.text, source: "Personal" }));
  const all = [...doneWork, ...donePersonal];
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CheckCircle2 size={16} color="#10b981" />
        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Completed</p>
      </div>
      {all.length === 0 ? (
        <p style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic", padding: "12px 0" }}>Belum ada tugas yang selesai.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {all.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px" }}>
              <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: "#9ca3af", textDecoration: "line-through" }}>{t.text}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>{t.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
              To Do List
            </p>
            <TodoChecklist todos={entry?.todos} fallbackText={content} />
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
              {entry.proof_url && (
                <a href={entry.proof_url} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "6px 12px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}>
                  <Paperclip size={12} />Lihat Bukti Kerja
                  <ExternalLink size={11} />
                </a>
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

  // past_view
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{cfg.title}</p>
        </div>
        {content || (entry?.todos && entry.todos.length > 0) ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px" }}>✓ Diisi</span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "2px 8px" }}>— Kosong</span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        {content || (entry?.todos && entry.todos.length > 0) ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              To Do List
            </p>
            <TodoChecklist todos={entry?.todos} fallbackText={content} />
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
