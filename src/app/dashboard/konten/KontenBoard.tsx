"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Edit2, Trash2, CheckCircle, AlertCircle,
  Calendar, ExternalLink, ThumbsUp, ThumbsDown, FileImage,
  ChevronLeft, ChevronRight, Copy, LayoutGrid,
  Check, Search, Send, FileText, Eye, ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { ContentPost, Campaign, UserProfile } from "@/types";

/* ── Config ── */
type ViewMode = "cards" | "kanban" | "calendar";

const STATUS_CFG: Record<ContentPost["status"], { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:    { label: "Draft",     color: "#475569", bg: "#f8fafc", border: "#e2e8f0", dot: "#94a3b8" },
  review:   { label: "Review",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "#8b5cf6" },
  approved: { label: "Disetujui", color: "#059669", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981" },
  rejected: { label: "Ditolak",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
  posted:   { label: "Tayang",    color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc", dot: "#0ea5e9" },
};

const PLATFORM_CFG: Record<string, { color: string; bg: string }> = {
  Instagram:  { color: "#e1306c", bg: "#fdf2f8" },
  TikTok:     { color: "#1a1a1a", bg: "#f5f5f5" },
  LinkedIn:   { color: "#0077b5", bg: "#eff8ff" },
  "Twitter/X":{ color: "#1da1f2", bg: "#eff8ff" },
  YouTube:    { color: "#ff0000", bg: "#fff1f1" },
  Facebook:   { color: "#1877f2", bg: "#eff6ff" },
  Other:      { color: "#64748b", bg: "#f8fafc" },
};

const PLATFORMS  = ["Instagram","TikTok","LinkedIn","Twitter/X","YouTube","Facebook","Other"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_NAMES   = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];

const WORKFLOW = [
  { key: "draft",    label: "Draft",     hint: "Konten baru dibuat" },
  { key: "review",   label: "Review",    hint: "Menunggu persetujuan" },
  { key: "approved", label: "Disetujui", hint: "Siap untuk tayang" },
  { key: "posted",   label: "Tayang",    hint: "Sudah dipublish" },
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
  calendarUrl: string;
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function googleCalendarSubscribeUrl(icsUrl: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl)}`;
}

export default function KontenBoard({ initialPosts, campaigns, currentUser, calendarUrl }: Props) {
  const [posts, setPosts]         = useState(initialPosts);
  const [view, setView]           = useState<ViewMode>("cards");
  const [statusFilter, setStatus] = useState<string>("all");
  const [platform, setPlatform]   = useState("all");
  const [q, setQ]                 = useState("");
  const [calDate, setCalDate]     = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<ContentPost | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [rejectModal, setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote]     = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [toast, setToast]               = useState<{ msg: string; type: "ok"|"err" } | null>(null);
  const [calPopup, setCalPopup]         = useState<{ day: number; posts: ContentPost[] } | null>(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [copied, setCopied]               = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    function h(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setCalPopup(null);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function showToast(msg: string, type: "ok"|"err" = "ok") {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }

  const canCreate  = ["super_admin","manager","kep_marketing","staff_marketing"].includes(currentUser.role);
  const canApprove = ["super_admin","manager"].includes(currentUser.role);

  /* ── filtered ── */
  const filtered = useMemo(() => posts.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (platform !== "all" && p.platform !== platform) return false;
    if (q) {
      const lq = q.toLowerCase();
      if (!p.judul.toLowerCase().includes(lq) && !(p.caption ?? "").toLowerCase().includes(lq)) return false;
    }
    return true;
  }), [posts, statusFilter, platform, q]);

  const stats = useMemo(() => ({
    total:    posts.length,
    draft:    posts.filter(p => p.status === "draft").length,
    review:   posts.filter(p => p.status === "review").length,
    approved: posts.filter(p => p.status === "approved").length,
    posted:   posts.filter(p => p.status === "posted").length,
    rejected: posts.filter(p => p.status === "rejected").length,
  }), [posts]);

  /* ── calendar ── */
  const calendarDays = useMemo(() => {
    const { year, month } = calDate;
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const dim = new Date(year, month + 1, 0).getDate();
    const days: (number|null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= dim; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calDate]);

  const postsByDate = useMemo(() => {
    const map: Record<string, ContentPost[]> = {};
    posts.forEach(p => {
      if (!p.scheduled_date) return;
      const k = p.scheduled_date.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(p);
    });
    return map;
  }, [posts]);

  function calKey(day: number) {
    const { year, month } = calDate;
    return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  /* ── CRUD ── */
  function openCreate(date?: string) {
    setEditing(null);
    setForm(date ? { ...EMPTY_FORM, scheduled_date: date } : EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(p: ContentPost) {
    setEditing(p);
    setForm({ judul: p.judul, platform: p.platform, caption: p.caption ?? "", hashtags: p.hashtags ?? "", visual_url: p.visual_url ?? "", scheduled_date: p.scheduled_date ?? "", campaign_id: p.campaign_id ?? "", status: p.status });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    const payload = {
      judul: form.judul.trim(), platform: form.platform,
      caption: form.caption.trim() || null, hashtags: form.hashtags.trim() || null,
      visual_url: form.visual_url.trim() || null, scheduled_date: form.scheduled_date || null,
      campaign_id: form.campaign_id || null, status: form.status, created_by: currentUser.id,
    };
    const sel = "*, creator:profiles!content_posts_created_by_fkey(full_name,role), campaign:campaigns!content_posts_campaign_id_fkey(nama)";
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
    setDeleteId(null);
  }

  async function sendToReview(id: string) {
    await supabase.from("content_posts").update({ status: "review" }).eq("id", id);
    setPosts(p => p.map(x => x.id === id ? { ...x, status: "review" } : x));
    showToast("Dikirim ke review");
  }

  async function approvePost(id: string) {
    const now = new Date().toISOString();
    await supabase.from("content_posts").update({ status: "approved", approved_by: currentUser.id, approved_at: now, rejection_note: null }).eq("id", id);
    setPosts(p => p.map(x => x.id === id ? { ...x, status: "approved", approved_by: currentUser.id, approved_at: now } : x));
    showToast("Konten disetujui!");
  }

  async function submitReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectModal) return;
    await supabase.from("content_posts").update({ status: "rejected", rejection_note: rejectNote.trim() || null }).eq("id", rejectModal.id);
    setPosts(p => p.map(x => x.id === rejectModal.id ? { ...x, status: "rejected", rejection_note: rejectNote.trim() || null } : x));
    showToast("Konten ditolak");
    setRejectModal(null); setRejectNote("");
  }

  async function markPosted(id: string) {
    await supabase.from("content_posts").update({ status: "posted" }).eq("id", id);
    setPosts(p => p.map(x => x.id === id ? { ...x, status: "posted" } : x));
    showToast("Konten ditandai tayang!");
  }

  async function duplicatePost(post: ContentPost) {
    const sel = "*, creator:profiles!content_posts_created_by_fkey(full_name,role), campaign:campaigns!content_posts_campaign_id_fkey(nama)";
    const { data, error } = await supabase.from("content_posts").insert({
      judul: `${post.judul} (copy)`, platform: post.platform,
      caption: post.caption, hashtags: post.hashtags, visual_url: post.visual_url,
      campaign_id: post.campaign_id, status: "draft", created_by: currentUser.id,
    }).select(sel).single();
    if (!error && data) { setPosts(p => [data, ...p]); showToast("Konten diduplikat"); }
  }

  /* ── Content Card Component ── */
  function PostCard({ post }: { post: ContentPost }) {
    const sc  = STATUS_CFG[post.status];
    const plt = PLATFORM_CFG[post.platform] ?? PLATFORM_CFG.Other;
    const isOwn = post.created_by === currentUser.id;
    const canEdit = canCreate && (isOwn || ["super_admin","manager"].includes(currentUser.role));

    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
        style={{ background: "white", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        whileHover={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)", y: -1 }}>

        {/* Left accent bar by status */}
        <div style={{ height: 3, background: sc.dot }} />

        <div style={{ padding: "14px 16px" }}>
          {/* Top row: platform + status + date */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: plt.color, background: plt.bg, borderRadius: 6, padding: "2px 8px" }}>
                {post.platform}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 6, padding: "2px 8px" }}>
                {sc.label}
              </span>
              {post.status === "rejected" && post.rejection_note && (
                <span title={post.rejection_note} style={{ fontSize: 10, color: "#dc2626", cursor: "help" }}>⚠</span>
              )}
            </div>
            {post.scheduled_date && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94a3b8" }}>
                <Calendar size={10} />
                {fmtDate(post.scheduled_date)}
              </div>
            )}
          </div>

          {/* Title */}
          <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.4, marginBottom: 6 }}>{post.judul}</p>

          {/* Caption preview */}
          {post.caption && (
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {post.caption}
            </p>
          )}

          {/* Rejection note */}
          {post.status === "rejected" && post.rejection_note && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", marginBottom: 2 }}>Alasan Penolakan</p>
              <p style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.4 }}>{post.rejection_note}</p>
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags && (
            <p style={{ fontSize: 10, color: "#7c3aed", marginBottom: 8 }}>{post.hashtags}</p>
          )}

          {/* Campaign + visual link */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            {post.campaign && (
              <span style={{ fontSize: 10, color: "#0369a1", background: "#e0f2fe", borderRadius: 5, padding: "2px 7px", fontWeight: 500 }}>
                {post.campaign.nama}
              </span>
            )}
            {post.visual_url && (
              <a href={post.visual_url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 5, padding: "2px 7px", textDecoration: "none", fontWeight: 500 }}>
                <ExternalLink size={9} /> Aset Visual
              </a>
            )}
          </div>

          {/* Creator + divider */}
          {post.creator && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 8, borderTop: "1px solid #f8fafc", marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#047857)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white" }}>
                {initials(post.creator.full_name)}
              </div>
              <span style={{ fontSize: 10, color: "#64748b" }}>{post.creator.full_name}</span>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {/* Marketing: kirim ke review */}
            {canCreate && post.status === "draft" && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendToReview(post.id)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Send size={11} /> Kirim Review
              </motion.button>
            )}

            {/* Marketing: kirim ulang setelah ditolak */}
            {canCreate && post.status === "rejected" && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendToReview(post.id)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Send size={11} /> Kirim Ulang
              </motion.button>
            )}

            {/* Approver: setujui / tolak */}
            {canApprove && post.status === "review" && (
              <>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => approvePost(post.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 8px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #a7f3d0", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <Check size={11} /> Setujui
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setRejectModal({ id: post.id }); setRejectNote(""); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 8px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <X size={11} /> Tolak
                </motion.button>
              </>
            )}

            {/* Anyone with approve rights: tandai tayang */}
            {canApprove && post.status === "approved" && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => markPosted(post.id)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: "#e0f2fe", border: "1px solid #7dd3fc", color: "#0369a1", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Eye size={11} /> Tandai Tayang
              </motion.button>
            )}

            {/* Edit + duplicate + delete */}
            {canEdit && (
              <>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => openEdit(post)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  <Edit2 size={11} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => duplicatePost(post)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  <Copy size={11} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setDeleteId(post.id)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  <Trash2 size={11} />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8fafc" }}>
      <Topbar user={currentUser} title="Konten Plan" />

      <div style={{ flex: 1, padding: "24px 24px 48px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={18} color="white" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>Konten Plan</h1>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", marginLeft: 46 }}>
              Rencanakan & track semua konten media sosial · <b style={{ color: "#0f172a" }}>{posts.length}</b> konten
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {/* View switcher */}
            <div style={{ display: "flex", background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
              {([
                { v: "cards" as ViewMode,    icon: <FileImage size={14} />,   tip: "Card" },
                { v: "kanban" as ViewMode,   icon: <LayoutGrid size={14} />,  tip: "Kanban" },
                { v: "calendar" as ViewMode, icon: <Calendar size={14} />,    tip: "Kalender" },
              ]).map(({ v, icon, tip }) => (
                <motion.button key={v} whileTap={{ scale: 0.93 }} onClick={() => setView(v)} title={tip}
                  style={{ width: 32, height: 32, borderRadius: 7, border: "none", background: view === v ? "#0f172a" : "transparent", color: view === v ? "white" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                  {icon}
                </motion.button>
              ))}
            </div>
            {canCreate && (
              <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => openCreate()}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", border: "none", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", boxShadow: "0 4px 14px rgba(14,165,233,0.35)" }}>
                <Plus size={15} /> Tambah Konten
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Workflow pipeline ── */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", padding: "14px 20px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Alur Konten</p>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {WORKFLOW.map((step, i) => {
              const sc = STATUS_CFG[step.key as ContentPost["status"]];
              const count = stats[step.key as keyof typeof stats] as number;
              return (
                <div key={step.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <motion.button whileHover={{ y: -1 }} onClick={() => setStatus(statusFilter === step.key ? "all" : step.key)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${statusFilter === step.key ? sc.border : "transparent"}`, background: statusFilter === step.key ? sc.bg : "transparent", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: statusFilter === step.key ? sc.color : "#374151" }}>{step.label}</p>
                      <p style={{ fontSize: 10, color: "#94a3b8" }}>{step.hint}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 20, padding: "1px 8px", minWidth: 20, textAlign: "center" }}>{count}</span>
                  </motion.button>
                  {i < WORKFLOW.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
                      <ArrowRight size={14} color="#cbd5e1" />
                    </div>
                  )}
                </div>
              );
            })}
            {stats.rejected > 0 && (
              <div style={{ display: "flex", alignItems: "center", marginLeft: 12 }}>
                <div style={{ width: 1, height: 24, background: "#e2e8f0", margin: "0 12px" }} />
                <motion.button whileHover={{ y: -1 }} onClick={() => setStatus(statusFilter === "rejected" ? "all" : "rejected")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${statusFilter === "rejected" ? "#fecaca" : "transparent"}`, background: statusFilter === "rejected" ? "#fef2f2" : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: statusFilter === "rejected" ? "#dc2626" : "#374151" }}>Ditolak</p>
                    <p style={{ fontSize: 10, color: "#94a3b8" }}>Perlu revisi</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, padding: "1px 8px" }}>{stats.rejected}</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* ── Filters bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul atau caption..."
              style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", background: "white", outline: "none", boxSizing: "border-box" }} />
          </div>
          <select value={platform} onChange={e => setPlatform(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", background: "white", outline: "none", cursor: "pointer" }}>
            <option value="all">Semua Platform</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(statusFilter !== "all" || platform !== "all" || q) && (
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => { setStatus("all"); setPlatform("all"); setQ(""); }}
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
              Reset filter
            </motion.button>
          )}
          <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>
            {filtered.length} konten
          </span>
        </div>

        {/* ════════════════ CARDS VIEW ════════════════ */}
        {view === "cards" && (
          <div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0" }}>
                <FileImage size={40} style={{ color: "#e2e8f0", margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 4 }}>
                  {q ? `Tidak ada konten untuk "${q}"` : "Belum ada konten"}
                </p>
                {canCreate && !q && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => openCreate()}
                    style={{ marginTop: 16, padding: "10px 22px", borderRadius: 12, background: "#0f172a", color: "white", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                    + Tambah Pertama
                  </motion.button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {filtered.map(post => <PostCard key={post.id} post={post} />)}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ KANBAN VIEW ════════════════ */}
        {view === "kanban" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
            {(["draft","review","approved","rejected","posted"] as ContentPost["status"][]).map(status => {
              const sc    = STATUS_CFG[status];
              const cards = filtered.filter(p => p.status === status);
              return (
                <div key={status}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{sc.label}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: "1px 8px" }}>{cards.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {cards.map(post => {
                        const plt = PLATFORM_CFG[post.platform] ?? PLATFORM_CFG.Other;
                        return (
                          <motion.div key={post.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            style={{ background: "white", borderRadius: 12, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                            whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)", y: -1 }}>
                            <div style={{ height: 2.5, background: sc.dot }} />
                            <div style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: plt.color, background: plt.bg, borderRadius: 5, padding: "1px 6px" }}>{post.platform}</span>
                                {post.scheduled_date && (
                                  <span style={{ fontSize: 9, color: "#94a3b8" }}>{fmtDate(post.scheduled_date)}</span>
                                )}
                              </div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", lineHeight: 1.35, marginBottom: 4 }}>{post.judul}</p>
                              {post.caption && <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, marginBottom: 6 }}>{post.caption}</p>}
                              {post.rejection_note && <p style={{ fontSize: 9, color: "#dc2626", fontWeight: 600, marginBottom: 6 }}>↩ {post.rejection_note}</p>}
                              {post.creator && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 6, borderTop: "1px solid #f8fafc", marginBottom: 6 }}>
                                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "white" }}>{initials(post.creator.full_name)}</div>
                                  <span style={{ fontSize: 9, color: "#94a3b8" }}>{post.creator.full_name}</span>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {canCreate && post.status === "draft" && (
                                  <button onClick={() => sendToReview(post.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 7px", borderRadius: 6, background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                    <Send size={9} /> Review
                                  </button>
                                )}
                                {canCreate && post.status === "rejected" && (
                                  <button onClick={() => sendToReview(post.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 7px", borderRadius: 6, background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                    <Send size={9} /> Ulang
                                  </button>
                                )}
                                {canApprove && post.status === "review" && (
                                  <>
                                    <button onClick={() => approvePost(post.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 7px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #a7f3d0", color: "#059669", fontSize: 9, fontWeight: 700, cursor: "pointer" }}><Check size={9} /> OK</button>
                                    <button onClick={() => { setRejectModal({ id: post.id }); setRejectNote(""); }} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 7px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 9, fontWeight: 700, cursor: "pointer" }}><X size={9} /> Tolak</button>
                                  </>
                                )}
                                {canApprove && post.status === "approved" && (
                                  <button onClick={() => markPosted(post.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 7px", borderRadius: 6, background: "#e0f2fe", border: "1px solid #7dd3fc", color: "#0369a1", fontSize: 9, fontWeight: 700, cursor: "pointer" }}><Eye size={9} /> Tayang</button>
                                )}
                                {canCreate && (
                                  <button onClick={() => openEdit(post)} style={{ padding: "4px 6px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 9, cursor: "pointer" }}><Edit2 size={9} /></button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {cards.length === 0 && (
                      <div style={{ border: "2px dashed #e2e8f0", borderRadius: 10, padding: "20px 12px", textAlign: "center" }}>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>Tidak ada konten</p>
                      </div>
                    )}
                    {status === "draft" && canCreate && (
                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => openCreate()}
                        style={{ width: "100%", padding: "9px", borderRadius: 9, border: "2px dashed #bfdbfe", background: "transparent", color: "#3b82f6", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Plus size={12} /> Tambah
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════════════════ CALENDAR VIEW ════════════════ */}
        {view === "calendar" && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", gap: 12 }}>
              <motion.button whileHover={{ background: "#f8fafc" }} whileTap={{ scale: 0.9 }} onClick={() => { setCalDate(d => d.month === 0 ? { year: d.year-1, month: 11 } : { ...d, month: d.month-1 }); setCalPopup(null); }}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ChevronLeft size={16} color="#64748b" />
              </motion.button>
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{MONTH_NAMES[calDate.month]} {calDate.year}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {posts.filter(p => p.scheduled_date?.startsWith(`${calDate.year}-${String(calDate.month+1).padStart(2,"0")}`)).length} konten dijadwalkan
                </p>
              </div>
              <motion.button whileHover={{ background: "#f8fafc" }} whileTap={{ scale: 0.9 }} onClick={() => { setCalDate(d => d.month === 11 ? { year: d.year+1, month: 0 } : { ...d, month: d.month+1 }); setCalPopup(null); }}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ChevronRight size={16} color="#64748b" />
              </motion.button>

              {/* Subscribe button */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowSubscribe(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #e2e8f0", background: showSubscribe ? "#f0fdf4" : "white", fontSize: 12, fontWeight: 600, color: showSubscribe ? "#059669" : "#374151", cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    <path d="M12 16l-2-2 2-2 2 2-2 2z" fill="currentColor" stroke="none"/>
                  </svg>
                  Subscribe
                </motion.button>

                <AnimatePresence>
                  {showSubscribe && (
                    <motion.div initial={{ opacity: 0, scale: 0.93, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -6 }}
                      style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 90, background: "white", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.14)", width: 360, padding: 20 }}
                      onClick={e => e.stopPropagation()}>

                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Hubungkan ke Google Calendar</p>
                          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Sync otomatis setiap ~24 jam</p>
                        </div>
                      </div>

                      {/* Steps */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                        {[
                          { n: "1", text: 'Salin URL di bawah ini' },
                          { n: "2", text: 'Buka Google Calendar → klik "+" di Other calendars → pilih "From URL"' },
                          { n: "3", text: 'Tempel URL dan klik "Add calendar"' },
                          { n: "4", text: 'Semua konten berjadwal otomatis muncul di Google Calendar kamu!' },
                        ].map(s => (
                          <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0fdf4", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#059669", flexShrink: 0, marginTop: 1 }}>{s.n}</span>
                            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{s.text}</p>
                          </div>
                        ))}
                      </div>

                      {/* URL box */}
                      <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 10, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                          {calendarUrl}
                        </p>
                        <motion.button whileTap={{ scale: 0.93 }}
                          onClick={() => { navigator.clipboard.writeText(calendarUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: copied ? "#f0fdf4" : "white", fontSize: 11, fontWeight: 700, color: copied ? "#059669" : "#374151", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {copied ? <><CheckCircle size={11} /> Tersalin!</> : <><Copy size={11} /> Salin URL</>}
                        </motion.button>
                      </div>

                      {/* Open Google Calendar shortcut */}
                      <a href={googleCalendarSubscribeUrl(calendarUrl)} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#4285f4,#1a73e8)", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Buka Google Calendar
                      </a>

                      <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
                        URL ini bersifat private. Jangan bagikan ke orang luar organisasi.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f1f5f9" }}>
              {DAY_NAMES.map(d => <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} style={{ minHeight: 100, borderRight: "1px solid #f8fafc", borderBottom: "1px solid #f8fafc", background: "#fafafa" }} />;
                const key = calKey(day); const dayPosts = postsByDate[key] ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={key} style={{ minHeight: 100, borderRight: "1px solid #f8fafc", borderBottom: "1px solid #f8fafc", padding: 6, position: "relative", background: isToday ? "#f0f9ff" : "white", cursor: dayPosts.length > 0 || canCreate ? "pointer" : "default" }}
                    onClick={() => dayPosts.length > 0 ? setCalPopup(calPopup?.day === day ? null : { day, posts: dayPosts }) : canCreate && openCreate(key)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? "#0369a1" : "transparent", color: isToday ? "white" : "#374151", fontSize: 12, fontWeight: isToday ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center" }}>{day}</span>
                      {canCreate && dayPosts.length === 0 && <span style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1 }}>+</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {dayPosts.slice(0, 3).map(p => {
                        const sc = STATUS_CFG[p.status]; const plt = PLATFORM_CFG[p.platform] ?? PLATFORM_CFG.Other;
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 5px", borderRadius: 4, background: plt.bg, overflow: "hidden" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.judul}</span>
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && <span style={{ fontSize: 9, color: "#94a3b8", padding: "0 5px" }}>+{dayPosts.length-3} lagi</span>}
                    </div>
                    <AnimatePresence>
                      {calPopup?.day === day && (
                        <motion.div initial={{ opacity: 0, scale: 0.93, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93 }}
                          onClick={e => e.stopPropagation()}
                          style={{ position: "absolute", top: "100%", left: 0, zIndex: 80, background: "white", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.14)", width: 280, padding: 12 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                            {day} {MONTH_NAMES[calDate.month]} · {dayPosts.length} konten
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                            {dayPosts.map(p => {
                              const sc = STATUS_CFG[p.status]; const plt = PLATFORM_CFG[p.platform] ?? PLATFORM_CFG.Other;
                              return (
                                <div key={p.id} style={{ padding: "8px 10px", borderRadius: 9, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: plt.color }}>{p.platform}</span>
                                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                                  </div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 5 }}>{p.judul}</p>
                                  <div style={{ display: "flex", gap: 5 }}>
                                    {p.visual_url && <a href={p.visual_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#7c3aed", display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}><ExternalLink size={8} /> Aset</a>}
                                    {canCreate && <button onClick={() => { openEdit(p); setCalPopup(null); }} style={{ fontSize: 9, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 2 }}><Edit2 size={8} /> Edit</button>}
                                    {canApprove && p.status === "review" && (
                                      <>
                                        <button onClick={() => { approvePost(p.id); setCalPopup(null); }} style={{ fontSize: 9, color: "#059669", background: "none", border: "none", cursor: "pointer", padding: 0 }}><ThumbsUp size={8} /> Setujui</button>
                                        <button onClick={() => { setRejectModal({ id: p.id }); setRejectNote(""); setCalPopup(null); }} style={{ fontSize: 9, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}><ThumbsDown size={8} /> Tolak</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {canCreate && (
                            <button onClick={() => { openCreate(key); setCalPopup(null); }}
                              style={{ width: "100%", marginTop: 8, padding: "7px", borderRadius: 8, border: "1px dashed #e2e8f0", background: "transparent", fontSize: 11, fontWeight: 600, color: "#94a3b8", cursor: "pointer" }}>
                              + Tambah konten tanggal ini
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Status:</span>
              {Object.entries(STATUS_CFG).map(([k, sc]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                  <span style={{ fontSize: 11, color: "#64748b" }}>{sc.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={18} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{editing ? "Edit Konten" : "Tambah Konten"}</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Isi detail rencana konten</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowModal(false)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#64748b" />
                </motion.button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: "22px 26px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Judul Konten <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="cth: Tips GRC #1 — Pentingnya Tata Kelola" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Platform <span style={{ color: "#ef4444" }}>*</span></label>
                    <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContentPost["status"] }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="draft">Draft</option>
                      <option value="review">Kirim Review</option>
                      {canApprove && <option value="approved">Langsung Setujui</option>}
                      {canApprove && <option value="posted">Langsung Tayang</option>}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Caption</label>
                  <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Caption lengkap untuk postingan ini..." rows={4} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Hashtag</label>
                  <input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#grcc #unair #governancerisk" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Link Aset Visual</label>
                  <input type="url" value={form.visual_url} onChange={e => setForm(f => ({ ...f, visual_url: e.target.value }))} placeholder="https://canva.com/... atau Google Drive" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Jadwal Posting</label>
                    <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Kampanye</label>
                    <select value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="">— Tidak ada —</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <motion.button type="submit" disabled={submitting} whileTap={{ scale: 0.97 }}
                    style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: submitting ? "#a5b4fc" : "linear-gradient(135deg,#0ea5e9,#0369a1)", fontSize: 13, fontWeight: 700, color: "white", cursor: submitting ? "not-allowed" : "pointer", boxShadow: submitting ? "none" : "0 4px 14px rgba(14,165,233,0.3)" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui Konten" : "Tambah Konten"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reject Modal ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setRejectModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 22, width: "100%", maxWidth: 440, boxShadow: "0 32px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ThumbsDown size={18} color="#dc2626" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Tolak Konten</h3>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Beri catatan untuk tim marketing</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRejectModal(null)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={15} color="#64748b" />
                </motion.button>
              </div>
              <form onSubmit={submitReject} style={{ padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 7 }}>Alasan Penolakan</label>
                  <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Jelaskan apa yang perlu diperbaiki..." rows={4} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setRejectModal(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</button>
                  <motion.button type="submit" whileTap={{ scale: 0.97 }} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#dc2626,#b91c1c)", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>Tolak Konten</motion.button>
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
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Hapus Konten?</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>Konten ini akan dihapus permanen.</p>
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
