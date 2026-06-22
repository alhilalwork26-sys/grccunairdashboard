"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import {
  ClipboardCheck, CheckCircle, XCircle, Check, X,
  DollarSign, ListTodo, Clock, AlertTriangle,
} from "lucide-react";

interface PendingReimb {
  id: string;
  title: string;
  amount: number;
  description?: string | null;
  requested_by?: string | null;
  created_at: string;
  requester?: { full_name: string; role: string } | null;
}

interface ReviewTask {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  assigned_to?: string | null;
  due_date?: string | null;
  created_at: string;
  assignee?: { full_name: string } | null;
  creator?: { full_name: string } | null;
}

const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  low:    { color: "#9ca3af", bg: "#f3f4f6" },
  medium: { color: "#3b82f6", bg: "#eff6ff" },
  high:   { color: "#f59e0b", bg: "#fffbeb" },
  urgent: { color: "#ef4444", bg: "#fef2f2" },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", manager: "Manager", program_admin: "Program Admin",
  kep_marketing: "Kep. Marketing", staff_kreatif: "Staff Kreatif",
  staff_marketing: "Staff Marketing", kep_finance: "Kep. Finance",
  staff_finance: "Staff Finance", staff_dokumen: "Staff Dokumen", kep_trainer: "Kep. Trainer",
};

function fmtRupiah(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }

interface Props {
  currentUser: UserProfile;
  pendingReimbursements: PendingReimb[];
  reviewTasks: ReviewTask[];
}

export default function ApprovalsBoard({ currentUser, pendingReimbursements, reviewTasks }: Props) {
  const supabase = createClient();

  const [reimbs, setReimbs] = useState<PendingReimb[]>(pendingReimbursements);
  const [tasks, setTasks] = useState<ReviewTask[]>(reviewTasks);
  const [reviewingReimb, setReviewingReimb] = useState<PendingReimb | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [approvingTask, setApprovingTask] = useState<ReviewTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

  const handleReimb = async (id: string, status: "approved" | "rejected") => {
    setSubmitting(true);
    const { error } = await supabase.from("reimbursements").update({
      status, reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote.trim() || null,
    }).eq("id", id);
    if (error) showToast(error.message, false);
    else { setReimbs(prev => prev.filter(r => r.id !== id)); showToast(status === "approved" ? "Reimbursement disetujui" : "Ditolak"); }
    setSubmitting(false);
    setReviewingReimb(null);
    setReviewNote("");
  };

  const handleTaskApprove = async (id: string, newStatus: "done" | "in_progress") => {
    setSubmitting(true);
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
    if (error) showToast(error.message, false);
    else {
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast(newStatus === "done" ? "Task ditandai selesai" : "Task dikembalikan ke progress");
    }
    setSubmitting(false);
    setApprovingTask(null);
  };

  const total = reimbs.length + tasks.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", alignItems: "center", height: 64, flexShrink: 0, gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
          <ClipboardCheck size={17} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Approval Center</h1>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
            {total > 0 ? <span style={{ color: "#f59e0b", fontWeight: 600 }}>{total} item menunggu persetujuan</span> : "Tidak ada yang perlu disetujui"}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { label: "Reimbursement Pending", val: reimbs.length, icon: <DollarSign size={18} />, color: "#6366f1", bg: "#eef2ff" },
            { label: "Task Perlu Review",     val: tasks.length,  icon: <ListTodo size={18} />,  color: "#f59e0b", bg: "#fffbeb" },
            { label: "Total Pending",          val: total,          icon: <Clock size={18} />,     color: total > 0 ? "#ef4444" : "#10b981", bg: total > 0 ? "#fef2f2" : "#f0fdf4" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.val}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {total === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Semua sudah beres!</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Tidak ada item yang perlu persetujuan saat ini</p>
          </motion.div>
        )}

        {/* Reimbursement section */}
        {reimbs.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <DollarSign size={15} color="#6366f1" />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Reimbursement Pending</h2>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#eef2ff", color: "#6366f1", borderRadius: 20, padding: "2px 8px" }}>{reimbs.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {reimbs.map((r, i) => {
                  const requester = (r.requester as any)?.full_name || "—";
                  const role = (r.requester as any)?.role || "";
                  return (
                    <motion.div key={r.id} layout
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <DollarSign size={18} color="#6366f1" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.title}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: "#6366f1", marginTop: 2 }}>{fmtRupiah(r.amount)}</p>
                        {r.description && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{r.description}</p>}
                        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                          {requester} · {ROLE_LABELS[role] ?? role} · {fmtDate(r.created_at)}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => { setReviewingReimb(r); setReviewNote(""); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          Review
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Tasks in review section */}
        {tasks.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <ListTodo size={15} color="#f59e0b" />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Task Menunggu Review</h2>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#fffbeb", color: "#d97706", borderRadius: 20, padding: "2px 8px" }}>{tasks.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {tasks.map((t, i) => {
                  const pc = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
                  const assignee = (t.assignee as any)?.full_name || "—";
                  return (
                    <motion.div key={t.id} layout
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <ListTodo size={18} color="#f59e0b" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t.title}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: pc.bg, color: pc.color }}>
                            {t.priority}
                          </span>
                        </div>
                        {t.description && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{t.description}</p>}
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>
                          Dikerjakan: {assignee}
                          {t.due_date && ` · Deadline: ${fmtDate(t.due_date)}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setApprovingTask(t)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          Review Task
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Reimb Review Modal */}
      <AnimatePresence>
        {reviewingReimb && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setReviewingReimb(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Review Reimbursement</h2>
                <div style={{ marginTop: 10, padding: "12px 14px", background: "#f9fafb", borderRadius: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{reviewingReimb.title}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#6366f1", marginTop: 4 }}>{fmtRupiah(reviewingReimb.amount)}</p>
                  {reviewingReimb.description && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{reviewingReimb.description}</p>}
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                    dari {(reviewingReimb.requester as any)?.full_name} · {fmtDate(reviewingReimb.created_at)}
                  </p>
                </div>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan (opsional)</label>
                  <textarea rows={3} placeholder="Alasan keputusan..." value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleReimb(reviewingReimb.id, "rejected")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "1.5px solid #fecaca", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <XCircle size={15} /> Tolak
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleReimb(reviewingReimb.id, "approved")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "none", borderRadius: 11, background: "linear-gradient(135deg, #10b981, #047857)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <CheckCircle size={15} /> Setujui
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Approval Modal */}
      <AnimatePresence>
        {approvingTask && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setApprovingTask(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Review Task</h2>
                <div style={{ marginTop: 10, padding: "12px 14px", background: "#fffbeb", borderRadius: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{approvingTask.title}</p>
                  {approvingTask.description && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{approvingTask.description}</p>}
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                    Dikerjakan oleh {(approvingTask.assignee as any)?.full_name || "—"}
                    {approvingTask.due_date && ` · Deadline: ${fmtDate(approvingTask.due_date)}`}
                  </p>
                </div>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: "#6b7280" }}>Tandai task ini sebagai:</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleTaskApprove(approvingTask.id, "in_progress")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "1.5px solid #fde68a", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <AlertTriangle size={14} /> Kembalikan
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleTaskApprove(approvingTask.id, "done")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "none", borderRadius: 11, background: "linear-gradient(135deg, #10b981, #047857)", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <CheckCircle size={14} /> Tandai Selesai
                  </motion.button>
                </div>
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
