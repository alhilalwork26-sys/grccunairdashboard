"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import {
  GraduationCap, Plus, X, Check, Edit2, Trash2,
  MapPin, Users, Clock, BookOpen, ChevronDown, ChevronUp,
  Search, AlertTriangle, ExternalLink, Zap, Megaphone,
} from "lucide-react";

interface TrainingSession {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  max_participants?: number | null;
  status: "upcoming" | "ongoing" | "done" | "cancelled";
  trainer_id?: string | null;
  materials?: string | null;
  created_at: string;
  trainer?: { full_name: string } | null;
  participants?: { count: number }[];
}

const STATUS_CFG = {
  upcoming:  { label: "Akan Datang", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  ongoing:   { label: "Berlangsung", color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
  done:      { label: "Selesai",     color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  cancelled: { label: "Dibatalkan",  color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
};

const MONTH_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fmtMonthYear(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function getCountdown(dateStr: string, status: string) {
  if (status === "done" || status === "cancelled") return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (status === "ongoing") return { label: "Sedang berlangsung", color: "#10b981", pulse: true };
  if (diff < 0) return null;
  if (diff === 0) return { label: "Hari ini!", color: "#ef4444", pulse: true };
  if (diff === 1) return { label: "Besok", color: "#f59e0b", pulse: false };
  if (diff <= 7) return { label: `${diff} hari lagi`, color: "#8b5cf6", pulse: false };
  return { label: `${diff} hari lagi`, color: "#9ca3af", pulse: false };
}

function MaterialLine({ text }: { text: string }) {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRe);
  return (
    <span>
      {parts.map((p, i) =>
        urlRe.test(p)
          ? <a key={i} href={p} target="_blank" rel="noopener noreferrer"
              style={{ color: "#3b82f6", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3 }}>
              {p.length > 50 ? p.slice(0, 48) + "…" : p}
              <ExternalLink size={10} />
            </a>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

const EMPTY = {
  title: "", description: "", date: "", start_time: "", end_time: "",
  location: "", max_participants: "", status: "upcoming" as TrainingSession["status"],
  trainer_id: "", materials: "",
};

interface Props {
  currentUser: UserProfile;
  initialSessions: TrainingSession[];
  profiles: { id: string; full_name: string; role: string }[];
}

export default function TrainingBoard({ currentUser, initialSessions, profiles }: Props) {
  const supabase = createClient();
  const canManage = currentUser.role === "kep_trainer";
  const canEdit   = ["super_admin", "manager", "kep_trainer"].includes(currentUser.role);

  const [sessions, setSessions]       = useState<TrainingSession[]>(initialSessions);
  const [tab, setTab]                 = useState<"upcoming" | "done" | "all">("upcoming");
  const [search, setSearch]           = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<TrainingSession | null>(null);
  const [form, setForm]               = useState(EMPTY);
  const [submitting, setSubmitting]   = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [blasting, setBlasting]       = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit   = (s: TrainingSession) => {
    setEditing(s);
    setForm({
      title: s.title, description: s.description ?? "", date: s.date,
      start_time: s.start_time ?? "", end_time: s.end_time ?? "",
      location: s.location ?? "", max_participants: s.max_participants?.toString() ?? "",
      status: s.status, trainer_id: s.trainer_id ?? "", materials: s.materials ?? "",
    });
    setShowModal(true);
  };

  // Sync training session → calendar events table
  const syncCalendar = async (
    trainingId: string,
    p: { title: string; description: string | null; date: string; start_time: string | null; end_time: string | null },
    isNew: boolean,
  ) => {
    const marker = `[ts:${trainingId}]`;
    const calDesc = p.description ? `${p.description}\n${marker}` : marker;
    const eventPayload = {
      title: `Training: ${p.title}`,
      description: calDesc,
      start_date: p.date,
      end_date: p.date,
      start_time: p.start_time,
      end_time: p.end_time,
      type: "training",
      created_by: currentUser.id,
    };
    if (isNew) {
      await supabase.from("events").insert(eventPayload);
    } else {
      const { data: existing } = await supabase.from("events")
        .select("id").ilike("description", `%${marker}%`).maybeSingle();
      if (existing) {
        await supabase.from("events").update(eventPayload).eq("id", existing.id);
      } else {
        await supabase.from("events").insert(eventPayload);
      }
    }
  };

  const removeFromCalendar = async (trainingId: string) => {
    await supabase.from("events").delete().ilike("description", `%[ts:${trainingId}]%`);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) return;
    setSubmitting(true);
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      date: form.date, start_time: form.start_time || null, end_time: form.end_time || null,
      location: form.location.trim() || null,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      status: form.status,
      trainer_id: form.trainer_id || currentUser.id,
      materials: form.materials.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("training_sessions").update(payload).eq("id", editing.id)
        .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)").single();
      if (error) { showToast(error.message, false); }
      else {
        setSessions(prev => prev.map(s => s.id === editing.id ? data : s));
        showToast("Sesi diperbarui + kalender diperbarui");
        syncCalendar(editing.id, payload, false);
      }
    } else {
      const { data, error } = await supabase.from("training_sessions").insert(payload)
        .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)").single();
      if (error) { showToast(error.message, false); }
      else {
        setSessions(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
        showToast("Sesi ditambahkan + kalender disinkron");
        syncCalendar(data.id, payload, true);
      }
    }
    setSubmitting(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await removeFromCalendar(id);
    const { error } = await supabase.from("training_sessions").delete().eq("id", id);
    if (error) showToast(error.message, false);
    else { setSessions(prev => prev.filter(s => s.id !== id)); showToast("Sesi + event kalender dihapus"); }
    setDeleteId(null);
  };

  const handleQuickStatus = async (s: TrainingSession, next: TrainingSession["status"]) => {
    const { error } = await supabase.from("training_sessions").update({ status: next }).eq("id", s.id);
    if (error) { showToast("Gagal update status", false); return; }
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: next } : x));
    showToast(`Status → ${STATUS_CFG[next].label}`);
  };

  const handleBlast = async (s: TrainingSession) => {
    setBlasting(s.id);
    const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeLabel = s.start_time ? ` pukul ${s.start_time.slice(0,5)}${s.end_time ? `–${s.end_time.slice(0,5)}` : ""}` : "";
    const locLabel  = s.location ? ` di ${s.location}` : "";
    const trainerLabel = (s.trainer as any)?.full_name ? ` Trainer: ${(s.trainer as any).full_name}.` : "";
    const content = `Jadwal training "${s.title}" akan diadakan pada ${dateLabel}${timeLabel}${locLabel}.${trainerLabel}${s.description ? `\n\n${s.description}` : ""}`;

    const { error } = await supabase.from("announcements").insert({
      title: `📢 Training: ${s.title}`,
      content,
      type: "info",
      pinned: false,
      created_by: currentUser.id,
    });

    if (error) showToast("Gagal mengirim notifikasi", false);
    else showToast("Notifikasi dikirim ke semua anggota!");
    setBlasting(null);
  };

  const filtered = useMemo(() => {
    let list = sessions.filter(s =>
      tab === "all"      ? true
      : tab === "upcoming" ? (s.date >= today && s.status !== "cancelled" && s.status !== "done") || s.status === "ongoing"
      : s.status === "done"
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        (s.trainer as any)?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sessions, tab, search, today]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    filtered.forEach(s => {
      const key = fmtMonthYear(s.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const stats = {
    total:    sessions.length,
    upcoming: sessions.filter(s => s.status === "upcoming").length,
    ongoing:  sessions.filter(s => s.status === "ongoing").length,
    done:     sessions.filter(s => s.status === "done").length,
  };

  // Trainers list for dropdown
  const trainers = profiles.filter(p => p.role === "kep_trainer");

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0, gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
          }}>
            <GraduationCap size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Training</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              {stats.upcoming + stats.ongoing} sesi mendatang
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{
          flex: 1, maxWidth: 340, position: "relative",
          display: "flex", alignItems: "center",
        }}>
          <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 12 }} />
          <input
            type="text" placeholder="Cari sesi training…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 34px",
              border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13,
              outline: "none", background: "#f9fafb", fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = "#f59e0b")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={12} color="#9ca3af" />
            </button>
          )}
        </div>

        {canEdit && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
            style={{
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}>
            <Plus size={15} /> Tambah Sesi
          </motion.button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", gap: 4, flexShrink: 0,
      }}>
        {([
          { key: "upcoming", label: "Mendatang", count: stats.upcoming + stats.ongoing },
          { key: "done",     label: "Selesai",   count: stats.done },
          { key: "all",      label: "Semua",     count: stats.total },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "14px 16px", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "#f59e0b" : "#6b7280",
              borderBottom: tab === t.key ? "2px solid #f59e0b" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
            {t.label}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
              background: tab === t.key ? "#fffbeb" : "#f3f4f6",
              color: tab === t.key ? "#d97706" : "#9ca3af",
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Total Sesi",   val: stats.total,    color: "#f59e0b", bg: "#fffbeb" },
            { label: "Mendatang",    val: stats.upcoming, color: "#3b82f6", bg: "#eff6ff" },
            { label: "Berlangsung",  val: stats.ongoing,  color: "#10b981", bg: "#f0fdf4" },
            { label: "Selesai",      val: stats.done,     color: "#6b7280", bg: "#f3f4f6" },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GraduationCap size={15} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Session list */}
        {grouped.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{search ? "🔍" : "🎓"}</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
              {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada sesi training"}
            </p>
            {canEdit && !search && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
                style={{ marginTop: 20, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Tambah Sesi Pertama
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {grouped.map(([month, monthSessions]) => (
              <div key={month}>
                {/* Month header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {month}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{monthSessions.length} sesi</span>
                  <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
                </div>

                <AnimatePresence mode="popLayout">
                  {monthSessions.map((s, i) => {
                    const cfg         = STATUS_CFG[s.status];
                    const isExpanded  = expandedId === s.id;
                    const count       = s.participants?.[0]?.count ?? 0;
                    const max         = s.max_participants;
                    const pct         = max ? Math.min(100, (count / max) * 100) : 0;
                    const countdown   = getCountdown(s.date, s.status);
                    const canBlast    = s.status !== "done" && s.status !== "cancelled";
                    const dateObj     = new Date(s.date + "T00:00:00");

                    return (
                      <motion.div key={s.id} layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: i * 0.04, duration: 0.24 }}
                        style={{
                          background: "#fff",
                          border: `1.5px solid ${cfg.border}`,
                          borderRadius: 16,
                          overflow: "hidden",
                          boxShadow: countdown?.pulse ? `0 0 0 2px ${cfg.color}22` : undefined,
                        }}
                      >
                        {/* Card main */}
                        <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                          {/* Date block */}
                          <div style={{
                            width: 52, height: 58, borderRadius: 12, background: cfg.bg,
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", flexShrink: 0, border: `1px solid ${cfg.border}`,
                          }}>
                            <span style={{ fontSize: 20, fontWeight: 900, color: cfg.color, lineHeight: 1 }}>
                              {dateObj.getDate()}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, textTransform: "uppercase", marginTop: 2 }}>
                              {MONTH_ID[dateObj.getMonth()].slice(0, 3)}
                            </span>
                            <span style={{ fontSize: 9, color: cfg.color, opacity: 0.6 }}>
                              {dateObj.getFullYear()}
                            </span>
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Status + countdown row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                              {/* Status badge — clickable for trainer/admin */}
                              {canEdit ? (
                                <div style={{ position: "relative" }}>
                                  <button
                                    onClick={() => {
                                      const order: TrainingSession["status"][] = ["upcoming","ongoing","done","cancelled"];
                                      const idx = order.indexOf(s.status);
                                      handleQuickStatus(s, order[(idx + 1) % order.length]);
                                    }}
                                    title="Klik untuk ganti status"
                                    style={{
                                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                                      background: cfg.bg, color: cfg.color,
                                      border: `1px solid ${cfg.border}`,
                                      cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                                    }}
                                  >
                                    <Zap size={8} /> {cfg.label}
                                  </button>
                                </div>
                              ) : (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                                }}>
                                  {cfg.label}
                                </span>
                              )}
                              {countdown && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                                  background: countdown.pulse ? `${countdown.color}18` : "#f3f4f6",
                                  color: countdown.color,
                                  border: `1px solid ${countdown.color}33`,
                                  display: "flex", alignItems: "center", gap: 4,
                                }}>
                                  {countdown.pulse && (
                                    <span style={{
                                      width: 5, height: 5, borderRadius: "50%",
                                      background: countdown.color, display: "inline-block",
                                      animation: "pulse 1.5s ease-in-out infinite",
                                    }} />
                                  )}
                                  {countdown.label}
                                </span>
                              )}
                            </div>

                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{s.title}</h3>

                            {/* Meta info */}
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                              {s.start_time && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={11} color="#9ca3af" />
                                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                                    {s.start_time.slice(0,5)}{s.end_time ? ` – ${s.end_time.slice(0,5)}` : ""}
                                  </span>
                                </div>
                              )}
                              {s.location && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <MapPin size={11} color="#9ca3af" />
                                  <span style={{ fontSize: 11, color: "#6b7280" }}>{s.location}</span>
                                </div>
                              )}
                              {(s.trainer as any)?.full_name && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <GraduationCap size={11} color="#9ca3af" />
                                  <span style={{ fontSize: 11, color: "#6b7280" }}>{(s.trainer as any).full_name}</span>
                                </div>
                              )}
                            </div>

                            {/* Capacity bar */}
                            {max && max > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Users size={10} color="#9ca3af" />
                                    <span style={{ fontSize: 10, color: "#6b7280" }}>
                                      {count} / {max} peserta
                                    </span>
                                  </div>
                                  {max && count >= max && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444" }}>Penuh</span>
                                  )}
                                  {!(max && count >= max) && pct > 0 && (
                                    <span style={{ fontSize: 10, color: "#9ca3af" }}>
                                      {max - count} slot tersisa
                                    </span>
                                  )}
                                </div>
                                <div style={{ height: 5, background: "#f3f4f6", borderRadius: 10, overflow: "hidden" }}>
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    style={{
                                      height: "100%", borderRadius: 10,
                                      background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981",
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              {canEdit && (
                                <>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => openEdit(s)}
                                    style={{ padding: 7, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}>
                                    <Edit2 size={13} color="#6b7280" />
                                  </motion.button>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setDeleteId(s.id)}
                                    style={{ padding: 7, border: "1px solid #fee2e2", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}>
                                    <Trash2 size={13} color="#ef4444" />
                                  </motion.button>
                                </>
                              )}
                              <motion.button whileHover={{ scale: 1.05 }} onClick={() => setExpandedId(isExpanded ? null : s.id)}
                                style={{ padding: 7, border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: 8, cursor: "pointer", display: "flex" }}>
                                {isExpanded ? <ChevronUp size={13} color="#6b7280" /> : <ChevronDown size={13} color="#6b7280" />}
                              </motion.button>
                            </div>

                            {/* Blast notif button */}
                            {canBlast && (
                              <motion.button
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => handleBlast(s)}
                                disabled={blasting === s.id}
                                title="Kirim notifikasi ke semua anggota"
                                style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  padding: "6px 12px", borderRadius: 8,
                                  fontSize: 11, fontWeight: 700, cursor: blasting === s.id ? "not-allowed" : "pointer",
                                  background: "#fffbeb", color: "#d97706",
                                  border: "1px solid #fde68a",
                                  transition: "all 0.15s",
                                  opacity: blasting === s.id ? 0.6 : 1,
                                }}
                              >
                                {blasting === s.id ? (
                                  <div className="spin" style={{ width: 10, height: 10, border: "1.5px solid #fde68a", borderTopColor: "#d97706", borderRadius: "50%" }} />
                                ) : (
                                  <Megaphone size={11} />
                                )}
                                Blast Notif
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {/* Expanded panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              style={{ borderTop: "1px solid #f3f4f6", overflow: "hidden" }}
                            >
                              <div style={{ padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                                {s.description && (
                                  <div>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                                      Deskripsi
                                    </p>
                                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{s.description}</p>
                                  </div>
                                )}
                                {s.materials && (
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                                      <BookOpen size={11} color="#9ca3af" />
                                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Materi & Link
                                      </p>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      {s.materials.split("\n").filter(Boolean).map((line, li) => (
                                        <p key={li} style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                                          <MaterialLine text={line} />
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                  <p style={{ fontSize: 11, color: "#9ca3af" }}>
                                    Dibuat {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                  </p>
                                  {!max && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <Users size={11} color="#9ca3af" />
                                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{count} terdaftar</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540, boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "92vh", overflow: "auto" }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <GraduationCap size={14} color="#f59e0b" />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {editing ? "Edit Sesi Training" : "Tambah Sesi Training"}
                  </h2>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Judul Sesi <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input type="text" placeholder="Nama training…" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                {/* Date + Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      Tanggal <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input type="date" value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TrainingSession["status"] }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Time */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[{ label: "Waktu Mulai", key: "start_time" }, { label: "Waktu Selesai", key: "end_time" }].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input type="time" value={(form as Record<string, string>)[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                    </div>
                  ))}
                </div>

                {/* Trainer + Location */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Trainer</label>
                    <select value={form.trainer_id} onChange={e => setForm(f => ({ ...f, trainer_id: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      <option value="">— Pilih Trainer —</option>
                      {trainers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Lokasi</label>
                    <input type="text" placeholder="Ruangan / Online…" value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                </div>

                {/* Max participants */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Maks. Peserta
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(kosongkan = tidak dibatasi)</span>
                  </label>
                  <input type="number" placeholder="0" min="0" value={form.max_participants}
                    onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea rows={2} placeholder="Deskripsi singkat training…" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                {/* Materials */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <BookOpen size={12} color="#9ca3af" />
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Materi & Link</label>
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(URL otomatis jadi link)</span>
                  </div>
                  <textarea rows={3} placeholder={"Slide: https://docs.google.com/...\nModul PDF: https://drive.google.com/..."} value={form.materials}
                    onChange={e => setForm(f => ({ ...f, materials: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.date}
                  style={{
                    width: "100%", padding: "12px", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
                    background: submitting || !form.title.trim() || !form.date
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff", transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                  }}>
                  {submitting
                    ? <><div className="spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%" }} /> Menyimpan...</>
                    : <><Check size={14} /> {editing ? "Perbarui Sesi" : "Simpan Sesi"}</>
                  }
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
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Sesi Training?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Data sesi dan semua peserta yang terdaftar akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Batal
                </button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(deleteId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Trash2 size={13} /> Hapus
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
            }}>
            {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
