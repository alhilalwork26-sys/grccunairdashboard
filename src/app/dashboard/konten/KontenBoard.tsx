"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Edit2, Trash2, CheckCircle, AlertCircle,
  Calendar, ExternalLink, ThumbsUp, ThumbsDown, FileImage,
  ChevronDown, Check, MoreHorizontal, Search, ChevronLeft,
  ChevronRight, Copy, List, LayoutGrid,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { ContentPost, Campaign, UserProfile } from "@/types";

type ViewMode = "table" | "kanban" | "calendar";

const STATUS_CFG: Record<ContentPost["status"], { label: string; color: string; bg: string; border: string }> = {
  draft:    { label: "Draft",      color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  review:   { label: "Review",     color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  approved: { label: "Disetujui",  color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0" },
  rejected: { label: "Ditolak",    color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  posted:   { label: "Tayang",     color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
};

const KANBAN_COLS: ContentPost["status"][] = ["draft", "review", "approved", "rejected", "posted"];

const PLATFORM_COLOR: Record<string, string> = {
  Instagram: "#e1306c", TikTok: "#2d2d2d", LinkedIn: "#0077b5",
  "Twitter/X": "#1da1f2", YouTube: "#ff0000", Facebook: "#1877f2", Other: "#6b7280",
};

const PLATFORMS  = ["Instagram", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Facebook", "Other"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_NAMES   = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

const TABS = [
  { key: "all",      label: "Semua"     },
  { key: "draft",    label: "Draft"     },
  { key: "review",   label: "Review"    },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak"   },
  { key: "posted",   label: "Tayang"    },
];

const EMPTY_FORM = {
  judul: "", platform: "Instagram", caption: "", hashtags: "",
  visual_url: "", scheduled_date: "", campaign_id: "",
  status: "draft" as ContentPost["status"],
};

interface Props {
  initialPosts: ContentPost[];
  campaigns: Pick<Campaign, "id" | "nama">[];
  currentUser: UserProfile;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function KontenBoard({ initialPosts, campaigns, currentUser }: Props) {
  const [posts, setPosts]               = useState(initialPosts);
  const [viewMode, setViewMode]         = useState<ViewMode>("table");
  const [tab, setTab]                   = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [searchQuery, setSearchQuery]   = useState("");
  const [calDate, setCalDate]           = useState(() => {
    const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<ContentPost | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [rejectModal, setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote]     = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [toast, setToast]               = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [menuId, setMenuId]             = useState<string | null>(null);
  const [calPopup, setCalPopup]         = useState<{ day: number; posts: ContentPost[] } | null>(null);
  const supabase = createClient();

  // Close menus on outside click
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuId(null); setCalPopup(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2800);
  }

  // ── Filtered list (table + kanban) ────────────────────────────────────────
  const filtered = useMemo(() => posts.filter(p => {
    if (tab !== "all" && p.status !== tab) return false;
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.judul.toLowerCase().includes(q) && !(p.caption ?? "").toLowerCase().includes(q) && !(p.platform ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [posts, tab, platformFilter, searchQuery]);

  const stats = useMemo(() => ({
    total:    posts.length,
    review:   posts.filter(p => p.status === "review").length,
    approved: posts.filter(p => p.status === "approved").length,
    posted:   posts.filter(p => p.status === "posted").length,
  }), [posts]);

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const { year, month } = calDate;
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calDate]);

  const postsByDate = useMemo(() => {
    const map: Record<string, ContentPost[]> = {};
    posts.forEach(p => {
      if (!p.scheduled_date) return;
      const key = p.scheduled_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [posts]);

  function calKey(day: number) {
    const { year, month } = calDate;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    setCalDate(d => d.month === 0 ? { year: d.year - 1, month: 11 } : { ...d, month: d.month - 1 });
    setCalPopup(null);
  }
  function nextMonth() {
    setCalDate(d => d.month === 11 ? { year: d.year + 1, month: 0 } : { ...d, month: d.month + 1 });
    setCalPopup(null);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(p: ContentPost) {
    setEditing(p);
    setForm({ judul: p.judul, platform: p.platform, caption: p.caption ?? "", hashtags: p.hashtags ?? "", visual_url: p.visual_url ?? "", scheduled_date: p.scheduled_date ?? "", campaign_id: p.campaign_id ?? "", status: p.status });
    setShowModal(true); setMenuId(null); setCalPopup(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    const payload = {
      judul: form.judul.trim(), platform: form.platform,
      caption: form.caption.trim() || null, hashtags: form.hashtags.trim() || null,
      visual_url: form.visual_url.trim() || null, scheduled_date: form.scheduled_date || null,
      campaign_id: form.campaign_id || null, status: form.status, created_by: currentUser.id,
    };
    const sel = "*, creator:profiles!content_posts_created_by_fkey(full_name, role), campaign:campaigns!content_posts_campaign_id_fkey(nama)";
    if (editing) {
      const { data, error } = await supabase.from("content_posts").update(payload).eq("id", editing.id).select(sel).single();
      if (!error && data) { setPosts(p => p.map(x => x.id === editing.id ? data : x)); showToast("Konten diperbarui"); }
      else showToast("Gagal memperbarui", "err");
    } else {
      const { data, error } = await supabase.from("content_posts").insert(payload).select(sel).single();
      if (!error && data) { setPosts(p => [data, ...p]); showToast("Konten ditambahkan"); }
      else showToast("Gagal menambahkan", "err");
    }
    setSubmitting(false); setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("content_posts").delete().eq("id", deleteId);
    if (!error) { setPosts(p => p.filter(x => x.id !== deleteId)); showToast("Konten dihapus"); }
    else showToast("Gagal menghapus", "err");
    setDeleteId(null); setCalPopup(null);
  }

  async function quickStatus(id: string, status: ContentPost["status"]) {
    await supabase.from("content_posts").update({ status }).eq("id", id);
    setPosts(p => p.map(x => x.id === id ? { ...x, status } : x));
    setMenuId(null);
  }

  async function approvePost(id: string) {
    const now = new Date().toISOString();
    await supabase.from("content_posts").update({ status: "approved", approved_by: currentUser.id, approved_at: now, rejection_note: null }).eq("id", id);
    setPosts(p => p.map(x => x.id === id ? { ...x, status: "approved", approved_by: currentUser.id, approved_at: now } : x));
    showToast("Konten disetujui"); setCalPopup(null);
  }

  async function submitReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectModal) return;
    await supabase.from("content_posts").update({ status: "rejected", rejection_note: rejectNote.trim() || null }).eq("id", rejectModal.id);
    setPosts(p => p.map(x => x.id === rejectModal.id ? { ...x, status: "rejected", rejection_note: rejectNote.trim() || null } : x));
    showToast("Konten ditolak"); setRejectModal(null); setRejectNote("");
  }

  async function duplicatePost(post: ContentPost) {
    const sel = "*, creator:profiles!content_posts_created_by_fkey(full_name, role), campaign:campaigns!content_posts_campaign_id_fkey(nama)";
    const { data, error } = await supabase.from("content_posts").insert({
      judul: `${post.judul} (copy)`, platform: post.platform,
      caption: post.caption, hashtags: post.hashtags, visual_url: post.visual_url,
      campaign_id: post.campaign_id, status: "draft", created_by: currentUser.id,
    }).select(sel).single();
    if (!error && data) { setPosts(p => [data, ...p]); showToast("Konten diduplikat"); }
    setMenuId(null);
  }

  const canCreate  = ["super_admin", "manager", "kep_marketing", "staff_marketing"].includes(currentUser.role);
  const canApprove = currentUser.role === "super_admin";

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // ── SHARED MENU ──────────────────────────────────────────────────────────
  function PostMenu({ post }: { post: ContentPost }) {
    return (
      <AnimatePresence>
        {menuId === post.id && (
          <motion.div initial={{ opacity: 0, scale: 0.93, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -4 }}
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", right: 0, top: 32, zIndex: 60, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", minWidth: 164, padding: 4 }}>
            {post.status === "approved" && (
              <button onClick={() => quickStatus(post.id, "posted")} style={menuBtn("#0369a1")}><Check size={11} /> Tandai Tayang</button>
            )}
            {post.status !== "review" && (
              <button onClick={() => quickStatus(post.id, "review")} style={menuBtn("#7c3aed")}><ChevronDown size={11} /> Kirim Review</button>
            )}
            <button onClick={() => openEdit(post)} style={menuBtn("#374151")}><Edit2 size={11} /> Edit</button>
            <button onClick={() => duplicatePost(post)} style={menuBtn("#374151")}><Copy size={11} /> Duplikat</button>
            <div style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }} />
            <button onClick={() => { setDeleteId(post.id); setMenuId(null); }} style={menuBtn("#ef4444")}><Trash2 size={11} /> Hapus</button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  function menuBtn(color: string): React.CSSProperties {
    return { width: "100%", padding: "7px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", color, display: "flex", alignItems: "center", gap: 8, borderRadius: 6 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div ref={rootRef} className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Konten Plan" />
      <div style={{ flex: 1, padding: "24px 24px 40px" }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Konten Plan</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Rencanakan dan track semua konten media sosial.</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 3, gap: 2 }}>
              {([
                { mode: "table",    icon: <List size={14} /> },
                { mode: "kanban",   icon: <LayoutGrid size={14} /> },
                { mode: "calendar", icon: <Calendar size={14} /> },
              ] as { mode: ViewMode; icon: React.ReactNode }[]).map(({ mode, icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ width: 32, height: 32, borderRadius: 7, border: "none", background: viewMode === mode ? "#111827" : "transparent", color: viewMode === mode ? "white" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                  {icon}
                </button>
              ))}
            </div>
            {canCreate && (
              <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "#111827", border: "none", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                <Plus size={15} /> Tambah Konten
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Konten",    value: stats.total,    color: "#111827" },
            { label: "Menunggu Review", value: stats.review,   color: "#7c3aed" },
            { label: "Disetujui",       value: stats.approved, color: "#10b981" },
            { label: "Sudah Tayang",    value: stats.posted,   color: "#0369a1" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 18px" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TABLE VIEW
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === "table" && (
          <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden" }}>
            {/* Tab bar + search + platform */}
            <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "0 16px", gap: 0, alignItems: "center" }}>
              {TABS.map(t => {
                const count  = t.key === "all" ? posts.length : posts.filter(p => p.status === t.key).length;
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ position: "relative", padding: "13px 14px 12px", fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "#111827" : "#6b7280", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {t.label}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: active ? "#111827" : "#f3f4f6", color: active ? "white" : "#6b7280" }}>{count}</span>
                    {active && <motion.div layoutId="konten-tab" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#111827", borderRadius: 2 }} />}
                  </button>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                {/* Search */}
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari konten..."
                    style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", width: 160 }} />
                </div>
                <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", cursor: "pointer" }}>
                  <option value="all">Semua Platform</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 130px 110px 130px 48px", padding: "9px 18px", borderBottom: "1px solid #f9fafb", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span>Konten</span><span>Platform</span><span>Kampanye</span><span>Jadwal</span><span>Status</span><span></span>
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "52px 0", textAlign: "center" }}>
                  <FileImage size={36} style={{ color: "#e5e7eb", margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, color: "#9ca3af" }}>
                    {searchQuery ? `Tidak ada konten untuk "${searchQuery}"` : "Belum ada konten"}
                  </p>
                  {canCreate && !searchQuery && (
                    <button onClick={openCreate} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 10, background: "#111827", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>+ Tambah Pertama</button>
                  )}
                </motion.div>
              ) : filtered.map((post, i) => {
                const sc  = STATUS_CFG[post.status];
                const col = PLATFORM_COLOR[post.platform] ?? "#6b7280";
                return (
                  <motion.div key={post.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }} transition={{ delay: i * 0.03 }}
                    whileHover={{ background: "#fafafa" }}
                    style={{ display: "grid", gridTemplateColumns: "1fr 110px 130px 110px 130px 48px", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f9fafb", transition: "background 0.15s" }}>
                    {/* Konten */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.judul}</p>
                      {post.caption && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.caption}</p>}
                      {post.rejection_note && post.status === "rejected" && (
                        <p style={{ fontSize: 10, color: "#ef4444", marginTop: 2, fontWeight: 500 }}>↩ {post.rejection_note}</p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                        {post.visual_url && (
                          <a href={post.visual_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "#3b82f6", textDecoration: "none" }}>
                            <ExternalLink size={9} /> Aset visual
                          </a>
                        )}
                        {post.creator && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#9ca3af" }}>
                            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#6b7280" }}>{getInitials(post.creator.full_name)}</span>
                            {post.creator.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Platform */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `${col}18`, color: col }}>{post.platform}</span>
                    </div>
                    {/* Kampanye */}
                    <div>
                      {post.campaign
                        ? <span style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{post.campaign.nama}</span>
                        : <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>}
                    </div>
                    {/* Jadwal */}
                    <div>
                      {post.scheduled_date
                        ? <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
                            <Calendar size={11} />
                            {new Date(post.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </div>
                        : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                    </div>
                    {/* Status + approve/reject */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 6, background: sc.bg, fontSize: 11, fontWeight: 600, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                        {sc.label}
                      </span>
                      {post.status === "review" && canApprove && (
                        <>
                          <motion.button whileHover={{ background: "#f0fdf4" }} whileTap={{ scale: 0.9 }} onClick={() => approvePost(post.id)} title="Setujui"
                            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #a7f3d0", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <ThumbsUp size={11} color="#10b981" />
                          </motion.button>
                          <motion.button whileHover={{ background: "#fef2f2" }} whileTap={{ scale: 0.9 }} onClick={() => { setRejectModal({ id: post.id }); setRejectNote(""); }} title="Tolak"
                            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <ThumbsDown size={11} color="#ef4444" />
                          </motion.button>
                        </>
                      )}
                    </div>
                    {/* Menu */}
                    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                      <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setMenuId(menuId === post.id ? null : post.id)}
                        style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <MoreHorizontal size={14} color="#6b7280" />
                      </motion.button>
                      <PostMenu post={post} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            KANBAN VIEW
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === "kanban" && (
          <div>
            {/* Search + platform above kanban */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari konten..."
                  style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "white", outline: "none", width: 200 }} />
              </div>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "white", outline: "none", cursor: "pointer" }}>
                <option value="all">Semua Platform</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
              {KANBAN_COLS.map(status => {
                const sc    = STATUS_CFG[status];
                const cards = filtered.filter(p => p.status === status);
                return (
                  <div key={status} style={{ background: "#f3f4f6", borderRadius: 14, padding: "12px 10px", minHeight: 200 }}>
                    {/* Column header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{sc.label}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: "1px 7px", borderRadius: 20 }}>{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {cards.map(post => {
                          const col = PLATFORM_COLOR[post.platform] ?? "#6b7280";
                          return (
                            <motion.div key={post.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                              style={{ background: "white", borderRadius: 12, border: "1px solid #f0f0f0", padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${col}18`, color: col }}>{post.platform}</span>
                                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => setMenuId(menuId === post.id ? null : post.id)}
                                    style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                    <MoreHorizontal size={12} color="#9ca3af" />
                                  </button>
                                  <PostMenu post={post} />
                                </div>
                              </div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4, lineHeight: 1.4 }}>{post.judul}</p>
                              {post.caption && (
                                <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{post.caption}</p>
                              )}
                              {post.rejection_note && (
                                <p style={{ fontSize: 10, color: "#ef4444", marginTop: 4, fontWeight: 500 }}>↩ {post.rejection_note}</p>
                              )}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {post.scheduled_date && (
                                    <span style={{ fontSize: 10, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
                                      <Calendar size={9} />
                                      {new Date(post.scheduled_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 3 }}>
                                  {post.visual_url && (
                                    <a href={post.visual_url} target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af", display: "flex", alignItems: "center" }}>
                                      <ExternalLink size={10} />
                                    </a>
                                  )}
                                  {post.status === "review" && canApprove && (
                                    <>
                                      <button onClick={() => approvePost(post.id)} style={{ width: 20, height: 20, borderRadius: 5, border: "1px solid #a7f3d0", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ThumbsUp size={9} color="#10b981" /></button>
                                      <button onClick={() => { setRejectModal({ id: post.id }); setRejectNote(""); }} style={{ width: 20, height: 20, borderRadius: 5, border: "1px solid #fca5a5", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ThumbsDown size={9} color="#ef4444" /></button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {post.creator && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 8, borderTop: "1px solid #f9fafb" }}>
                                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#6b7280" }}>{getInitials(post.creator.full_name)}</div>
                                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{post.creator.full_name}</span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {cards.length === 0 && (
                        <div style={{ padding: "20px 0", textAlign: "center" }}>
                          <p style={{ fontSize: 11, color: "#d1d5db" }}>Tidak ada konten</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CALENDAR VIEW
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === "calendar" && (
          <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden" }}>
            {/* Calendar nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={prevMonth}
                style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #e5e7eb", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronLeft size={16} color="#6b7280" />
              </motion.button>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{MONTH_NAMES[calDate.month]} {calDate.year}</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                  {posts.filter(p => p.scheduled_date?.startsWith(`${calDate.year}-${String(calDate.month + 1).padStart(2, "0")}`)).length} konten dijadwalkan
                </p>
              </div>
              <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={nextMonth}
                style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #e5e7eb", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronRight size={16} color="#6b7280" />
              </motion.button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f3f4f6" }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em" }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} style={{ minHeight: 110, borderRight: "1px solid #f9fafb", borderBottom: "1px solid #f9fafb", background: "#fafafa" }} />;
                }
                const key       = calKey(day);
                const dayPosts  = postsByDate[key] ?? [];
                const isToday   = key === todayKey;
                const visible   = dayPosts.slice(0, 3);
                const overflow  = dayPosts.length - visible.length;
                return (
                  <div key={key} style={{ minHeight: 110, borderRight: "1px solid #f9fafb", borderBottom: "1px solid #f9fafb", padding: 6, position: "relative", background: isToday ? "#fafbff" : "white", cursor: dayPosts.length > 0 ? "pointer" : "default" }}
                    onClick={() => dayPosts.length > 0 && setCalPopup(calPopup?.day === day ? null : { day, posts: dayPosts })}>
                    {/* Day number */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? "#111827" : "transparent", color: isToday ? "white" : "#374151", fontSize: 12, fontWeight: isToday ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center" }}>{day}</span>
                    </div>
                    {/* Post chips */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {visible.map(p => {
                        const col = PLATFORM_COLOR[p.platform] ?? "#6b7280";
                        const sc  = STATUS_CFG[p.status];
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 5px", borderRadius: 4, background: `${col}15`, overflow: "hidden" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.judul}</span>
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div style={{ fontSize: 10, color: "#9ca3af", padding: "1px 5px", fontWeight: 500 }}>+{overflow} lainnya</div>
                      )}
                    </div>

                    {/* Popup */}
                    <AnimatePresence>
                      {calPopup?.day === day && (
                        <motion.div initial={{ opacity: 0, scale: 0.93, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 6 }}
                          onClick={e => e.stopPropagation()}
                          style={{ position: "absolute", top: "100%", left: 0, zIndex: 80, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.14)", width: 260, padding: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                            {day} {MONTH_NAMES[calDate.month]}
                            <span style={{ fontWeight: 500, color: "#9ca3af" }}> — {dayPosts.length} konten</span>
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                            {dayPosts.map(p => {
                              const col = PLATFORM_COLOR[p.platform] ?? "#6b7280";
                              const sc  = STATUS_CFG[p.status];
                              return (
                                <div key={p.id} style={{ padding: "8px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{p.platform}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                                  </div>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{p.judul}</p>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    {p.visual_url && (
                                      <a href={p.visual_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#3b82f6", display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}>
                                        <ExternalLink size={9} /> Aset
                                      </a>
                                    )}
                                    {canCreate && (
                                      <button onClick={() => openEdit(p)} style={{ fontSize: 10, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 2 }}>
                                        <Edit2 size={9} /> Edit
                                      </button>
                                    )}
                                    {p.status === "review" && canApprove && (
                                      <>
                                        <button onClick={() => approvePost(p.id)} style={{ fontSize: 10, color: "#10b981", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 2 }}>
                                          <ThumbsUp size={9} /> Setujui
                                        </button>
                                        <button onClick={() => { setRejectModal({ id: p.id }); setRejectNote(""); setCalPopup(null); }} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 2 }}>
                                          <ThumbsDown size={9} /> Tolak
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {canCreate && (
                            <button onClick={() => { setForm({ ...EMPTY_FORM, scheduled_date: key }); setEditing(null); setShowModal(true); setCalPopup(null); }}
                              style={{ width: "100%", marginTop: 8, padding: "7px", borderRadius: 8, border: "1px dashed #e5e7eb", background: "transparent", fontSize: 11, fontWeight: 600, color: "#9ca3af", cursor: "pointer" }}>
                              + Tambah konten di tanggal ini
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Status:</span>
              {Object.entries(STATUS_CFG).map(([key, sc]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{sc.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ─────────────────────────────────────────────── */}
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
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}><FileImage size={16} color="#7c3aed" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Konten" : "Tambah Konten"}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Isi detail rencana konten</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Judul Konten *</label>
                  <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="Contoh: Tips GRCC #1 — Pentingnya GRC" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Platform *</label>
                    <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContentPost["status"] }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="approved">Disetujui</option>
                      <option value="posted">Tayang</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Caption</label>
                  <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Caption untuk postingan..." rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Hashtag</label>
                  <input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#grcc #unair #grc" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link Aset Visual (Canva / Drive)</label>
                  <input type="url" value={form.visual_url} onChange={e => setForm(f => ({ ...f, visual_url: e.target.value }))} placeholder="https://canva.com/..." className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Jadwal Posting</label>
                    <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kampanye</label>
                    <select value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="">— Tidak ada —</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" disabled={submitting} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submitting ? "#9ca3af" : "#111827", fontSize: 13, fontWeight: 600, color: "white", cursor: submitting ? "not-allowed" : "pointer" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui" : "Tambah Konten"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setRejectModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 420, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}><ThumbsDown size={16} color="#ef4444" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Tolak Konten</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Beri catatan untuk tim</p>
                  </div>
                </div>
                <button onClick={() => setRejectModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#6b7280" /></button>
              </div>
              <form onSubmit={submitReject} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan penolakan</label>
                  <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Apa yang perlu diperbaiki?" rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setRejectModal(null)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <button type="submit" style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Tolak Konten</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: "white", borderRadius: 18, padding: "28px", maxWidth: 360, width: "90%", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Trash2 size={22} color="#ef4444" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Hapus Konten?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 22 }}>Konten ini akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                <button onClick={handleDelete} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Hapus</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
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
