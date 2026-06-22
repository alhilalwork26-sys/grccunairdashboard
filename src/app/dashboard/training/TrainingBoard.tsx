"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import {
  GraduationCap, Plus, X, Check, Edit2, Trash2,
  Calendar, MapPin, Users, Clock, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";

interface TrainingSession {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  time_start?: string | null;
  time_end?: string | null;
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
  done:      { label: "Selesai",     color: "#9ca3af", bg: "#f3f4f6", border: "#e5e7eb" },
  cancelled: { label: "Dibatalkan",  color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const EMPTY = { title: "", description: "", date: "", time_start: "", time_end: "", location: "", max_participants: "", status: "upcoming" as TrainingSession["status"], trainer_id: "", materials: "" };

interface Props {
  currentUser: UserProfile;
  initialSessions: TrainingSession[];
  profiles: { id: string; full_name: string; role: string }[];
}

export default function TrainingBoard({ currentUser, initialSessions, profiles }: Props) {
  const supabase = createClient();
  const canManage = currentUser.role === "kep_trainer";
  const isViewOnly = ["super_admin", "manager"].includes(currentUser.role);

  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [tab, setTab] = useState<"upcoming" | "done" | "all">("upcoming");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s: TrainingSession) => {
    setEditing(s);
    setForm({ title: s.title, description: s.description ?? "", date: s.date, time_start: s.time_start ?? "", time_end: s.time_end ?? "", location: s.location ?? "", max_participants: s.max_participants?.toString() ?? "", status: s.status, trainer_id: s.trainer_id ?? "", materials: s.materials ?? "" });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date) return;
    setSubmitting(true);
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      date: form.date, time_start: form.time_start || null, time_end: form.time_end || null,
      location: form.location.trim() || null,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      status: form.status, trainer_id: form.trainer_id || currentUser.id,
      materials: form.materials.trim() || null,
    };
    if (editing) {
      const { data, error } = await supabase.from("training_sessions").update(payload).eq("id", editing.id)
        .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)").single();
      if (error) showToast(error.message, false);
      else { setSessions(prev => prev.map(s => s.id === editing.id ? data : s)); showToast("Sesi diperbarui"); }
    } else {
      const { data, error } = await supabase.from("training_sessions").insert(payload)
        .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)").single();
      if (error) showToast(error.message, false);
      else { setSessions(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date))); showToast("Sesi training ditambahkan"); }
    }
    setSubmitting(false); setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("training_sessions").delete().eq("id", id);
    if (error) showToast(error.message, false);
    else { setSessions(prev => prev.filter(s => s.id !== id)); showToast("Sesi dihapus"); }
    setDeleteId(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const filtered = sessions.filter(s =>
    tab === "all" ? true : tab === "upcoming" ? s.date >= today && s.status !== "cancelled" && s.status !== "done" : s.status === "done"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
            <GraduationCap size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Training</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{sessions.filter(s => s.status === "upcoming" || s.date >= today).length} sesi mendatang</p>
          </div>
        </div>
        {canManage && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(245,158,11,0.35)" }}>
            <Plus size={15} /> Tambah Sesi
          </motion.button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", gap: 4, flexShrink: 0 }}>
        {[{ key: "upcoming", label: "Mendatang" }, { key: "done", label: "Selesai" }, { key: "all", label: "Semua" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? "#f59e0b" : "#6b7280", borderBottom: tab === t.key ? "2px solid #f59e0b" : "2px solid transparent", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Sesi", val: sessions.length, color: "#f59e0b", bg: "#fffbeb" },
            { label: "Mendatang",  val: sessions.filter(s => s.status === "upcoming").length, color: "#3b82f6", bg: "#eff6ff" },
            { label: "Berlangsung", val: sessions.filter(s => s.status === "ongoing").length, color: "#10b981", bg: "#f0fdf4" },
            { label: "Selesai",    val: sessions.filter(s => s.status === "done").length, color: "#9ca3af", bg: "#f3f4f6" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ background: "#fff", border: `1px solid ${s.bg}`, borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.val}</p>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada sesi training</p>
            {canManage && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
                style={{ marginTop: 20, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Tambah Sesi Pertama
              </motion.button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((s, i) => {
              const cfg = STATUS_CFG[s.status];
              const isExpanded = expandedId === s.id;
              const participantCount = s.participants?.[0]?.count ?? 0;
              return (
                <motion.div key={s.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.05, duration: 0.26 }}
                  style={{ background: "#fff", border: `1.5px solid ${cfg.border}`, borderRadius: 14, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: cfg.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>
                        {new Date(s.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric" })}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: cfg.color }}>
                        {new Date(s.date + "T00:00:00").toLocaleDateString("id-ID", { month: "short" })}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{s.title}</h3>
                      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                        {s.time_start && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} color="#9ca3af" />
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{s.time_start.slice(0, 5)}{s.time_end ? ` – ${s.time_end.slice(0, 5)}` : ""}</span>
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
                        {s.max_participants && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Users size={11} color="#9ca3af" />
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{participantCount}/{s.max_participants} peserta</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {canManage && (
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
                  </div>
                  {/* Expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ borderTop: "1px solid #f3f4f6", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {s.description && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Deskripsi</p>
                            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{s.description}</p>
                          </div>
                        )}
                        {s.materials && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Materi & Link</p>
                            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.materials}</p>
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>Dibuat: {new Date(s.created_at).toLocaleDateString("id-ID")}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflow: "auto" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Sesi" : "Tambah Sesi Training"}</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Judul Sesi *</label>
                  <input type="text" placeholder="Nama training..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                {/* Date & Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tanggal *</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                {/* Time */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[{ label: "Waktu Mulai", key: "time_start" }, { label: "Waktu Selesai", key: "time_end" }].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input type="time" value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                    </div>
                  ))}
                </div>
                {/* Location & Max */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Lokasi</label>
                    <input type="text" placeholder="Ruangan / Online" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Maks. Peserta</label>
                    <input type="number" placeholder="0" value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea rows={3} placeholder="Deskripsi training..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                {/* Materials */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Materi & Link</label>
                  <textarea rows={3} placeholder="Link slide, modul, rekaman, dll..." value={form.materials} onChange={e => setForm(f => ({ ...f, materials: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.date}
                  style={{ width: "100%", padding: "12px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", background: submitting || !form.title.trim() || !form.date ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", transition: "all 0.2s" }}>
                  {submitting ? "Menyimpan..." : editing ? "Perbarui" : "Simpan Sesi"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Sesi Training?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Data sesi ini akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>Batal</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(deleteId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>Hapus</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: toast.ok ? "#111827" : "#ef4444", color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8 }}>
            {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
