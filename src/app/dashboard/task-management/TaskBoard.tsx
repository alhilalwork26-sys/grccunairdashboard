"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Edit2, Trash2, Calendar, ChevronDown,
  CheckCircle, Clock, Circle, AlertCircle, ListTodo,
  Flag, UserCircle, MoreHorizontal, Check, AlertTriangle,
  Link2, ThumbsUp, ThumbsDown, History, ExternalLink, FileCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createTaskAction, updateTaskAction, quickStatusAction,
  submitForReviewAction, deleteTaskAction,
  approveTaskAction, rejectTaskAction,
} from "./actions";
import Topbar from "@/components/layout/Topbar";
import Avatar from "@/components/ui/Avatar";
import type { Task, TaskLog, UserProfile } from "@/types";

function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { const p = new URL(url); return p.protocol === "http:" || p.protocol === "https:" ? url : undefined; }
  catch { return undefined; }
}

const STATUS_CFG = {
  pending:     { label: "Pending",    color: "#f59e0b", bg: "#fffbeb", Icon: Circle },
  in_progress: { label: "Dikerjakan", color: "#3b82f6", bg: "#eff6ff", Icon: Clock },
  review:      { label: "Review",     color: "#8b5cf6", bg: "#f5f3ff", Icon: AlertCircle },
  done:        { label: "Selesai",    color: "#10b981", bg: "#f0fdf4", Icon: CheckCircle },
};

