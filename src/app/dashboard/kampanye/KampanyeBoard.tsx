"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, MoreHorizontal, Edit2, Trash2, CheckCircle,
  Calendar, Target, Check, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { Campaign, UserProfile } from "@/types";

const STATUS_CFG: Record<Campaign["status"], { label: string; color: string; bg: string; border: string }> = {
  planning:  { label: "Perencanaan", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  active:    { label: "Aktif",       color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0" },
  completed: { label: "Selesai",     color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  cancelled: { label: "Dibatalkan",  color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
};

const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Facebook", "Other"];
const PLATFORM_COLOR: Record<string, string> = {
  Instagram: "#e1306c", TikTok: "#2d2d2d", LinkedIn: "#0077b5",
  "Twitter/X": "#1da1f2", YouTube: "#ff0000", Facebook: "#1877f2", Other: "#6b7280",
};

const TABS = [
  { key: "all", label: "Semua" },
  { key: "planning", label: "Perencanaan" },
  { key: "active", label: "Aktif" },
  { key: "completed", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
];

const EMPTY_FORM = {
  nama: "", deskripsi: "", tujuan: "", platform: [] as string[],
  periode_mulai: "", periode_selesai: "", budget: "",
  status: "planning" as Campaign["status"],
};

interface Props { initialCampaigns: Campaign[]; currentUser: UserProfile; }

export default function KampanyeBoard({ initialCampaigns, currentUser }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [tab, setTab]             = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Campaign | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [toast, setToast]         = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [menuId, setMenuId]       = useState<string | null>(null);
  const supabase = createClient();

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const filtered = useMemo(() =>
    tab === "all" ? campaigns : campaigns.filter(c => c.status === tab),
    [campaigns, tab]);

  const stats = useMemo(() => ({
    total:     campaigns.length,
    planning:  campaigns.filter(c => c.status === "planning").length,
    active:    campaigns.filter(c => c.status === "active").length,
    completed: campaigns.filter(c => c.status === "completed").length,
  }), [campaigns]);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(c: Campaign) {
    setEditing(c);
    setForm({ nama: c.nama, deskripsi: c.deskripsi ?? "", tujuan: c.tujuan ?? "", platform: c.platform ?? [], periode_mulai: c.periode_mulai ?? "", periode_selesai: c.periode_selesai ?? "", budget: c.budget ? String(c.budget) : "", status: c.status });
    setShowModal(true); setMenuId(null);
  }
  function togglePlatform(p: string) {
    setForm(f => ({ ...f, platform: f.platform.includes(p) ? f.platform.filter(x => x !== p) : [...f.platform, p] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      nama: form.nama.trim(), deskripsi: form.deskripsi.trim() || null, tujuan: form.tujuan.trim() || null,
      platform: form.platform.length > 0 ? form.platform : null,
      periode_mulai: form.periode_mulai || null, periode_selesai: form.periode_selesai || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      status: form.status, created_by: currentUser.id,
    };
    if (editing) {
      const { data, error } = await supabase.from("campaigns").update(payload).eq("id", editing.id).select("*, creator:profiles!campaigns_created_by_fkey(full_name)").single();
      if (!error && data) { setCampaigns(p => p.map(c => c.id === editing.id ? data : c)); showToast("Kampanye diperbarui"); }
      else showToast("Gagal memperbarui", "err");
    } else {
      const { data, error } = await supabase.from("campaigns").insert(payload).select("*, creator:profiles!campaigns_created_by_fkey(full_name)").single();
      if (!error && data) { setCampaigns(p => [data, ...p]); showToast("Kampanye dibuat"); }
      else showToast("Gagal membuat kampanye", "err");
    }
    setSubmitting(false); setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", deleteId);
    if (!error) { setCampaigns(p => p.filter(c => c.id !== deleteId)); showToast("Kampanye dihapus"); }
    else showToast("Gagal menghapus", "err");
    setDeleteId(null);
  }

  async function quickStatus(id: string, status: Campaign["status"]) {
    await supabase.from("campaigns").update({ status }).eq("id", id);
    setCampaigns(p => p.map(c => c.id === id ? { ...c, status } : c));
    setMenuId(null);
  }

  const canManage = ["super_admin", "manager", "kep_marketing"].includes(currentUser.role);

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Kampanye" />
      <div className="board-main" style={{ flex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Kampanye</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Kelola kampanye marketing tim GRCC.</p>
          </div>
          {canManage && (
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "#111827", border: "none", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
              <Plus size={15} /> Buat Kampanye
            </motion.button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total",        value: stats.total,     color: "#111827" },
            { label: "Perencanaan",  value: stats.planning,  color: "#6b7280" },
            { label: "Aktif",        value: stats.active,    color: "#10b981" },
            { label: "Selesai",      value: stats.completed, color: "#3b82f6" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "white", border: "1px solid #f3f4f6", borderRadius: 12, padding: 4 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "7px 12px", borderRadius: 9, border: "none", background: active ? "#111827" : "transparent", color: active ? "white" : "#6b7280", fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer", transition: "all 0.15s" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                <Target size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 14 }}>Belum ada kampanye</p>
                {canManage && <button onClick={openCreate} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 10, background: "#111827", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>+ Buat Pertama</button>}
              </motion.div>
            ) : filtered.map((c, i) => {
              const cfg = STATUS_CFG[c.status];
              return (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 16, padding: "18px 20px", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, background: cfg.bg, fontSize: 11, fontWeight: 600, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                    {canManage && (
                      <div style={{ position: "relative" }}>
                        <motion.button whileHover={{ background: "#f3f4f6" }} onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <MoreHorizontal size={14} color="#9ca3af" />
                        </motion.button>
                        <AnimatePresence>
                          {menuId === c.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.93, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -4 }}
                              style={{ position: "absolute", right: 0, top: 32, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", minWidth: 164, padding: 4 }}>
                              <button onClick={() => openEdit(c)} style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#374151", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                                <Edit2 size={11} /> Edit
                              </button>
                              {(["planning", "active", "completed", "cancelled"] as Campaign["status"][]).filter(s => s !== c.status).map(s => (
                                <button key={s} onClick={() => quickStatus(c.id, s)}
                                  style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: STATUS_CFG[s].color, display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                                  <Check size={11} /> {STATUS_CFG[s].label}
                                </button>
                              ))}
                              <div style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }} />
                              <button onClick={() => { setDeleteId(c.id); setMenuId(null); }}
                                style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#ef4444", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                                <Trash2 size={11} /> Hapus
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{c.nama}</h3>
                  {c.deskripsi && (
                    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"] }}>{c.deskripsi}</p>
                  )}
                  {c.tujuan && (
                    <p style={{ fontSize: 11, color: "#10b981", fontWeight: 500, marginBottom: 8, fontStyle: "italic" }}>🎯 {c.tujuan}</p>
                  )}

                  {c.platform && c.platform.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {c.platform.map(p => (
                        <span key={p} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${PLATFORM_COLOR[p] ?? "#6b7280"}18`, color: PLATFORM_COLOR[p] ?? "#6b7280" }}>{p}</span>
                      ))}
                    </div>
                  )}

                  {(c.periode_mulai || c.periode_selesai) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
                      <Calendar size={11} />
                      {c.periode_mulai && new Date(c.periode_mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      {c.periode_mulai && c.periode_selesai && " – "}
                      {c.periode_selesai && new Date(c.periode_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  )}
                  {c.budget && (
                    <p style={{ fontSize: 11, color: "#374151", fontWeight: 600, marginTop: 6 }}>Rp {c.budget.toLocaleString("id-ID")}</p>
                  )}
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
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}><Target size={16} color="#10b981" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Kampanye" : "Buat Kampanye Baru"}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Isi detail kampanye marketing</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nama Kampanye *</label>
                  <input required value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Kampanye Ramadan 2026" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Deskripsi singkat..." rows={2} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tujuan</label>
                  <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))} placeholder="Contoh: Tingkatkan follower 10% dalam 1 bulan" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tanggal Mulai</label>
                    <input type="date" value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tanggal Selesai</label>
                    <input type="date" value={form.periode_selesai} onChange={e => setForm(f => ({ ...f, periode_selesai: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Platform Target</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {PLATFORMS.map(p => {
                      const selected = form.platform.includes(p);
                      const col = PLATFORM_COLOR[p] ?? "#6b7280";
                      return (
                        <button key={p} type="button" onClick={() => togglePlatform(p)}
                          style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${selected ? col : "#e5e7eb"}`, background: selected ? `${col}18` : "transparent", color: selected ? col : "#6b7280", fontSize: 12, fontWeight: selected ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Budget (Rp)</label>
                    <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="Opsional" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Campaign["status"] }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="planning">Perencanaan</option>
                      <option value="active">Aktif</option>
                      <option value="completed">Selesai</option>
                      <option value="cancelled">Dibatalkan</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submitting ? "#9ca3af" : "#111827", fontSize: 13, fontWeight: 600, color: "white", cursor: submitting ? "not-allowed" : "pointer" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui" : "Buat Kampanye"}
                  </button>
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
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: "white", borderRadius: 18, padding: "28px", maxWidth: 360, width: "90%", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Trash2 size={22} color="#ef4444" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Hapus Kampanye?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 22 }}>Kampanye ini akan dihapus permanen.</p>
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
