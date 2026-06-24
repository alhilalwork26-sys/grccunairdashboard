"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Edit2, Trash2, CheckCircle, AlertCircle,
  Calendar, ExternalLink, Palette, MoreHorizontal,
  Send, RefreshCw, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { CreativeBrief, UserProfile } from "@/types";

const STATUS_CFG: Record<CreativeBrief["status"], { label: string; color: string; bg: string; border: string }> = {
  open:        { label: "Dibuka",      color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  in_progress: { label: "Dikerjakan",  color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  delivered:   { label: "Dikirim",     color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  revision:    { label: "Revisi",      color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
  done:        { label: "Selesai",     color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0" },
};

const TABS = [
  { key: "all",        label: "Semua"     },
  { key: "open",       label: "Dibuka"    },
  { key: "in_progress",label: "Dikerjakan"},
  { key: "delivered",  label: "Dikirim"   },
  { key: "revision",   label: "Revisi"    },
  { key: "done",       label: "Selesai"   },
];

const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Facebook", "Other", "Multi-platform"];

const EMPTY_FORM = { judul: "", deskripsi: "", platform: "", referensi_url: "", deadline: "", assigned_to: "" };

interface Props {
  initialBriefs: CreativeBrief[];
  kreatifProfiles: Pick<UserProfile, "id" | "full_name">[];
  currentUser: UserProfile;
}

export default function BriefBoard({ initialBriefs, kreatifProfiles, currentUser }: Props) {
  const [briefs, setBriefs]             = useState(initialBriefs);
  const [tab, setTab]                   = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<CreativeBrief | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deliverModal, setDeliverModal] = useState<{ id: string } | null>(null);
  const [outputUrl, setOutputUrl]       = useState("");
  const [revisionModal, setRevisionModal] = useState<{ id: string } | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [toast, setToast]               = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [menuId, setMenuId]             = useState<string | null>(null);
  const supabase = createClient();

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const filtered = useMemo(() =>
    tab === "all" ? briefs : briefs.filter(b => b.status === tab),
    [briefs, tab]);

  const stats = useMemo(() => ({
    total:       briefs.length,
    open:        briefs.filter(b => b.status === "open").length,
    in_progress: briefs.filter(b => b.status === "in_progress").length,
    delivered:   briefs.filter(b => b.status === "delivered").length,
    done:        briefs.filter(b => b.status === "done").length,
  }), [briefs]);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(b: CreativeBrief) {
    setEditing(b);
    setForm({ judul: b.judul, deskripsi: b.deskripsi ?? "", platform: b.platform ?? "", referensi_url: b.referensi_url ?? "", deadline: b.deadline ?? "", assigned_to: b.assigned_to ?? "" });
    setShowModal(true); setMenuId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      judul: form.judul.trim(), deskripsi: form.deskripsi.trim() || null,
      platform: form.platform || null, referensi_url: form.referensi_url.trim() || null,
      deadline: form.deadline || null, assigned_to: form.assigned_to || null,
      requested_by: currentUser.id,
    };
    const select = "*, requester:profiles!creative_briefs_requested_by_fkey(full_name, role), assignee:profiles!creative_briefs_assigned_to_fkey(full_name, role)";
    if (editing) {
      const { data, error } = await supabase.from("creative_briefs").update(payload).eq("id", editing.id).select(select).single();
      if (!error && data) { setBriefs(p => p.map(b => b.id === editing.id ? data : b)); showToast("Brief diperbarui"); }
      else showToast("Gagal memperbarui", "err");
    } else {
      const { data, error } = await supabase.from("creative_briefs").insert(payload).select(select).single();
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
    await supabase.from("creative_briefs").update({ status: "in_progress" }).eq("id", id);
    setBriefs(p => p.map(b => b.id === id ? { ...b, status: "in_progress" } : b));
    showToast("Mulai pengerjaan brief");
    setMenuId(null);
  }

  async function submitDeliver(e: React.FormEvent) {
    e.preventDefault();
    if (!deliverModal) return;
    if (!outputUrl.trim()) { showToast("Link output wajib diisi", "err"); return; }
    await supabase.from("creative_briefs").update({ status: "delivered", output_url: outputUrl.trim() }).eq("id", deliverModal.id);
    setBriefs(p => p.map(b => b.id === deliverModal.id ? { ...b, status: "delivered", output_url: outputUrl.trim() } : b));
    showToast("Hasil berhasil dikirim");
    setDeliverModal(null); setOutputUrl("");
  }

  async function approveBrief(id: string) {
    await supabase.from("creative_briefs").update({ status: "done" }).eq("id", id);
    setBriefs(p => p.map(b => b.id === id ? { ...b, status: "done" } : b));
    showToast("Brief selesai"); setMenuId(null);
  }

  async function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!revisionModal) return;
    await supabase.from("creative_briefs").update({ status: "revision", revision_note: revisionNote.trim() || null }).eq("id", revisionModal.id);
    setBriefs(p => p.map(b => b.id === revisionModal.id ? { ...b, status: "revision", revision_note: revisionNote.trim() || null } : b));
    showToast("Permintaan revisi dikirim");
    setRevisionModal(null); setRevisionNote("");
  }

  const canCreate  = ["super_admin", "manager", "kep_marketing", "staff_marketing"].includes(currentUser.role);
  const canApprove = currentUser.role === "super_admin";
  const isKreatif  = currentUser.role === "staff_kreatif";

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Brief Kreatif" />
      <div style={{ flex: 1, padding: "24px 24px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Brief Kreatif</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Kelola permintaan desain dari tim marketing ke tim kreatif.</p>
          </div>
          {canCreate && (
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "#111827", border: "none", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
              <Plus size={15} /> Buat Brief
            </motion.button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total",       value: stats.total,       color: "#111827" },
            { label: "Dibuka",      value: stats.open,        color: "#3b82f6" },
            { label: "Dikerjakan",  value: stats.in_progress, color: "#f59e0b" },
            { label: "Dikirim",     value: stats.delivered,   color: "#8b5cf6" },
            { label: "Selesai",     value: stats.done,        color: "#10b981" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "white", border: "1px solid #f3f4f6", borderRadius: 12, padding: 4 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "7px 8px", borderRadius: 9, border: "none", background: active ? "#111827" : "transparent", color: active ? "white" : "#6b7280", fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer", transition: "all 0.15s" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 100px 150px 48px", padding: "9px 18px", borderBottom: "1px solid #f9fafb", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span>Brief</span><span>Dari</span><span>Untuk</span><span>Deadline</span><span>Status</span><span></span>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "52px 0", textAlign: "center" }}>
                <Palette size={36} style={{ color: "#e5e7eb", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#9ca3af" }}>Belum ada brief</p>
                {canCreate && <button onClick={openCreate} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 10, background: "#111827", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>+ Buat Pertama</button>}
              </motion.div>
            ) : filtered.map((brief, i) => {
              const sc = STATUS_CFG[brief.status];
              const isMyBrief = brief.assigned_to === currentUser.id;
              const isDeadlineNear = brief.deadline && (() => {
                const d = new Date(brief.deadline); const now = new Date(); now.setHours(0,0,0,0);
                return (d.getTime() - now.getTime()) / 86400000 <= 2;
              })();

              return (
                <motion.div key={brief.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }} transition={{ delay: i * 0.04 }}
                  whileHover={{ background: "#fafafa" }}
                  style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 100px 150px 48px", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f9fafb", transition: "background 0.15s" }}>

                  {/* Brief info */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brief.judul}</p>
                    {brief.platform && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{brief.platform}</p>}
                    {brief.revision_note && brief.status === "revision" && (
                      <p style={{ fontSize: 10, color: "#f97316", marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>↩ {brief.revision_note}</p>
                    )}
                    {brief.output_url && (
                      <a href={brief.output_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: 10, color: "#3b82f6", textDecoration: "none" }}>
                        <ExternalLink size={9} /> Lihat hasil
                      </a>
                    )}
                    {brief.referensi_url && (
                      <a href={brief.referensi_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: brief.output_url ? 0 : 3, marginLeft: brief.output_url ? 8 : 0, fontSize: 10, color: "#9ca3af", textDecoration: "none" }}>
                        <ExternalLink size={9} /> Referensi
                      </a>
                    )}
                  </div>

                  {/* Requester */}
                  <div>
                    <p style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brief.requester?.full_name ?? "—"}</p>
                  </div>

                  {/* Assignee */}
                  <div>
                    <p style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brief.assignee?.full_name ?? <span style={{ color: "#d1d5db" }}>Belum assign</span>}</p>
                  </div>

                  {/* Deadline */}
                  <div>
                    {brief.deadline ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={11} style={{ color: isDeadlineNear && brief.status !== "done" ? "#ef4444" : "#9ca3af", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: isDeadlineNear && brief.status !== "done" ? "#ef4444" : "#6b7280", fontWeight: isDeadlineNear && brief.status !== "done" ? 600 : 400 }}>
                          {new Date(brief.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                  </div>

                  {/* Status + Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 6, background: sc.bg, fontSize: 11, fontWeight: 600, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                      {sc.label}
                    </span>
                    {/* staff_kreatif: start work on open brief */}
                    {isKreatif && isMyBrief && brief.status === "open" && (
                      <motion.button whileHover={{ background: "#eff6ff" }} whileTap={{ scale: 0.9 }} onClick={() => startWork(brief.id)} title="Mulai kerjakan"
                        style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Send size={11} color="#3b82f6" />
                      </motion.button>
                    )}
                    {/* staff_kreatif: deliver on in_progress */}
                    {isKreatif && isMyBrief && (brief.status === "in_progress" || brief.status === "revision") && (
                      <motion.button whileHover={{ background: "#f5f3ff" }} whileTap={{ scale: 0.9 }} onClick={() => { setDeliverModal({ id: brief.id }); setOutputUrl(brief.output_url ?? ""); }} title="Kirim hasil"
                        style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #ddd6fe", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Send size={11} color="#7c3aed" />
                      </motion.button>
                    )}
                    {/* super_admin: approve/revision on delivered */}
                    {canApprove && brief.status === "delivered" && (
                      <>
                        <motion.button whileHover={{ background: "#f0fdf4" }} whileTap={{ scale: 0.9 }} onClick={() => approveBrief(brief.id)} title="Selesai"
                          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #a7f3d0", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Check size={11} color="#10b981" />
                        </motion.button>
                        <motion.button whileHover={{ background: "#fff7ed" }} whileTap={{ scale: 0.9 }} onClick={() => { setRevisionModal({ id: brief.id }); setRevisionNote(""); }} title="Minta revisi"
                          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #fed7aa", background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <RefreshCw size={11} color="#f97316" />
                        </motion.button>
                      </>
                    )}
                  </div>

                  {/* Menu */}
                  <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                    <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setMenuId(menuId === brief.id ? null : brief.id)}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <MoreHorizontal size={14} color="#6b7280" />
                    </motion.button>
                    <AnimatePresence>
                      {menuId === brief.id && (
                        <motion.div initial={{ opacity: 0, scale: 0.93, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -4 }}
                          style={{ position: "absolute", right: 0, top: 32, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", minWidth: 152, padding: 4 }}>
                          {canCreate && (
                            <button onClick={() => openEdit(brief)} style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#374151", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                              <Edit2 size={11} /> Edit Brief
                            </button>
                          )}
                          <div style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }} />
                          <button onClick={() => { setDeleteId(brief.id); setMenuId(null); }} style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#ef4444", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                            <Trash2 size={11} /> Hapus
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}><Palette size={16} color="#7c3aed" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Brief" : "Buat Brief Baru"}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Permintaan ke tim kreatif</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Judul Brief *</label>
                  <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="Contoh: Desain Feed Ramadan — Seri 5 Post" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi Kebutuhan</label>
                  <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Jelaskan kebutuhan, konsep, tone, dan arahan desain..." rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Platform</label>
                    <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="">— Pilih platform —</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deadline</label>
                    <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link Referensi</label>
                  <input type="url" value={form.referensi_url} onChange={e => setForm(f => ({ ...f, referensi_url: e.target.value }))} placeholder="https://... (contoh desain, mood board, dll)" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                {kreatifProfiles.length > 0 && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Assign ke Staff Kreatif</label>
                    <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="">— Belum diassign —</option>
                      {kreatifProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submitting ? "#9ca3af" : "#111827", fontSize: 13, fontWeight: 600, color: "white", cursor: submitting ? "not-allowed" : "pointer" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui" : "Buat Brief"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deliver Modal */}
      <AnimatePresence>
        {deliverModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setDeliverModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 420, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}><Send size={16} color="#7c3aed" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Kirim Hasil Kerja</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Lampirkan link file hasil desain</p>
                  </div>
                </div>
                <button onClick={() => setDeliverModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={submitDeliver} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link Hasil (Google Drive, Canva, dll) *</label>
                  <input required type="url" value={outputUrl} onChange={e => setOutputUrl(e.target.value)} placeholder="https://drive.google.com/..." className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setDeliverModal(null)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#7c3aed", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Kirim Hasil</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revision Modal */}
      <AnimatePresence>
        {revisionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setRevisionModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 420, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={16} color="#f97316" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Minta Revisi</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Brief akan kembali ke tim kreatif</p>
                  </div>
                </div>
                <button onClick={() => setRevisionModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={submitRevision} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan Revisi</label>
                  <textarea value={revisionNote} onChange={e => setRevisionNote(e.target.value)} placeholder="Apa yang perlu diubah atau diperbaiki?" rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setRevisionModal(null)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#f97316", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Minta Revisi</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: "white", borderRadius: 18, padding: "28px", maxWidth: 360, width: "90%", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Trash2 size={22} color="#ef4444" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Hapus Brief?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 22 }}>Brief ini akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                <button onClick={handleDelete} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Hapus</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, padding: "12px 18px", borderRadius: 12, background: toast.type === "ok" ? "#111827" : "#ef4444", color: "white", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {toast.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