const PRIORITY_CFG = {
  low:    { label: "Rendah", color: "#6b7280", bg: "#f9fafb", dot: "#9ca3af" },
  medium: { label: "Sedang", color: "#3b82f6", bg: "#eff6ff", dot: "#3b82f6" },
  high:   { label: "Tinggi", color: "#f59e0b", bg: "#fffbeb", dot: "#f59e0b" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#fef2f2", dot: "#ef4444" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", in_progress: "Dikerjakan", review: "Review", done: "Selesai",
};

const ACTION_CFG: Record<string, { label: string; dotColor: string; textColor: string }> = {
  created:          { label: "Task dibuat",                dotColor: "#9ca3af", textColor: "#6b7280" },
  edited:           { label: "Task diedit",                dotColor: "#93c5fd", textColor: "#3b82f6" },
  status_changed:   { label: "Status diubah",              dotColor: "#93c5fd", textColor: "#3b82f6" },
  submitted_review: { label: "Dikirim untuk review",       dotColor: "#c4b5fd", textColor: "#7c3aed" },
  approved:         { label: "Task disetujui",             dotColor: "#6ee7b7", textColor: "#059669" },
  rejected:         { label: "Dikembalikan ke pengerjaan", dotColor: "#fca5a5", textColor: "#dc2626" },
};

const TABS = [
  { key: "all",         label: "Semua" },
  { key: "pending",     label: "Pending" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "review",      label: "Review" },
  { key: "done",        label: "Selesai" },
];

const EMPTY_FORM = {
  title: "", description: "",
  status: "pending" as Task["status"],
  priority: "medium" as Task["priority"],
  assigned_to: "", due_date: "",
  requires_proof: false,
};

const APPROVE_ROLES = ["super_admin", "manager", "kep_trainer"];

interface Props {
  initialTasks: Task[];
  profiles: Pick<UserProfile, "id" | "full_name" | "role" | "avatar_url">[];
  currentUser: UserProfile;
  canSeeAll?: boolean;
}

export default function TaskBoard({ initialTasks, profiles, currentUser, canSeeAll = false }: Props) {
  const [tasks, setTasks]           = useState<Task[]>(initialTasks);
  const [tab, setTab]               = useState("all");
  const [search, setSearch]         = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Task | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [popup, setPopup] = useState<{ type: "status" | "menu"; taskId: string; top: number; left: number } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Review flow
  const [reviewModal, setReviewModal]       = useState<{ task: Task } | null>(null);
  const [reviewForm, setReviewForm]         = useState({ note: "", proof_url: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofFileName, setProofFileName]   = useState<string | null>(null);
  const proofFileRef = useRef<HTMLInputElement>(null);

  // Reject flow
  const [rejectModal, setRejectModal]       = useState<{ taskId: string } | null>(null);
  const [rejectNote, setRejectNote]         = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Activity log
  const [logsModal, setLogsModal]     = useState<{ task: Task } | null>(null);
  const [taskLogs, setTaskLogs]       = useState<TaskLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const supabase = createClient();

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "err" ? 5000 : 2800);
  }

  const filtered = useMemo(() => tasks.filter(t => {
    if (tab !== "all" && t.status !== tab) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, tab, priorityFilter, assigneeFilter, search]);

  const stats = useMemo(() => ({
    total:       tasks.length,
    pending:     tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done:        tasks.filter(t => t.status === "done").length,
  }), [tasks]);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title:          task.title,
      description:    task.description ?? "",
      status:         task.status,
      priority:       task.priority,
      assigned_to:    task.assigned_to ?? "",
      due_date:       task.due_date ?? "",
      requires_proof: task.requires_proof ?? false,
    });
    setShowModal(true);
    setPopup(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const payload = {
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      status:         form.status,
      priority:       form.priority,
      assigned_to:    form.assigned_to || null,
      due_date:       form.due_date || null,
      requires_proof: form.requires_proof,
    };
    try {
      if (editing) {
        const { data, error } = await updateTaskAction(editing.id, payload);
        if (!error && data) {
          setTasks(prev => prev.map(t => t.id === editing.id ? data : t));
          showToast("Task berhasil diperbarui");
        } else showToast(error ?? "Gagal memperbarui task", "err");
      } else {
        const { data, error } = await createTaskAction(payload);
        if (!error && data) {
          setTasks(prev => [data, ...prev]);
          showToast("Task berhasil dibuat");
        } else showToast(error ?? "Gagal membuat task", "err");
      }
    } catch {
      showToast("Gagal menyimpan task", "err");
    }
    setSubmitting(false);
    setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await deleteTaskAction(deleteId);
      if (!error) { setTasks(prev => prev.filter(t => t.id !== deleteId)); showToast("Task dihapus"); }
      else showToast(error, "err");
    } catch { showToast("Gagal menghapus task", "err"); }
    setDeleteId(null);
  }

  async function quickStatus(id: string, status: Task["status"]) {
    if (status === "review") {
      const task = tasks.find(t => t.id === id);
      if (task) { setReviewModal({ task }); setReviewForm({ note: "", proof_url: "" }); setProofFileName(null); setPopup(null); }
      return;
    }
    const prev = tasks.find(t => t.id === id);
    setStatusLoading(id);
    try {
      const { error } = await quickStatusAction(id, status, prev?.status ?? "pending");
      if (error) {
        if (error === "Sesi habis, silakan login ulang.") {
          showToast("Sesi habis — mengalihkan ke login...", "err");
          setTimeout(() => { window.location.href = "/login"; }, 1500);
        } else {
          showToast(error, "err");
        }
      } else {
        setTasks(p => p.map(t => t.id === id ? { ...t, status } : t));
      }
    } catch { showToast("Gagal mengubah status. Coba refresh halaman.", "err"); }
    finally { setStatusLoading(null); }
  }

  async function handleProofFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !reviewModal) return;
    setUploadingProof(true);
    const ext  = file.name.split(".").pop();
    const path = `${currentUser.id}/task-proof/${reviewModal.task.id}/${new Date().getTime()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { showToast("Gagal upload: " + upErr.message, "err"); setUploadingProof(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(path);
    setReviewForm(f => ({ ...f, proof_url: publicUrl }));
    setProofFileName(file.name);
    setUploadingProof(false);
  }

  async function submitForReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewModal) return;
    const { task } = reviewModal;
    setSubmittingReview(true);
    try {
      const { error } = await submitForReviewAction(
        task.id,
        task.status,
        reviewForm.note.trim() || null,
        reviewForm.proof_url.trim() || null,
      );
      if (!error) {
        const updates = { status: "review" as Task["status"], completion_note: reviewForm.note.trim() || null, proof_url: reviewForm.proof_url.trim() || null };
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
        showToast("Berhasil dikirim untuk review");
        setReviewModal(null);
        setProofFileName(null);
      } else showToast(error, "err");
    } catch { showToast("Gagal mengirim review", "err"); }
    setSubmittingReview(false);
  }

  async function approveTask(taskId: string) {
    const now = new Date().toISOString();
    const result = await approveTaskAction(taskId);
    if (result.error) { showToast(result.error, "err"); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "done", approved_by: currentUser.id, approved_at: now } : t));
    showToast("Task disetujui");
    setPopup(null);
  }

  async function rejectTask(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectModal) return;
    setSubmittingReject(true);
    const result = await rejectTaskAction(rejectModal.taskId, rejectNote.trim() || null);
    if (result.error) { showToast(result.error, "err"); setSubmittingReject(false); return; }
    setTasks(prev => prev.map(t => t.id === rejectModal.taskId ? { ...t, status: "in_progress", rejected_note: rejectNote.trim() || null } : t));
    showToast("Task dikembalikan ke pengerjaan");
    setRejectModal(null);
    setRejectNote("");
    setSubmittingReject(false);
    setPopup(null);
  }

  async function fetchAndShowLogs(task: Task) {
    setLogsModal({ task });
    setTaskLogs([]);
    setLoadingLogs(true);
    const { data } = await supabase
      .from("task_logs")
      .select("*, actor:profiles!task_logs_actor_id_fkey(full_name, role)")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setTaskLogs(data ?? []);
    setLoadingLogs(false);
  }

  function getName(id?: string | null) { return profiles.find(p => p.id === id)?.full_name ?? "-"; }

  function getDeadlineStatus(dueDate?: string | null) {
    if (!dueDate) return null;
    const [y, m, d] = dueDate.split("-").map(Number);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(y, m - 1, d);
    const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
    const dateLabel = due.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    if (daysLeft < 0)  return { level: "overdue" as const, daysLeft, dateLabel, urgencyLabel: `Terlambat ${Math.abs(daysLeft)} hari`, color: "#ef4444" };
    if (daysLeft === 0) return { level: "today"  as const, daysLeft, dateLabel, urgencyLabel: "Hari ini!",              color: "#f97316" };
    if (daysLeft === 1) return { level: "soon"   as const, daysLeft, dateLabel, urgencyLabel: "Besok",                  color: "#f59e0b" };
    if (daysLeft <= 3) return { level: "soon"   as const, daysLeft, dateLabel, urgencyLabel: `${daysLeft} hari lagi`,  color: "#f59e0b" };
    return { level: "normal" as const, daysLeft, dateLabel, urgencyLabel: dateLabel, color: "#9ca3af" };
  }

  const canManage  = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"].includes(currentUser.role);
  const canApprove = APPROVE_ROLES.includes(currentUser.role);

  const assignableProfiles = currentUser.role === "kep_finance"
    ? profiles.filter(p => ["staff_finance", "staff_dokumen"].includes(p.role ?? ""))
    : profiles;

  useEffect(() => {
    function handler() { setPopup(null); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Task Management" />

      <div className="board-main">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Task Management</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Kelola dan pantau progres tugas tim.</p>
          </div>
          {canManage && (
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "#111827", border: "none", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.14)" }}>
              <Plus size={15} /> Tambah Task
            </motion.button>
          )}
        </motion.div>

        {/* Deadline banner */}
        {(() => {
          const active = tasks.filter(t => t.status !== "done");
          const nOver  = active.filter(t => getDeadlineStatus(t.due_date)?.level === "overdue").length;
          const nToday = active.filter(t => getDeadlineStatus(t.due_date)?.level === "today").length;
          const nSoon  = active.filter(t => getDeadlineStatus(t.due_date)?.level === "soon").length;
          if (!nOver && !nToday && !nSoon) return null;
          const urgent = nOver > 0 || nToday > 0;
          const parts = [nOver && `${nOver} terlambat`, nToday && `${nToday} deadline hari ini`, nSoon && `${nSoon} segera`].filter(Boolean).join("  ·  ");
          return (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 8, background: urgent ? "#fef2f2" : "#fffbeb", border: `1px solid ${urgent ? "#fecaca" : "#fde68a"}`, borderRadius: 10, padding: "9px 14px", marginBottom: 14 }}>
              <AlertTriangle size={13} color={urgent ? "#ef4444" : "#f59e0b"} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: urgent ? "#dc2626" : "#92400e" }}>{parts}</span>
            </motion.div>
          );
        })()}

        {/* Stats */}
        <div className="stats-grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: "Total Task",   value: stats.total,       color: "#111827", border: "#e5e7eb" },
            { label: "Pending",      value: stats.pending,     color: "#f59e0b", border: "#fde68a" },
            { label: "Dikerjakan",   value: stats.in_progress, color: "#3b82f6", border: "#bfdbfe" },
            { label: "Selesai",      value: stats.done,        color: "#10b981", border: "#a7f3d0" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.07)" }}
              style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 18px", transition: "box-shadow 0.2s" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
              <div style={{ height: 3, borderRadius: 4, background: s.border, marginTop: 10 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: stats.total ? `${(s.value / stats.total) * 100}%` : "0%" }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 4, background: s.color }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters + table */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "0 16px" }}>
            {TABS.map(t => {
              const count  = t.key === "all" ? tasks.length : tasks.filter(x => x.status === t.key).length;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ position: "relative", padding: "13px 14px 12px", fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "#111827" : "#6b7280", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {t.label}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: active ? "#111827" : "#f3f4f6", color: active ? "white" : "#6b7280", transition: "all 0.2s" }}>{count}</span>
                  {active && <motion.div layoutId="task-tab-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#111827", borderRadius: 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, paddingTop: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari task..."
                  style={{ padding: "7px 12px 7px 30px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#111827", background: "#f9fafb", outline: "none", width: 180 }} />
              </div>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", cursor: "pointer" }}>
                <option value="all">Semua Prioritas</option>
                <option value="urgent">Urgent</option>
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
              {canSeeAll && (
                <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", cursor: "pointer" }}>
                  <option value="all">Semua Anggota</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Table — scrollable on mobile */}
          <div className="board-table-wrap">
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 100px 110px 130px 48px", padding: "9px 18px", borderBottom: "1px solid #f9fafb", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 640 }}>
            <span>Task</span><span>Assign ke</span><span>Prioritas</span><span>Deadline</span><span>Status</span><span></span>
          </div>

          {/* Task rows */}
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ padding: "52px 0", textAlign: "center" }}>
                <ListTodo size={36} style={{ color: "#e5e7eb", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500 }}>{search ? "Tidak ada task yang cocok" : "Belum ada task"}</p>
                {canManage && !search && (
                  <button onClick={openCreate} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 10, background: "#111827", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>+ Buat Task Pertama</button>
                )}
              </motion.div>
            ) : filtered.map((task, i) => {
              const sc = STATUS_CFG[task.status];
              const pc = PRIORITY_CFG[task.priority];
              const StatusIcon = sc.Icon;
              const dl = getDeadlineStatus(task.due_date);
              const isUrgent = dl && task.status !== "done" && (dl.level === "overdue" || dl.level === "today");
              const isSoon   = dl && task.status !== "done" && dl.level === "soon";
              const accentColor = isUrgent ? (dl!.level === "overdue" ? "#ef4444" : "#f97316") : isSoon ? "#f59e0b" : "transparent";
              const assigneeProfile = profiles.find(p => p.id === task.assigned_to);
              const needsProof = task.requires_proof && !task.proof_url && task.status !== "done";

              return (
                <motion.div key={task.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }} transition={{ delay: i * 0.04, duration: 0.3 }}
                  whileHover={{ background: isUrgent ? "#fef9f9" : "#fafafa" }}
                  style={{ display: "grid", gridTemplateColumns: "1fr 160px 100px 110px 130px 48px", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f9fafb", borderLeft: `3px solid ${accentColor}`, background: isUrgent ? "#fffafa" : "transparent", transition: "background 0.15s", cursor: "default", minWidth: 640 }}>

                  {/* Title + meta indicators */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</p>
                      {task.requires_proof && (
                        <span title={needsProof ? "Menunggu bukti" : "Bukti sudah dikirim"} style={{ display: "flex", alignItems: "center" }}>
                          <FileCheck size={11} style={{ color: needsProof ? "#f59e0b" : "#10b981", flexShrink: 0 }} />
                        </span>
                      )}
                      {task.proof_url && task.status !== "pending" && (
                        <a href={sanitizeUrl(task.proof_url)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          title="Lihat bukti pengerjaan" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                          <ExternalLink size={11} style={{ color: "#3b82f6" }} />
                        </a>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</p>
                    )}
                    {/* Rejected note */}
                    {task.rejected_note && task.status === "in_progress" && (
                      <p style={{ fontSize: 10, color: "#ef4444", marginTop: 3, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        ↩ Dikembalikan: {task.rejected_note}
                      </p>
                    )}
                    {/* Proof needed indicator */}
                    {needsProof && (
                      <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 3, fontWeight: 500 }}>Bukti pengerjaan diperlukan</p>
                    )}
                  </div>

                  {/* Assignee */}
                  <div>
                    {task.assigned_to ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {assigneeProfile && <Avatar id={assigneeProfile.id} name={assigneeProfile.full_name} avatarUrl={assigneeProfile.avatar_url} size={28} ringColor="#f3f4f6" />}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getName(task.assigned_to)}</p>
                          {task.created_by && task.created_by !== task.assigned_to && (
                            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Dari: {getName(task.created_by)}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                        {task.created_by && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Dari: {getName(task.created_by)}</p>}
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: pc.bg, fontSize: 11, fontWeight: 600, color: pc.color }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc.dot, flexShrink: 0 }} />
                      {pc.label}
                    </span>
                  </div>

                  {/* Deadline */}
                  <div>
                    {!dl ? <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span> : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {dl.level === "overdue" && task.status !== "done"
                            ? <AlertTriangle size={11} style={{ color: dl.color, flexShrink: 0 }} />
                            : <Calendar size={11} style={{ color: task.status === "done" ? "#d1d5db" : dl.color, flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, fontWeight: task.status !== "done" && dl.level !== "normal" ? 600 : 400, color: task.status === "done" ? "#9ca3af" : dl.level === "normal" ? "#6b7280" : dl.color }}>{dl.dateLabel}</span>
                        </div>
                        {task.status !== "done" && dl.level !== "normal" && (
                          <p style={{ fontSize: 10, fontWeight: 500, color: dl.color, marginTop: 2, opacity: 0.85 }}>{dl.urgencyLabel}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status badge */}
                  <div onMouseDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <motion.button whileHover={{ opacity: statusLoading === task.id ? 1 : 0.85 }} whileTap={{ scale: statusLoading === task.id ? 1 : 0.97 }}
                      disabled={statusLoading === task.id}
                      onClick={e => {
                        if (statusLoading === task.id) return;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setPopup(popup?.taskId === task.id && popup.type === "status" ? null : { type: "status", taskId: task.id, top: rect.bottom + 6, left: rect.left });
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: sc.bg, fontSize: 11, fontWeight: 600, color: sc.color, border: `1px solid ${sc.color}30`, cursor: statusLoading === task.id ? "default" : "pointer", opacity: statusLoading === task.id ? 0.7 : 1 }}>
                      {statusLoading === task.id
                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        : <StatusIcon size={10} strokeWidth={2.2} />}
                      {sc.label}
                      {statusLoading !== task.id && <ChevronDown size={9} style={{ opacity: 0.6 }} />}
                    </motion.button>
                    {/* Approve/Reject quick buttons for review tasks */}
                    {task.status === "review" && canApprove && (
                      <>
                        <motion.button whileHover={{ background: "#f0fdf4" }} whileTap={{ scale: 0.9 }}
                          onClick={() => approveTask(task.id)}
                          title="Setujui task"
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #a7f3d0", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <ThumbsUp size={12} color="#10b981" />
                        </motion.button>
                        <motion.button whileHover={{ background: "#fef2f2" }} whileTap={{ scale: 0.9 }}
                          onClick={() => { setRejectModal({ taskId: task.id }); setRejectNote(""); }}
                          title="Tolak & kembalikan"
                          style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <ThumbsDown size={12} color="#ef4444" />
                        </motion.button>
                      </>
                    )}
                  </div>

                  {/* Three-dot menu */}
                  <div onMouseDown={e => e.stopPropagation()}>
                    <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }}
                      onClick={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setPopup(popup?.taskId === task.id && popup.type === "menu" ? null : { type: "menu", taskId: task.id, top: rect.bottom + 6, left: rect.right - 180 });
                      }}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <MoreHorizontal size={14} color="#6b7280" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          </div>{/* end board-table-wrap */}
        </motion.div>
      </div>

      {/* ── FIXED POPUPS ── */}
      <AnimatePresence>
        {popup && (() => {
          const popupTask = tasks.find(t => t.id === popup.taskId);
          if (!popupTask) return null;
          return (
            <motion.div key={popup.type + popup.taskId}
              initial={{ opacity: 0, scale: 0.93, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -4 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }} onMouseDown={e => e.stopPropagation()}
              style={{ position: "fixed", top: popup.top, left: popup.left, zIndex: 200, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 32px rgba(0,0,0,0.14)", minWidth: popup.type === "status" ? 172 : 180, padding: 4 }}>

              {popup.type === "status" ? (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", padding: "5px 8px 4px", letterSpacing: "0.07em", textTransform: "uppercase" }}>Ubah Status</p>
                  {(Object.entries(STATUS_CFG) as [Task["status"], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([key, cfg]) => {
                    const Icon = cfg.Icon;
                    const isCurrent = popupTask.status === key;
                    return (
                      <motion.button key={key} whileHover={{ background: isCurrent ? cfg.bg : "#f9fafb" }}
                        onClick={() => { quickStatus(popup.taskId, key); if (key !== "review") setPopup(null); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, border: "none", background: isCurrent ? cfg.bg : "transparent", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", border: isCurrent ? `1.5px solid ${cfg.color}50` : `1.5px solid ${cfg.color}20` }}>
                          <Icon size={12} style={{ color: cfg.color }} strokeWidth={2.2} />
                        </span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? cfg.color : "#374151" }}>{cfg.label}</span>
                        {isCurrent && <Check size={12} style={{ color: cfg.color, flexShrink: 0 }} />}
                      </motion.button>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Activity log */}
                  <motion.button whileHover={{ background: "#f9fafb" }} onClick={() => { fetchAndShowLogs(popupTask); setPopup(null); }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontWeight: 500, color: "#374151", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><History size={11} color="#6b7280" /></span>
                    Lihat Aktivitas
                  </motion.button>
                  <div style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }} />
                  <motion.button whileHover={{ background: "#f9fafb" }} onClick={() => { openEdit(popupTask); setPopup(null); }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontWeight: 500, color: "#374151", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Edit2 size={11} color="#6b7280" /></span>
                    Edit Task
                  </motion.button>
                  <div style={{ height: 1, background: "#f3f4f6", margin: "3px 0" }} />
                  <motion.button whileHover={{ background: "#fef2f2" }} onClick={() => { setDeleteId(popup.taskId); setPopup(null); }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontWeight: 500, color: "#ef4444", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, borderRadius: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={11} color="#ef4444" /></span>
                    Hapus Task
                  </motion.button>
                </>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── CREATE / EDIT MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div key="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setShowModal(false)}>
            <motion.div key="modal-panel" initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}><ListTodo size={16} color="#10b981" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Task" : "Buat Task Baru"}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{editing ? "Perbarui detail task" : "Isi detail task yang akan dibuat"}</p>
                  </div>
                </div>
                <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setShowModal(false)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Judul Task *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nama task..." className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detail task (opsional)..." rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}><Flag size={11} style={{ display: "inline", marginRight: 4 }} />Prioritas</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task["priority"] }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="low">Rendah</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}><CheckCircle size={11} style={{ display: "inline", marginRight: 4 }} />Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Task["status"] }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">Dikerjakan</option>
                      <option value="review">Review</option>
                      <option value="done">Selesai</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}><UserCircle size={11} style={{ display: "inline", marginRight: 4 }} />Assign ke</label>
                    <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                      <option value="">-- Belum diassign --</option>
                      {assignableProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}><Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Deadline</label>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>

                {/* Requires proof toggle */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, background: form.requires_proof ? "#fffbeb" : "#f9fafb", border: `1px solid ${form.requires_proof ? "#fde68a" : "#e5e7eb"}`, cursor: "pointer", transition: "all 0.15s" }}>
                  <input type="checkbox" checked={form.requires_proof} onChange={e => setForm(f => ({ ...f, requires_proof: e.target.checked }))}
                    style={{ width: 15, height: 15, marginTop: 1, accentColor: "#f59e0b", cursor: "pointer", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: form.requires_proof ? "#92400e" : "#374151" }}>Minta bukti pengerjaan</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Karyawan wajib melampirkan link (Google Drive, Notion, dll) saat submit review</p>
                  </div>
                </label>

                {form.priority && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: PRIORITY_CFG[form.priority].bg, border: `1px solid ${PRIORITY_CFG[form.priority].dot}30` }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_CFG[form.priority].dot }} />
                    <span style={{ fontSize: 12, color: PRIORITY_CFG[form.priority].color, fontWeight: 600 }}>Prioritas {PRIORITY_CFG[form.priority].label}</span>
                  </motion.div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <motion.button type="button" whileHover={{ background: "#f9fafb" }} whileTap={{ scale: 0.97 }} onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</motion.button>
                  <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} disabled={submitting}
                    style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submitting ? "#9ca3af" : "#111827", fontSize: 13, fontWeight: 600, color: "white", cursor: submitting ? "not-allowed" : "pointer" }}>
                    {submitting ? "Menyimpan..." : editing ? "Perbarui Task" : "Buat Task"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REVIEW SUBMISSION MODAL ── */}
      <AnimatePresence>
        {reviewModal && (
          <motion.div key="review-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setReviewModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertCircle size={16} color="#8b5cf6" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Kirim untuk Review</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reviewModal.task.title}</p>
                  </div>
                </div>
                <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setReviewModal(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <form onSubmit={submitForReview} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan pengerjaan *</label>
                  <textarea required value={reviewForm.note} onChange={e => setReviewForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Jelaskan apa yang sudah dikerjakan, hasil yang dicapai, dan kendala jika ada..."
                    rows={4} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Bukti pengerjaan {reviewModal.task.requires_proof ? <span style={{ color: "#ef4444" }}>*</span> : <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opsional)</span>}
                  </label>
                  {/* Upload file */}
                  <input ref={proofFileRef} type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.pdf" style={{ display: "none" }} onChange={handleProofFileSelect} />
                  <motion.button type="button" whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.97 }}
                    disabled={uploadingProof}
                    onClick={() => proofFileRef.current?.click()}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "1.5px dashed #d1d5db", background: proofFileName ? "#f0fdf4" : "#f9fafb", color: proofFileName ? "#059669" : "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: 8 }}>
                    {uploadingProof
                      ? <><div style={{ width: 12, height: 12, border: "2px solid #d1d5db", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Mengupload...</>
                      : proofFileName
                        ? <><CheckCircle size={13} /> {proofFileName}</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload file (jpg/png/pdf/word/ppt/excel)</>
                    }
                  </motion.button>
                  {/* OR paste URL */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>atau tempel link</span>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  </div>
                  <input value={proofFileName ? "" : reviewForm.proof_url}
                    onChange={e => { setProofFileName(null); setReviewForm(f => ({ ...f, proof_url: e.target.value })); }}
                    placeholder="https://drive.google.com/... atau link lainnya"
                    disabled={!!proofFileName}
                    type="url" className="clean-input" style={{ width: "100%", boxSizing: "border-box", opacity: proofFileName ? 0.45 : 1 }} />
                  {reviewModal.task.requires_proof && !proofFileName && !reviewForm.proof_url && (
                    <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>Wajib upload file atau tempel link bukti pengerjaan.</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <motion.button type="button" whileHover={{ background: "#f9fafb" }} whileTap={{ scale: 0.97 }} onClick={() => setReviewModal(null)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</motion.button>
                  <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} disabled={submittingReview}
                    style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submittingReview ? "#9ca3af" : "#7c3aed", fontSize: 13, fontWeight: 600, color: "white", cursor: submittingReview ? "not-allowed" : "pointer" }}>
                    {submittingReview ? "Mengirim..." : "Kirim untuk Review"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div key="reject-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setRejectModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}><ThumbsDown size={16} color="#ef4444" /></div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Tolak & Kembalikan</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Task akan kembali ke status Dikerjakan</p>
                  </div>
                </div>
                <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setRejectModal(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <form onSubmit={rejectTask} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Alasan penolakan</label>
                  <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    placeholder="Jelaskan apa yang perlu diperbaiki atau dilengkapi oleh karyawan..."
                    rows={3} className="clean-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Catatan ini akan terlihat oleh karyawan di baris task mereka.</p>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <motion.button type="button" whileHover={{ background: "#f9fafb" }} whileTap={{ scale: 0.97 }} onClick={() => setRejectModal(null)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</motion.button>
                  <motion.button type="submit" whileHover={{ background: "#dc2626" }} whileTap={{ scale: 0.97 }} disabled={submittingReject}
                    style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: submittingReject ? "#9ca3af" : "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: submittingReject ? "not-allowed" : "pointer" }}>
                    {submittingReject ? "Memproses..." : "Tolak & Kembalikan"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACTIVITY LOG MODAL ── */}
      <AnimatePresence>
        {logsModal && (
          <motion.div key="logs-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setLogsModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><History size={16} color="#6b7280" /></div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Riwayat Aktivitas</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{logsModal.task.title}</p>
                  </div>
                </div>
                <motion.button whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }} onClick={() => setLogsModal(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              {/* Task summary bar */}
              {logsModal.task.proof_url && (
                <div style={{ padding: "10px 24px", background: "#f0fdf4", borderBottom: "1px solid #d1fae5", display: "flex", alignItems: "center", gap: 8 }}>
                  <Link2 size={12} color="#10b981" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}>Bukti pengerjaan:</span>
                  <a href={sanitizeUrl(logsModal.task.proof_url)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {logsModal.task.proof_url}
                  </a>
                  <ExternalLink size={11} color="#3b82f6" style={{ flexShrink: 0 }} />
                </div>
              )}

              {/* Timeline */}
              <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px 24px" }}>
                {loadingLogs ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 13 }}>Memuat riwayat...</div>
                ) : taskLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <History size={32} style={{ color: "#e5e7eb", margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada aktivitas tercatat</p>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    {/* Vertical line */}
                    <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1.5, background: "#f3f4f6", borderRadius: 1 }} />
                    {taskLogs.map((log, i) => {
                      const cfg = ACTION_CFG[log.action] ?? { label: log.action, dotColor: "#9ca3af", textColor: "#6b7280" };
                      const ts  = new Date(log.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={log.id} style={{ display: "flex", gap: 16, paddingBottom: i < taskLogs.length - 1 ? 22 : 0 }}>
                          {/* Dot */}
                          <div style={{ width: 31, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 3 }}>
                            <div style={{ width: 11, height: 11, borderRadius: "50%", background: cfg.dotColor, border: "2px solid white", position: "relative", zIndex: 1, boxShadow: `0 0 0 2px ${cfg.dotColor}30` }} />
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, paddingBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.textColor }}>{cfg.label}</span>
                              {log.from_status && log.to_status && (
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                  {STATUS_LABELS[log.from_status] ?? log.from_status} → {STATUS_LABELS[log.to_status] ?? log.to_status}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                              <span style={{ fontWeight: 500, color: "#6b7280" }}>{log.actor?.full_name ?? "System"}</span>
                              {log.actor?.role && <span style={{ marginLeft: 4, fontSize: 10 }}>· {log.actor.role.replace(/_/g, " ")}</span>}
                              <span style={{ marginLeft: 4 }}>· {ts}</span>
                            </div>
                            {log.note && (
                              <div style={{ fontSize: 12, color: "#374151", marginTop: 8, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", lineHeight: 1.5 }}>
                                {log.note}
                              </div>
                            )}
                            {log.proof_url && (
                              <a href={sanitizeUrl(log.proof_url)} target="_blank" rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, color: "#3b82f6", textDecoration: "none", background: "#eff6ff", padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
                                <Link2 size={11} /> Lihat bukti pengerjaan <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              style={{ background: "white", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 360, width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Trash2 size={22} color="#ef4444" /></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Hapus Task?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 22, lineHeight: 1.5 }}>Task dan seluruh riwayat aktivitasnya akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileHover={{ background: "#f9fafb" }} onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Batal</motion.button>
                <motion.button whileHover={{ background: "#dc2626" }} whileTap={{ scale: 0.97 }} onClick={handleDelete} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Ya, Hapus</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, padding: "12px 18px", borderRadius: 12, background: toast.type === "ok" ? "#111827" : "#ef4444", color: "white", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            {toast.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
