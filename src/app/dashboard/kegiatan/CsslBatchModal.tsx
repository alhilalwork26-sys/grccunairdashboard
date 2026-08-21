"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import { createKegiatanAction, updateKegiatanAction } from "./actions";
import KegiatanAttachments from "./KegiatanAttachments";
import {
  GraduationCap, X, Check, Loader2, Mic, Clock, CalendarDays,
  Sparkles, AlertTriangle, BookOpen, Link2, ChevronDown, ChevronUp,
} from "lucide-react";

const LINK_FIELDS = [
  { key: "virtual_background_url", label: "Virtual Background" },
  { key: "absensi_url",            label: "Absensi" },
  { key: "materi_url",             label: "Materi" },
  { key: "record_zoom_url",        label: "Record Zoom" },
  { key: "ujian_url",              label: "Ujian" },
  { key: "dokumentasi_url",        label: "Dokumentasi" },
  { key: "modul_url",              label: "Modul" },
  { key: "rundown_url",            label: "Rundown" },
] as const;
type LinkKey = typeof LINK_FIELDS[number]["key"];

interface Sesi {
  id?: string;
  sesi_ke: number;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  pembicara: string;
  topik: string;
}

interface KegiatanLite {
  id: string;
  title: string;
  description?: string | null;
  pic_id?: string | null;
  sesi?: {
    id: string; sesi_ke: number; tanggal: string;
    waktu_mulai: string | null; waktu_selesai: string | null;
    pembicara: string | null; topik: string | null;
  }[];
  virtual_background_url?: string | null;
  absensi_url?: string | null;
  materi_url?: string | null;
  record_zoom_url?: string | null;
  ujian_url?: string | null;
  dokumentasi_url?: string | null;
  modul_url?: string | null;
  rundown_url?: string | null;
}

interface Props {
  currentUser: UserProfile;
  profiles: { id: string; full_name: string; role: string }[];
  editing: KegiatanLite | null;
  onClose: () => void;
  onSaved: (kegiatan: Record<string, unknown>) => void;
}

const emptySesi = (n: number): Sesi => ({ sesi_ke: n, tanggal: "", waktu_mulai: "", waktu_selesai: "", pembicara: "", topik: "" });

function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

const SESI_OFFSETS = [0, 3, 7, 10];
const SESI_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

function sesiFromEditing(editing: KegiatanLite | null): Sesi[] {
  const existing = editing?.sesi ?? [];
  return [1, 2, 3, 4].map(n => {
    const found = existing.find(s => s.sesi_ke === n);
    return found
      ? {
          id: found.id, sesi_ke: n, tanggal: found.tanggal,
          waktu_mulai: found.waktu_mulai?.slice(0, 5) ?? "",
          waktu_selesai: found.waktu_selesai?.slice(0, 5) ?? "",
          pembicara: found.pembicara ?? "", topik: found.topik ?? "",
        }
      : emptySesi(n);
  });
}

