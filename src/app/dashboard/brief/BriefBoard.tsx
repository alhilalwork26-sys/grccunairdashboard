"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Edit2, Trash2, CheckCircle, AlertCircle,
  ExternalLink, Palette, Send, RefreshCw,
  Check, ChevronRight, User, Clock, ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { CreativeBrief, UserProfile } from "@/types";

/* ── Column config ── */
const COLS: { key: CreativeBrief["status"]; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { key: "open",        label: "Dibuka",     color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6" },
  { key: "in_progress", label: "Dikerjakan", color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  { key: "delivered",   label: "Dikirim",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6" },
  { key: "revision",    label: "Revisi",     color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316" },
  { key: "done",        label: "Selesai",    color: "#059669", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981" },
];

const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Facebook", "Other", "Multi-platform"];
const EMPTY_FORM = { judul: "", deskripsi: "", platform: "", referensi_url: "", deadline: "", assigned_to: "" };

const WORKFLOW_STEPS = [
  { key: "open",        label: "Brief Dibuka" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "delivered",   label: "Dikirim" },
  { key: "revision",    label: "Revisi" },
  { key: "done",        label: "Selesai" },
];

interface Props {
  initialBriefs: CreativeBrief[];
  kreatifProfiles: Pick<UserProfile, "id" | "full_name">[];
  currentUser: UserProfile;
}

export default function BriefBoard({ initialBriefs, kreatifProfiles, currentUser }: Props) {
  const [briefs, setBriefs]               = useState(initialBriefs);
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState<CreativeBrief | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);
  const [deliverModal, setDeliverModal]   = useState<{ id: string } | null>(null);
  const [outputUrl, setOutputUrl]         = useState("");
  const [revisionModal, setRevisionModal] = useState<{ id: string } | null>(null);
  const [revisionNote, setRevisionNote]   = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const supabase = createClient();

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const byStatus = useMemo(() =>
    Object.fromEntries(COLS.map(c => [c.key, briefs.filter(b => b.status === c.key)])),
    [briefs]
  );

  const canCreate  = ["super_admin", "manager", "kep_marketing", "staff_marketing"].includes(currentUser.role);
  const canApprove = ["super_admin", "manager"].includes(currentUser.role);
  const isKreatif  = currentUser.role === "staff_kreatif";

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(b: CreativeBrief) {
    setEditing(b);
    setForm({ judul: b.judul, deskripsi: b.deskripsi ?? "", platform: b.platform ?? "", referensi_url: b.referensi_url ?? "", deadline: b.deadline ?? "", assigned_to: b.assigned_to ?? "" });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      judul: form.judul.trim(),
      deskripsi: form.deskripsi.trim() || null,
      platform: form.platform || null,
      referensi_url: form.referensi_url.trim() || null,
      deadline: form.deadline || null,
      assigned_to: form.assigned_to || null,
      requested_by: currentUser.id,
    };
    const sel = "*, requester:profiles!creative_briefs_requested_by_fkey(full_name,role), assignee:profiles!creative_briefs_assigned_to_fkey(full_name,role)";
    if (editing) {
      const { data, error } = await supabase.from("creative_briefs").update(payload).eq("id", editing.id).select(sel).single();
      if (!error && data) { setBriefs(p => p.map(b => b.id === editing.id ? data : b)); showToast("Brief diperbarui"); }
      else showToast("Gagal memperbarui", "err");
    } else {
      const { data, error } = await supabase.from("creative_briefs").insert(payload).select(sel).single();
      if (!error && data) { setBriefs(p => [data, ...p]); showToast("Brief dibuat"); }
      else showToast("Gagal membuat brief", "err");
    }
    setSubmitting(false); setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("creative_briefs").delete().eq("id", deleteId);
    if (!error) { setBriefs(p => p.filter(b => b.id !== deleteId)); showToast("Brief dihapus"); }
    else showToast("Gagal menghapus", "err");
    setDeleteId(null);
  }

  async function startWork(id: string) {
    const { error } = await supabase.from("creative_briefs").update({ status: "in_progress" }).eq("id", id);
    if (!error) { setBriefs(p => p.map(b => b.id === id ? { ...b, status: "in_progress" } : b)); showToast("Pengerjaan dimulai!"); }
  }

  async function submitDeliver(e: React.FormEvent) {
    e.preventDefault();
    if (!deliverModal) return;
    if (!outputUrl.trim()) { showToast("Link output wajib diisi", "err"); return; }
    const { error } = await supabase.from("creative_briefs").update({ status: "delivered", output_url: outputUrl.trim() }).eq("id", deliverModal.id);
    if (!error) {
      setBriefs(p => p.map(b => b.id === deliverModal.id ? { ...b, status: "delivered", output_url: outputUrl.trim() } : b));
      showToast("Hasil berhasil dikirim!");
    }
    setDeliverModal(null); setOutputUrl("");
  }

  async function approveBrief(id: string) {
    const { error } = await supabase.from("creative_briefs").update({ status: "done" }).eq("id", id);
    if (!error) { setBriefs(p => p.map(b => b.id === id ? { ...b, status: "done" } : b)); showToast("Brief disetujui!"); }
  }

  async function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!revisionModal) return;
    const { error } = await supabase.from("creative_briefs").update({ status: "revision", revision_note: revisionNote.trim() || null }).eq("id", revisionModal.id);
    if (!error) {
      setBriefs(p => p.map(b => b.id === revisionModal.id ? { ...b, status: "revision", revision_note: revisionNote.trim() || null } : b));
      showToast("Revisi diminta");
    }
    setRevisionModal(null); setRevisionNote("");
  }

  function deadlineDaysLeft(deadline: string) {
    const d = new Date(deadline); const now = new Date(); now.setHours(0,0,0,0);
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8fafc" }}>
      <Topbar user={currentUser} title="Brief Kreatif" />

      <div style={{ flex: 1, padding: "24px 24px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Palette size={18} color="white" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>Brief Kreatif</h1>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", marginLeft: 46 }}>
              Permintaan desain dari tim marketing ke tim kreatif · <b style={{ color: "#0f172a" }}>{briefs.length}</b> brief aktif
            </p>
          </div>
          {canCreate && (
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", border: "none", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.35)", whiteSpace: "nowrap", flexShrink: 0 }}>
              <Plus size={16} /> Buat Brief
            </motion.button>
          )}
        </div>

        {/* ── Workflow hint ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, background: "white", borderRadius: 14, border: "1px solid #f1f5f9", padding: "12px 20px", overflowX: "auto" }}>
          {WORKFLOW_STEPS.map((step, i) => {
            const col = COLS.find(c => c.key === step.key)!;
            const count = byStatus[step.key]?.length ?? 0;
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{step.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 20, padding: "1px 7px" }}>{count}</span>
                  )}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <ChevronRight size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* ── Kanban ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, alignItems: "start" }}>
          {COLS.map(col => {
            const cards = byStatus[col.key] ?? [];
            return (
              <div key={col.key}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.dot }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: 20, padding: "1px 8px" }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {cards.map((brief) => {
                      const isMyBrief   = brief.assigned_to === currentUser.id;
                      const isExpanded  = expandedId === brief.id;
                      const days        = brief.deadline ? deadlineDaysLeft(brief.deadline) : null;
                      const isOverdue   = days !== null && days < 0 && brief.status !== "done";
                      const isNear      = days !== null && days >= 0 && days <= 2 && brief.status !== "done";

                      return (
                        <motion.div key={brief.id} layout
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                          style={{
                            background: "white",
                            borderRadius: 14,
                            border: "1px solid #f1f5f9",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                            overflow: "hidden",
                            cursor: "pointer",
                          }}
                          whileHover={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)", y: -1 }}
                          onClick={() => setExpandedId(isExpanded ? null : brief.id)}
                        >
                          {/* Top color bar */}
                          <div style={{ height: 3, background: `linear-gradient(90deg, ${col.dot}, ${col.dot}88)` }} />

                          <div style={{ padding: "12px 14px" }}>
                            {/* Platform + Deadline */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              {brief.platform
                                ? <span style={{ fontSize: 10, fontWeight: 600, color: col.color, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 6, padding: "2px 7px" }}>{brief.platform}</span>
                                : <span />
                              }
                              {brief.deadline && (
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <Clock size={10} color={isOverdue ? "#ef4444" : isNear ? "#f97316" : "#94a3b8"} />
                                  <span style={{ fontSize: 10, fontWeight: 600, color: isOverdue ? "#ef4444" : isNear ? "#f97316" : "#94a3b8" }}>
                                    {isOverdue ? `${Math.abs(days!)}h lalu` : days === 0 ? "Hari ini!" : `${days}h lagi`}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Title */}
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.4, marginBottom: 6 }}>
                              {brief.judul}
                            </p>

                            {/* Description (collapsed) */}
                            {brief.deskripsi && (
                              <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: isExpanded ? 10 : 2, WebkitBoxOrient: "vertical" as const }}>
                                {brief.deskripsi}
                              </p>
                            )}

                            {/* From → To */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "7px 10px", background: "#f8fafc", borderRadius: 8 }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#047857)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <User size={11} color="white" />
                              </div>
                              <span style={{ fontSize: 11, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {brief.requester?.full_name ?? "—"}
                              </span>
                              <ArrowRight size={10} color="#94a3b8" style={{ flexShrink: 0 }} />
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <User size={11} color="white" />
                              </div>
                              <span style={{ fontSize: 11, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {brief.assignee?.full_name ?? <span style={{ color: "#cbd5e1" }}>Belum assign</span>}
                              </span>
                            </div>

                            {/* Revision note */}
                            {brief.revision_note && brief.status === "revision" && (
                              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: "#ea580c", marginBottom: 2 }}>Catatan Revisi</p>
                                <p style={{ fontSize: 11, color: "#9a3412", lineHeight: 1.4 }}>{brief.revision_note}</p>
                              </div>
                            )}

                            {/* Output link */}
                            {brief.output_url && (
                              <a href={brief.output_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#7c3aed", fontWeight: 600, textDecoration: "none", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 7, padding: "4px 9px", marginBottom: 8 }}>
                                <ExternalLink size={10} /> Lihat Hasil
                              </a>
                            )}

                            {/* Expanded links */}
                            {isExpanded && brief.referensi_url && (
                              <a href={brief.referensi_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#3b82f6", fontWeight: 600, textDecoration: "none", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "4px 9px", marginBottom: 8, marginLeft: brief.output_url ? 6 : 0 }}>
                                <ExternalLink size={10} /> Referensi
                              </a>
                            )}

                            {/* ── Action buttons ── */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }} onClick={e => e.stopPropagation()}>

                              {/* staff_kreatif: mulai kerjakan */}
                              {isKreatif && isMyBrief && brief.status === "open" && (
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => startWork(brief.id)}
                                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  <Send size={11} /> Mulai Kerjakan
                                </motion.button>
                              )}

                              {/* staff_kreatif: kirim hasil */}
                              {isKreatif && isMyBrief && (brief.status === "in_progress" || brief.status === "revision") && (
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setDeliverModal({ id: brief.id }); setOutputUrl(brief.output_url ?? ""); }}
                                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  <Send size={11} /> Kirim Hasil
                                </motion.button>
                              )}

                              {/* approver: selesai / revisi */}
                              {canApprove && brief.status === "delivered" && (
                                <>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => approveBrief(brief.id)}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 8px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #a7f3d0", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                    <Check size={11} /> Selesai
                                  </motion.button>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setRevisionModal({ id: brief.id }); setRevisionNote(""); }}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 8px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                    <RefreshCw size={11} /> Revisi
                                  </motion.button>
                                </>
                              )}

                              {/* edit + delete */}
                              {canCreate && (
                                <>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => openEdit(brief)}
                                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                    <Edit2 size={11} /> Edit
                                  </motion.button>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setDeleteId(brief.id)}
                                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                    <Trash2 size={11} />
                                  </motion.button>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty state */}
                  {cards.length === 0 && (
                    <div style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, color: "#94a3b8" }}>Tidak ada brief</p>
                    </div>
                  )}

                  {/* Add new (only in open column) */}
                  {col.key === "open" && canCreate && (
                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={openCreate}
                      style={{ width: "100%", padding: "10px", borderRadius: 10, border: "2px dashed #ddd6fe", background: "transparent", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Plus size={13} /> Brief Baru
                    </motion.button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 22, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 64px rgba(0,0,0,0.22)" }}>

              <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "white", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Palette size={18} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>{editing ? "Edit Brief" : "Buat Brief Baru"}</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Permintaan ke tim kreatif</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowModal(false)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#64748b" />
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "22px 26px 26px", display: "flex", flexDirection: "column", gap: 16 }}>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Judul Brief <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                    placeholder="cth: Desain Feed Ramadan — Seri 5 Post" className="clean-input"
                    style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "11px 14px" }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Deskripsi Kebutuhan</label>
                  <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                    placeholder="Jelaskan kebutuhan, konsep, tone, arahan desain, target audiens..." rows={4}
                    className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 13, padding: "11px 14px" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Platform</label>
                    <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }}>
                      <option value="">— Pilih —</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Deadline</label>
                    <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Link Referensi</label>
                  <input type="url" value={form.referensi_url} onChange={e => setForm(f => ({ ...f, referensi_url: e.target.value }))}
                    placeholder="https://pinterest.com/... atau mood board lainnya" className="clean-input"
                    style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }} />
                </div>

                {kreatifProfiles.length > 0 && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Assign ke Staff Kreatif</label>
                    <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }}>
                      <option value="">— Belum diassign —</option>
                      {kreatifProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                    Batal
                  </button>
                  <motion.button type="submit" disabled={submitting} whileTap={{ scale: 0.97 }}
                    style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: submitting ? "#a5b4fc" : "linear-gradient(135deg,#7c3aed,#4f46e5)", fontSize: 13, fontWeight: 700, color: "white", cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : "0 4px 14px rgba(124,58,237,0.3)" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui Brief" : "Buat Brief"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Deliver Modal ── */}
      <AnimatePresence>
        {deliverModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setDeliverModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 22, width: "100%", maxWidth: 440, boxShadow: "0 32px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Send size={18} color="#7c3aed" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Kirim Hasil Kerja</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Lampirkan link file hasil desain</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDeliverModal(null)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#64748b" />
                </motion.button>
              </div>
              <form onSubmit={submitDeliver} style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Link Hasil <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required type="url" value={outputUrl} onChange={e => setOutputUrl(e.target.value)}
                    placeholder="https://drive.google.com/... atau Canva, Figma, dll" className="clean-input"
                    style={{ width: "100%", boxSizing: "border-box" }} />
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Pastikan link bisa diakses oleh reviewer.</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setDeliverModal(null)}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }}
                    style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>
                    Kirim Hasil
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Revision Modal ── */}
      <AnimatePresence>
        {revisionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setRevisionModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 22, width: "100%", maxWidth: 440, boxShadow: "0 32px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RefreshCw size={18} color="#ea580c" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Minta Revisi</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Brief akan dikembalikan ke tim kreatif</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRevisionModal(null)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#64748b" />
                </motion.button>
              </div>
              <form onSubmit={submitRevision} style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Catatan Revisi</label>
                  <textarea value={revisionNote} onChange={e => setRevisionNote(e.target.value)}
                    placeholder="Jelaskan apa yang perlu diubah, diperbaiki, atau ditambahkan..." rows={4}
                    className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setRevisionModal(null)}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }}
                    style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ea580c,#dc2626)", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>
                    Kirim Revisi
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
              style={{ background: "white", borderRadius: 20, padding: "32px 28px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 32px 64px rgba(0,0,0,0.22)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Hapus Brief?</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>Brief ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleDelete} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>Hapus</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{ position: "fixed", bottom: 28, right: 28, zIndex: 200, padding: "13px 18px", borderRadius: 14, background: toast.type === "ok" ? "#0f172a" : "#ef4444", color: "white", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 9, boxShadow: "0 8px 28px rgba(0,0,0,0.22)" }}>
            {toast.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
