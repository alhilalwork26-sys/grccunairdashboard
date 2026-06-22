"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, X, Edit2, Trash2, Calendar, ChevronDown,
  CheckCircle, Clock, Circle, AlertCircle, ListTodo,
  Flag, UserCircle, MoreHorizontal
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Topbar from "@/components/layout/Topbar";
import type { Task, UserProfile } from "@/types";

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
};

interface Props {
  initialTasks: Task[];
  profiles: Pick<UserProfile, "id" | "full_name" | "role">[];
  currentUser: UserProfile;
}

export default function TaskBoard({ initialTasks, profiles, currentUser }: Props) {
  const [tasks, setTasks]           = useState<Task[]>(initialTasks);
  const [tab, setTab]               = useState("all");
  const [search, setSearch]         = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Task | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const supabase = createClient();

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const filtered = useMemo(() => tasks.filter(t => {
    if (tab !== "all" && t.status !== tab) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, tab, priorityFilter, search]);

  const stats = useMemo(() => ({
    total:       tasks.length,
    pending:     tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done:        tasks.filter(t => t.status === "done").length,
  }), [tasks]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title:       task.title,
      description: task.description ?? "",
      status:      task.status,
      priority:    task.priority,
      assigned_to: task.assigned_to ?? "",
      due_date:    task.due_date ?? "",
    });
    setShowModal(true);
    setOpenMenu(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const payload = {
      title:       form.title.trim(),
      description: form.description.trim() || null,
      status:      form.status,
      priority:    form.priority,
      assigned_to: form.assigned_to || null,
      due_date:    form.due_date || null,
      created_by:  currentUser.id,
    };
    if (editing) {
      const { data, error } = await supabase.from("tasks").update(payload).eq("id", editing.id).select().single();
      if (!error && data) {
        setTasks(prev => prev.map(t => t.id === editing.id ? data : t));
        showToast("Task berhasil diperbarui");
      } else showToast("Gagal memperbarui task", "err");
    } else {
      const { data, error } = await supabase.from("tasks").insert(payload).select().single();
      if (!error && data) {
        setTasks(prev => [data, ...prev]);
        showToast("Task berhasil dibuat");
      } else showToast("Gagal membuat task", "err");
    }
    setSubmitting(false);
    setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("tasks").delete().eq("id", deleteId);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== deleteId));
      showToast("Task dihapus");
    } else showToast("Gagal menghapus task", "err");
    setDeleteId(null);
  }

  async function quickStatus(id: string, status: Task["status"]) {
    await supabase.from("tasks").update({ status }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    setOpenMenu(null);
  }

  function getName(id?: string | null) {
    return profiles.find(p => p.id === id)?.full_name ?? "-";
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function formatDate(d?: string | null) {
    if (!d) return "-";
    const date = new Date(d);
    const isOverdue = date < new Date() && new Date().toDateString() !== date.toDateString();
    return { text: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), overdue: isOverdue };
  }

  const canManage = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"].includes(currentUser.role);

  useEffect(() => {
    function handler() { setOpenMenu(null); }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="Task Management" />

      <div style={{ flex: 1, padding: "24px 24px 40px" }}>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Task Management</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Kelola dan pantau progres tugas tim.</p>
          </div>
          {canManage && (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={openCreate}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 12,
                background: "#111827", border: "none",
                fontSize: 13, fontWeight: 600, color: "white",
                cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
              }}
            >
              <Plus size={15} /> Tambah Task
            </motion.button>
          )}
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Task",   value: stats.total,       color: "#111827", bg: "#f9fafb", border: "#e5e7eb" },
            { label: "Pending",      value: stats.pending,     color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
            { label: "Dikerjakan",   value: stats.in_progress, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
            { label: "Selesai",      value: stats.done,        color: "#10b981", bg: "#f0fdf4", border: "#a7f3d0" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.07)" }}
              style={{
                background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14,
                padding: "16px 18px", transition: "box-shadow 0.2s",
              }}
            >
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
              <div style={{ height: 3, borderRadius: 4, background: s.border, marginTop: 10 }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: stats.total ? `${(s.value / stats.total) * 100}%` : "0%" }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 4, background: s.color }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{
            background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14,
            overflow: "hidden", marginBottom: 16,
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "0 16px" }}>
            {TABS.map(t => {
              const count = t.key === "all" ? tasks.length : tasks.filter(x => x.status === t.key).length;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    position: "relative", padding: "13px 14px 12px",
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? "#111827" : "#6b7280",
                    background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {t.label}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                    background: active ? "#111827" : "#f3f4f6",
                    color: active ? "white" : "#6b7280",
                    transition: "all 0.2s",
                  }}>{count}</span>
                  {active && (
                    <motion.div
                      layoutId="task-tab-bar"
                      style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#111827", borderRadius: 2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}

            {/* Search + priority filter (right side) */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, paddingTop: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari task..."
                  style={{
                    padding: "7px 12px 7px 30px", borderRadius: 9, border: "1px solid #e5e7eb",
                    fontSize: 12, color: "#111827", background: "#f9fafb", outline: "none", width: 180,
                  }}
                />
              </div>
              <select
                value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                style={{
                  padding: "7px 12px", borderRadius: 9, border: "1px solid #e5e7eb",
                  fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">Semua Prioritas</option>
                <option value="urgent">Urgent</option>
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 160px 100px 110px 110px 48px",
            padding: "9px 18px", borderBottom: "1px solid #f9fafb",
            fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            <span>Task</span><span>Assign ke</span><span>Prioritas</span><span>Deadline</span><span>Status</span><span></span>
          </div>

          {/* Task rows */}
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: "52px 0", textAlign: "center" }}
              >
                <ListTodo size={36} style={{ color: "#e5e7eb", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500 }}>
                  {search ? "Tidak ada task yang cocok" : "Belum ada task"}
                </p>
                {canManage && !search && (
                  <button onClick={openCreate} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 10, background: "#111827", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                    + Buat Task Pertama
                  </button>
                )}
              </motion.div>
            ) : (
              filtered.map((task, i) => {
                const sc = STATUS_CFG[task.status];
                const pc = PRIORITY_CFG[task.priority];
                const assignee = getName(task.assigned_to);
                const due = formatDate(task.due_date);
                const StatusIcon = sc.Icon;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    whileHover={{ background: "#fafafa" }}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 160px 100px 110px 110px 48px",
                      alignItems: "center", padding: "13px 18px",
                      borderBottom: "1px solid #f9fafb",
                      transition: "background 0.15s", cursor: "default",
                    }}
                  >
                    {/* Title */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Assignee */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {task.assigned_to ? (
                        <>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0,
                          }}>{getInitials(assignee)}</div>
                          <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assignee}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                      )}
                    </div>

                    {/* Priority */}
                    <div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 9px", borderRadius: 20,
                        background: pc.bg, fontSize: 11, fontWeight: 600, color: pc.color,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc.dot, flexShrink: 0 }} />
                        {pc.label}
                      </span>
                    </div>

                    {/* Due date */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={12} style={{ color: typeof due === "object" && due.overdue ? "#ef4444" : "#9ca3af", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: typeof due === "object" && due.overdue ? "#ef4444" : "#6b7280", fontWeight: typeof due === "object" && due.overdue ? 600 : 400 }}>
                        {typeof due === "object" ? due.text : due}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 20,
                        background: sc.bg, fontSize: 11, fontWeight: 600, color: sc.color,
                      }}>
                        <StatusIcon size={10} />
                        {sc.label}
                      </span>
                    </div>

                    {/* Actions menu */}
                    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                      <motion.button
                        whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }}
                        onClick={() => setOpenMenu(openMenu === task.id ? null : task.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                        }}
                      >
                        <MoreHorizontal size={14} color="#6b7280" />
                      </motion.button>

                      <AnimatePresence>
                        {openMenu === task.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: "absolute", right: 0, top: 32, zIndex: 50,
                              background: "white", border: "1px solid #e5e7eb",
                              borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                              minWidth: 160, overflow: "hidden",
                            }}
                          >
                            {canManage && (
                              <button onClick={() => openEdit(task)} style={{ width: "100%", padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "#374151", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                                <Edit2 size={12} /> Edit Task
                              </button>
                            )}
                            <div style={{ borderTop: "1px solid #f3f4f6", padding: "6px 0" }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", padding: "4px 14px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Ubah Status</p>
                              {(Object.entries(STATUS_CFG) as [Task["status"], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([key, cfg]) => (
                                <button
                                  key={key}
                                  onClick={() => quickStatus(task.id, key)}
                                  style={{
                                    width: "100%", padding: "8px 14px", fontSize: 12, fontWeight: task.status === key ? 600 : 400,
                                    color: task.status === key ? cfg.color : "#374151",
                                    background: task.status === key ? cfg.bg : "none",
                                    border: "none", cursor: "pointer", textAlign: "left",
                                    display: "flex", alignItems: "center", gap: 8,
                                  }}
                                >
                                  <cfg.Icon size={11} style={{ color: cfg.color }} /> {cfg.label}
                                </button>
                              ))}
                            </div>
                            {canManage && (
                              <div style={{ borderTop: "1px solid #f3f4f6" }}>
                                <button
                                  onClick={() => { setDeleteId(task.id); setOpenMenu(null); }}
                                  style={{ width: "100%", padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "#ef4444", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}
                                >
                                  <Trash2 size={12} /> Hapus Task
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
                boxShadow: "0 24px 48px rgba(0,0,0,0.2)", overflow: "hidden",
              }}
            >
              {/* Modal header */}
              <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ListTodo size={16} color="#10b981" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editing ? "Edit Task" : "Buat Task Baru"}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{editing ? "Perbarui detail task" : "Isi detail task yang akan dibuat"}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ background: "#f3f4f6" }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowModal(false)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Judul Task *</label>
                  <input
                    required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Nama task..."
                    className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detail task (opsional)..."
                    rows={3}
                    className="clean-input"
                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>

                {/* Priority + Status row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      <Flag size={11} style={{ display: "inline", marginRight: 4 }} />Prioritas
                    </label>
                    <select
                      value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task["priority"] }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="low">Rendah</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      <CheckCircle size={11} style={{ display: "inline", marginRight: 4 }} />Status
                    </label>
                    <select
                      value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Task["status"] }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">Dikerjakan</option>
                      <option value="review">Review</option>
                      <option value="done">Selesai</option>
                    </select>
                  </div>
                </div>

                {/* Assign + Due date row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      <UserCircle size={11} style={{ display: "inline", marginRight: 4 }} />Assign ke
                    </label>
                    <select
                      value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="">-- Belum diassign --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Deadline
                    </label>
                    <input
                      type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Priority visual preview */}
                {form.priority && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 14px", borderRadius: 10,
                      background: PRIORITY_CFG[form.priority].bg,
                      border: `1px solid ${PRIORITY_CFG[form.priority].dot}30`,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_CFG[form.priority].dot }} />
                    <span style={{ fontSize: 12, color: PRIORITY_CFG[form.priority].color, fontWeight: 600 }}>
                      Prioritas {PRIORITY_CFG[form.priority].label}
                    </span>
                  </motion.div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <motion.button
                    type="button" whileHover={{ background: "#f9fafb" }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                  >
                    Batal
                  </motion.button>
                  <motion.button
                    type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                    disabled={submitting}
                    style={{
                      flex: 2, padding: "11px", borderRadius: 12, border: "none",
                      background: submitting ? "#9ca3af" : "#111827",
                      fontSize: 13, fontWeight: 600, color: "white", cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting ? "Menyimpan..." : editing ? "Perbarui Task" : "Buat Task"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              style={{ background: "white", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 360, width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", textAlign: "center" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Trash2 size={22} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Hapus Task?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 22, lineHeight: 1.5 }}>Task ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileHover={{ background: "#f9fafb" }} onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  Batal
                </motion.button>
                <motion.button whileHover={{ background: "#dc2626" }} whileTap={{ scale: 0.97 }} onClick={handleDelete} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                  Ya, Hapus
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 200,
              padding: "12px 18px", borderRadius: 12,
              background: toast.type === "ok" ? "#111827" : "#ef4444",
              color: "white", fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {toast.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