// Catatan: parent me-render komponen ini dengan key={editing?.id ?? "new"},
// jadi state di bawah cukup di-init sekali dari props tanpa perlu useEffect sync.
export default function CsslBatchModal({ currentUser, profiles, editing, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [picId, setPicId] = useState(editing?.pic_id ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sessions, setSessions] = useState<Sesi[]>(() => sesiFromEditing(editing));
  const [links, setLinks] = useState<Record<LinkKey, string>>(() =>
    LINK_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: editing?.[f.key] ?? "" }), {} as Record<LinkKey, string>));
  const [showLinks, setShowLinks] = useState(() => LINK_FIELDS.some(f => editing?.[f.key]));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSession = (idx: number, patch: Partial<Sesi>) => {
    setSessions(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  // Isi tanggal sesi 1 -> otomatis sarankan sesi 2-4 (pola 2 sesi/minggu, 2 minggu),
  // hanya kalau sesi berikutnya belum diisi manual.
  const handleFirstDateChange = (date: string) => {
    setSessions(prev => {
      const next = [...prev];
      next[0] = { ...next[0], tanggal: date };
      for (let i = 1; i < 4; i++) {
        if (!prev[i].tanggal) {
          next[i] = { ...next[i], tanggal: date ? addDaysLocal(date, SESI_OFFSETS[i]) : "" };
        }
      }
      return next;
    });
  };

  const isValid = title.trim().length > 0 && sessions.every(s => s.tanggal && s.pembicara.trim());

  const syncSessionCalendar = async (sesiId: string, s: Sesi) => {
    const marker = `[kegsesi:${sesiId}]`;
    const eventPayload = {
      title: `CSSL: ${title.trim()} — Sesi ${s.sesi_ke} (${s.pembicara.trim()})`,
      description: [s.topik.trim(), marker].filter(Boolean).join("\n"),
      start_date: s.tanggal,
      end_date: s.tanggal,
      start_time: s.waktu_mulai || null,
      end_time: s.waktu_selesai || null,
      type: "training" as const,
      created_by: currentUser.id,
    };
    const { data: existingEvent } = await supabase
      .from("events").select("id").ilike("description", `%${marker}%`).maybeSingle();
    if (existingEvent) await supabase.from("events").update(eventPayload).eq("id", existingEvent.id);
    else await supabase.from("events").insert(eventPayload);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    const dates = [...sessions.map(s => s.tanggal)].sort();
    const linkValues = LINK_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: links[f.key].trim() || null }), {} as Record<LinkKey, string | null>);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      deadline: dates[0],
      end_date: dates[dates.length - 1],
      status: "belum" as const,
      pic_id: picId || null,
      mode: "offline" as const,
      location: null,
      calendar_type: "training" as const,
      program: "cssl",
      ...linkValues,
    };

    const result = editing
      ? await updateKegiatanAction(editing.id, payload)
      : await createKegiatanAction(payload);

    if (result.error || !result.data) {
      setError(result.error ?? "Gagal menyimpan batch CSSL.");
      setSubmitting(false);
      return;
    }

    const kegiatanId = String((result.data as Record<string, unknown>).id);

    for (const s of sessions) {
      const row = {
        kegiatan_id: kegiatanId, sesi_ke: s.sesi_ke, tanggal: s.tanggal,
        waktu_mulai: s.waktu_mulai || null, waktu_selesai: s.waktu_selesai || null,
        pembicara: s.pembicara.trim() || null, topik: s.topik.trim() || null,
      };
      let sesiId = s.id;
      if (sesiId) {
        await supabase.from("kegiatan_sesi").update(row).eq("id", sesiId);
      } else {
        const { data: inserted } = await supabase.from("kegiatan_sesi").insert(row).select("id").single();
        sesiId = inserted?.id;
      }
      if (sesiId) await syncSessionCalendar(sesiId, s);
    }

    setSubmitting(false);
    onSaved(result.data);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,10,40,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 820, maxHeight: "92vh", overflow: "auto", boxShadow: "0 30px 80px rgba(79,70,229,0.25)" }}
      >
        {/* Header gradient */}
        <div style={{
          padding: "26px 30px", position: "sticky", top: 0, zIndex: 2,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={22} color="#fff" />
            </motion.div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  {editing ? "Edit Batch CSSL" : "Program CSSL Baru"}
                </h2>
                <Sparkles size={14} color="#fde68a" />
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>4 sesi dalam 2 minggu, tiap sesi punya pembicara</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 32, height: 32, border: "none", background: "rgba(255,255,255,0.2)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </motion.button>
        </div>

        <div style={{ padding: "24px 30px 30px" }}>
          {/* Batch info */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 22 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Nama Batch <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input type="text" placeholder="Contoh: CSSL Batch 6" value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "#8b5cf6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>PIC Batch</label>
              <select value={picId} onChange={e => setPicId(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                <option value="">— Pilih PIC —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Keterangan</label>
            <textarea rows={2} placeholder="Deskripsi singkat batch ini…" value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "#8b5cf6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
          </div>

          {/* Sessions timeline */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <CalendarDays size={13} color="#8b5cf6" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Jadwal 4 Sesi</span>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
            Isi tanggal Sesi 1, sesi berikutnya otomatis disarankan (bisa diubah bebas).
          </p>

          <div style={{ position: "relative" }}>
            {/* Timeline connector */}
            <div style={{ position: "absolute", left: 19, top: 24, bottom: 24, width: 2, background: "linear-gradient(#e5e7eb, #e5e7eb)", zIndex: 0 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sessions.map((s, i) => {
                const color = SESI_COLORS[i];
                const weekLabel = i < 2 ? "Minggu 1" : "Minggu 2";
                const showWeekLabel = i === 0 || i === 2;
                return (
                  <div key={s.sesi_ke}>
                    {showWeekLabel && (
                      <p style={{
                        fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
                        letterSpacing: "0.06em", marginBottom: 8, marginLeft: 46,
                      }}>
                        {weekLabel}
                      </p>
                    )}
                    <motion.div
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      style={{ display: "flex", gap: 12, position: "relative", zIndex: 1 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        style={{
                          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                          background: s.tanggal && s.pembicara.trim() ? color : "#fff",
                          border: `2.5px solid ${color}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 800,
                          color: s.tanggal && s.pembicara.trim() ? "#fff" : color,
                          boxShadow: `0 4px 12px ${color}33`,
                        }}>
                        {s.tanggal && s.pembicara.trim() ? <Check size={16} /> : i + 1}
                      </motion.div>

                      <div style={{
                        flex: 1, background: "#fafafa", border: "1.5px solid #f0f0f2", borderRadius: 14,
                        padding: 14, display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Sesi {s.sesi_ke}</span>
                          {s.tanggal && <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}15`, padding: "2px 8px", borderRadius: 20 }}>{fmtShort(s.tanggal)}</span>}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr", gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                              <CalendarDays size={10} /> Tanggal
                            </label>
                            <input type="date" value={s.tanggal}
                              onChange={e => i === 0 ? handleFirstDateChange(e.target.value) : updateSession(i, { tanggal: e.target.value })}
                              style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                              <Clock size={10} /> Mulai
                            </label>
                            <input type="time" value={s.waktu_mulai}
                              onChange={e => updateSession(i, { waktu_mulai: e.target.value })}
                              style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                              <Clock size={10} /> Selesai
                            </label>
                            <input type="time" value={s.waktu_selesai}
                              onChange={e => updateSession(i, { waktu_selesai: e.target.value })}
                              style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                              <Mic size={10} /> Pembicara <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input type="text" placeholder="Nama pembicara…" value={s.pembicara}
                              onChange={e => updateSession(i, { pembicara: e.target.value })}
                              style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
                              <BookOpen size={10} /> Topik
                            </label>
                            <input type="text" placeholder="Topik/materi (opsional)…" value={s.topik}
                              onChange={e => updateSession(i, { topik: e.target.value })}
                              style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Link & dokumen pendukung — opsional */}
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => setShowLinks(s => !s)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showLinks ? 10 : 0,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Link2 size={12} color="#9ca3af" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Link &amp; Dokumen Pendukung</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(opsional)</span>
              </div>
              {showLinks ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
            </button>
            {showLinks && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {LINK_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>{f.label}</label>
                    <input type="text" placeholder="https://…" value={links[f.key]}
                      onChange={e => setLinks(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#8b5cf6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lampiran + Checklist */}
          <div style={{ marginTop: 24 }}>
            <KegiatanAttachments currentUser={currentUser} kegiatanId={editing?.id ?? null} />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              width: "100%", padding: "13px", border: "none", borderRadius: 13, marginTop: 20,
              fontSize: 14, fontWeight: 700, cursor: (!isValid || submitting) ? "not-allowed" : "pointer",
              background: (!isValid || submitting) ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: (!isValid || submitting) ? "none" : "0 8px 20px rgba(139,92,246,0.35)",
            }}>
            {submitting
              ? <><Loader2 size={15} className="spin" /> Menyimpan…</>
              : <><GraduationCap size={16} /> {editing ? "Perbarui Batch CSSL" : "Buat Batch CSSL"}</>
            }
          </motion.button>
        </div>
      </motion.div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}
