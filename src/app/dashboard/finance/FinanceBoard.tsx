"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, FinanceTransaction, Reimbursement } from "@/types";
import {
  Wallet, Plus, X, Check, TrendingUp, TrendingDown,
  DollarSign, Clock, CheckCircle, XCircle, Eye,
  Edit2, Trash2, ArrowUpRight, ArrowDownRight, FileText,
} from "lucide-react";

const EXPENSE_CATEGORIES = ["Operasional", "Marketing", "Training", "SDM", "Teknologi", "Transportasi", "Konsumsi", "Lainnya"];
const INCOME_CATEGORIES = ["Pembayaran Klien", "Training Fee", "Konsultasi", "Hibah", "Lainnya"];

function fmtRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_TRX: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",    color: "#f59e0b", bg: "#fffbeb" },
  confirmed: { label: "Confirmed",  color: "#10b981", bg: "#f0fdf4" },
  cancelled: { label: "Dibatalkan", color: "#9ca3af", bg: "#f3f4f6" },
};
const STATUS_REIMB: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:  { label: "Menunggu",  color: "#f59e0b", bg: "#fffbeb", icon: <Clock size={12} /> },
  approved: { label: "Disetujui", color: "#10b981", bg: "#f0fdf4", icon: <CheckCircle size={12} /> },
  rejected: { label: "Ditolak",   color: "#ef4444", bg: "#fef2f2", icon: <XCircle size={12} /> },
};

const EMPTY_TRX = { title: "", amount: "", type: "expense" as "income" | "expense", category: "Operasional", date: new Date().toISOString().split("T")[0], description: "", status: "confirmed" as FinanceTransaction["status"] };
const EMPTY_REIMB = { title: "", amount: "", description: "" };

interface Props {
  currentUser: UserProfile;
  initialTransactions: FinanceTransaction[];
  initialReimbursements: Reimbursement[];
}

export default function FinanceBoard({ currentUser, initialTransactions, initialReimbursements }: Props) {
  const supabase = createClient();

  const canManageTrx = ["kep_finance", "staff_finance", "staff_dokumen"].includes(currentUser.role);
  const canApprove   = ["super_admin", "manager", "kep_finance"].includes(currentUser.role);
  const isViewOnly   = ["super_admin", "manager"].includes(currentUser.role) && !canManageTrx;

  const [tab, setTab] = useState<"overview" | "transaksi" | "reimbursement">("overview");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(initialTransactions);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>(initialReimbursements);
  const [showTrxModal, setShowTrxModal] = useState(false);
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [editingTrx, setEditingTrx] = useState<FinanceTransaction | null>(null);
  const [trxForm, setTrxForm] = useState(EMPTY_TRX);
  const [reimbForm, setReimbForm] = useState(EMPTY_REIMB);
  const [reviewTarget, setReviewTarget] = useState<Reimbursement | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [deleteTrxId, setDeleteTrxId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  // Stats
  const totalIncome  = transactions.filter(t => t.type === "income"  && t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense" && t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;
  const pendingReimb = reimbursements.filter(r => r.status === "pending").length;

  // Category breakdown for overview
  const expenseByCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: transactions.filter(t => t.type === "expense" && t.category === cat && t.status === "confirmed").reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // CRUD: Transactions
  const handleSaveTrx = async () => {
    if (!trxForm.title.trim() || !trxForm.amount) return;
    setSubmitting(true);
    const payload = {
      title: trxForm.title.trim(),
      amount: Number(String(trxForm.amount).replace(/\D/g, "")),
      type: trxForm.type,
      category: trxForm.category,
      date: trxForm.date,
      description: trxForm.description.trim() || null,
      status: trxForm.status,
      created_by: currentUser.id,
    };
    if (editingTrx) {
      const { data, error } = await supabase.from("finance_transactions").update(payload).eq("id", editingTrx.id).select("*, profiles(full_name)").single();
      if (error) showToast(error.message, false);
      else { setTransactions(prev => prev.map(t => t.id === editingTrx.id ? data : t)); showToast("Transaksi diperbarui"); }
    } else {
      const { data, error } = await supabase.from("finance_transactions").insert(payload).select("*, profiles(full_name)").single();
      if (error) showToast(error.message, false);
      else { setTransactions(prev => [data, ...prev]); showToast("Transaksi ditambahkan"); }
    }
    setSubmitting(false);
    setShowTrxModal(false);
  };

  const handleDeleteTrx = async (id: string) => {
    const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (error) showToast(error.message, false);
    else { setTransactions(prev => prev.filter(t => t.id !== id)); showToast("Transaksi dihapus"); }
    setDeleteTrxId(null);
  };

  // CRUD: Reimbursements
  const handleSubmitReimb = async () => {
    if (!reimbForm.title.trim() || !reimbForm.amount) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("reimbursements").insert({
      title: reimbForm.title.trim(),
      amount: Number(String(reimbForm.amount).replace(/\D/g, "")),
      description: reimbForm.description.trim() || null,
      requested_by: currentUser.id,
    }).select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role)").single();
    if (error) showToast(error.message, false);
    else { setReimbursements(prev => [data, ...prev]); showToast("Reimbursement diajukan"); }
    setSubmitting(false);
    setReimbForm(EMPTY_REIMB);
    setShowReimbModal(false);
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    setSubmitting(true);
    const { data, error } = await supabase.from("reimbursements").update({
      status, reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote.trim() || null,
    }).eq("id", id)
      .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role), reviewer:profiles!reimbursements_reviewed_by_fkey(full_name)")
      .single();
    if (error) showToast(error.message, false);
    else {
      setReimbursements(prev => prev.map(r => r.id === id ? data : r));
      showToast(status === "approved" ? "Reimbursement disetujui" : "Reimbursement ditolak");
    }
    setSubmitting(false);
    setReviewTarget(null);
    setReviewNote("");
  };

  const filteredTrx = transactions.filter(t => typeFilter === "all" || t.type === typeFilter);

  const TABS = [
    { key: "overview",      label: "Overview" },
    { key: "transaksi",     label: "Transaksi" },
    { key: "reimbursement", label: `Reimbursement${pendingReimb > 0 ? ` (${pendingReimb})` : ""}` },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #047857)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
          }}>
            <Wallet size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Finance</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              {isViewOnly ? "Mode lihat saja" : "Manajemen keuangan"}
              {pendingReimb > 0 && <span style={{ marginLeft: 6, color: "#f59e0b", fontWeight: 600 }}>· {pendingReimb} reimbursement menunggu</span>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageTrx && tab === "transaksi" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingTrx(null); setTrxForm(EMPTY_TRX); setShowTrxModal(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg, #10b981, #047857)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
              }}>
              <Plus size={15} /> Tambah Transaksi
            </motion.button>
          )}
          {tab === "reimbursement" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setReimbForm(EMPTY_REIMB); setShowReimbModal(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
              }}>
              <Plus size={15} /> Ajukan Reimbursement
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", gap: 4, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "14px 16px", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "#10b981" : "#6b7280",
              borderBottom: tab === t.key ? "2px solid #10b981" : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        <AnimatePresence mode="wait">

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 4 stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { label: "Total Pemasukan", val: fmtRupiah(totalIncome),  icon: <ArrowUpRight size={18} />, color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
                  { label: "Total Pengeluaran", val: fmtRupiah(totalExpense), icon: <ArrowDownRight size={18} />, color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
                  { label: "Saldo Bersih",    val: fmtRupiah(balance),      icon: <DollarSign size={18} />,   color: balance >= 0 ? "#10b981" : "#ef4444", bg: balance >= 0 ? "#f0fdf4" : "#fef2f2", border: balance >= 0 ? "#d1fae5" : "#fecaca" },
                  { label: "Reimb. Pending",  val: `${pendingReimb} pengajuan`, icon: <Clock size={18} />, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    style={{ background: "#fff", border: `1px solid ${s.border}`, borderRadius: 14, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{s.label}</p>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{s.val}</p>
                  </motion.div>
                ))}
              </div>

              {/* Expense breakdown */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Pengeluaran per Kategori</h3>
                {expenseByCategory.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Belum ada data pengeluaran</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {expenseByCategory.map((c, i) => {
                      const pct = totalExpense > 0 ? (c.total / totalExpense) * 100 : 0;
                      return (
                        <div key={c.cat}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{c.cat}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmtRupiah(c.total)}</span>
                          </div>
                          <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                              style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #047857)", borderRadius: 3 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Transaksi Terbaru</h3>
                {transactions.slice(0, 8).length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Belum ada transaksi</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {transactions.slice(0, 8).map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: t.type === "income" ? "#f0fdf4" : "#fef2f2",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {t.type === "income"
                            ? <ArrowUpRight size={15} color="#10b981" />
                            : <ArrowDownRight size={15} color="#ef4444" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.title}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{t.category} · {fmtDate(t.date)}</p>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                          {t.type === "income" ? "+" : "-"}{fmtRupiah(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TRANSAKSI TAB */}
          {tab === "transaksi" && (
            <motion.div key="transaksi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Type filter */}
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "all", label: "Semua" },
                  { key: "income", label: "Pemasukan" },
                  { key: "expense", label: "Pengeluaran" },
                ].map(f => (
                  <motion.button key={f.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setTypeFilter(f.key as any)}
                    style={{
                      padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      border: typeFilter === f.key ? "1.5px solid #10b981" : "1.5px solid #e5e7eb",
                      background: typeFilter === f.key ? "#f0fdf4" : "#fff",
                      color: typeFilter === f.key ? "#059669" : "#6b7280", transition: "all 0.15s",
                    }}>{f.label}</motion.button>
                ))}
              </div>

              {/* Table */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px", padding: "11px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                  {["Transaksi", "Tipe", "Kategori", "Tanggal", "Jumlah", "Aksi"].map(h => (
                    <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</p>
                  ))}
                </div>
                {filteredTrx.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada transaksi</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredTrx.map((t, i) => {
                      const st = STATUS_TRX[t.status];
                      return (
                        <motion.div key={t.id} layout
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.03 }}
                          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px", padding: "14px 20px", alignItems: "center", borderBottom: "1px solid #f9fafb" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.title}</p>
                            {t.description && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{t.description}</p>}
                          </div>
                          <div>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                              background: t.type === "income" ? "#f0fdf4" : "#fef2f2",
                              color: t.type === "income" ? "#059669" : "#dc2626",
                            }}>
                              {t.type === "income" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: "#6b7280" }}>{t.category}</p>
                          <p style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(t.date)}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                            {t.type === "income" ? "+" : "-"}{fmtRupiah(t.amount)}
                          </p>
                          <div style={{ display: "flex", gap: 4 }}>
                            {canManageTrx && (
                              <>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                                  onClick={() => { setEditingTrx(t); setTrxForm({ title: t.title, amount: String(t.amount), type: t.type, category: t.category, date: t.date, description: t.description ?? "", status: t.status }); setShowTrxModal(true); }}
                                  style={{ padding: 6, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 7, cursor: "pointer", display: "flex" }}>
                                  <Edit2 size={12} color="#6b7280" />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                                  onClick={() => setDeleteTrxId(t.id)}
                                  style={{ padding: 6, border: "1px solid #fee2e2", background: "#fff", borderRadius: 7, cursor: "pointer", display: "flex" }}>
                                  <Trash2 size={12} color="#ef4444" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

          {/* REIMBURSEMENT TAB */}
          {tab === "reimbursement" && (
            <motion.div key="reimbursement" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {reimbursements.length === 0 ? (
                <div style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada pengajuan reimbursement</p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowReimbModal(true)}
                    style={{ marginTop: 20, background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Ajukan Sekarang
                  </motion.button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {reimbursements.map((r, i) => {
                    const st = STATUS_REIMB[r.status];
                    const requester = (r.requester as any)?.full_name || "—";
                    const isOwn = r.requested_by === currentUser.id;
                    return (
                      <motion.div key={r.id} layout
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: i * 0.05 }}
                        style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: st.bg, color: st.color, display: "flex", alignItems: "center", gap: 4 }}>
                                {st.icon} {st.label}
                              </span>
                              {isOwn && <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "1px 6px" }}>Pengajuanmu</span>}
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.title}</p>
                            <p style={{ fontSize: 16, fontWeight: 800, color: "#10b981", marginTop: 4 }}>{fmtRupiah(r.amount)}</p>
                            {r.description && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>{r.description}</p>}
                            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                              Diajukan oleh {requester} · {fmtDate(r.created_at)}
                            </p>
                            {r.review_note && (
                              <div style={{ marginTop: 8, padding: "8px 12px", background: r.status === "approved" ? "#f0fdf4" : "#fef2f2", borderRadius: 8, fontSize: 12, color: r.status === "approved" ? "#059669" : "#dc2626" }}>
                                Catatan reviewer: {r.review_note}
                              </div>
                            )}
                          </div>
                          {canApprove && r.status === "pending" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                                onClick={() => { setReviewTarget(r); setReviewNote(""); }}
                                style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 9, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                                <Eye size={13} /> Review
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Transaksi Modal */}
      <AnimatePresence>
        {showTrxModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowTrxModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflow: "auto" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{editingTrx ? "Edit Transaksi" : "Tambah Transaksi"}</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowTrxModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Type toggle */}
                <div style={{ display: "flex", gap: 0, border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  {[["income", "Pemasukan", "#10b981"], ["expense", "Pengeluaran", "#ef4444"]].map(([k, label, color]) => (
                    <button key={k} onClick={() => setTrxForm(f => ({ ...f, type: k as any, category: k === "income" ? "Pembayaran Klien" : "Operasional" }))}
                      style={{
                        flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                        background: trxForm.type === k ? color : "#fff",
                        color: trxForm.type === k ? "#fff" : "#9ca3af",
                        transition: "all 0.15s",
                      }}>{label}</button>
                  ))}
                </div>
                {/* Title */}
                {[{ label: "Keterangan *", key: "title", type: "text", placeholder: "Nama transaksi..." }].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(trxForm as any)[f.key]}
                      onChange={e => setTrxForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                ))}
                {/* Amount */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Jumlah (Rp) *</label>
                  <input type="text" placeholder="0" value={trxForm.amount}
                    onChange={e => setTrxForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, "") }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  {trxForm.amount && <p style={{ fontSize: 11, color: "#10b981", marginTop: 3 }}>{fmtRupiah(Number(trxForm.amount))}</p>}
                </div>
                {/* Category & Date */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kategori</label>
                    <select value={trxForm.category} onChange={e => setTrxForm(f => ({ ...f, category: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      {(trxForm.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tanggal</label>
                    <input type="date" value={trxForm.date} onChange={e => setTrxForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan</label>
                  <textarea rows={2} placeholder="Keterangan tambahan..." value={trxForm.description}
                    onChange={e => setTrxForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSaveTrx}
                  disabled={submitting || !trxForm.title.trim() || !trxForm.amount}
                  style={{
                    width: "100%", padding: "12px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
                    background: submitting || !trxForm.title.trim() || !trxForm.amount ? "#d1d5db" : "linear-gradient(135deg, #10b981, #047857)",
                    color: "#fff", transition: "all 0.2s",
                  }}>
                  {submitting ? "Menyimpan..." : editingTrx ? "Perbarui" : "Simpan Transaksi"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reimb Modal */}
      <AnimatePresence>
        {showReimbModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowReimbModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Ajukan Reimbursement</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowReimbModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}><X size={16} color="#6b7280" /></motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {[{ label: "Keperluan *", key: "title", placeholder: "Contoh: Transport klien..." }, { label: "Jumlah (Rp) *", key: "amount", placeholder: "0" }].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{f.label}</label>
                    <input type="text" placeholder={f.placeholder} value={(reimbForm as any)[f.key]}
                      onChange={e => setReimbForm(prev => ({ ...prev, [f.key]: f.key === "amount" ? e.target.value.replace(/\D/g, "") : e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                    {f.key === "amount" && reimbForm.amount && <p style={{ fontSize: 11, color: "#6366f1", marginTop: 3 }}>{fmtRupiah(Number(reimbForm.amount))}</p>}
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Keterangan</label>
                  <textarea rows={3} placeholder="Jelaskan keperluan reimbursement..." value={reimbForm.description}
                    onChange={e => setReimbForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSubmitReimb}
                  disabled={submitting || !reimbForm.title.trim() || !reimbForm.amount}
                  style={{
                    width: "100%", padding: "12px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
                    background: submitting || !reimbForm.title.trim() || !reimbForm.amount ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", transition: "all 0.2s",
                  }}>
                  {submitting ? "Mengajukan..." : "Ajukan Reimbursement"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setReviewTarget(null); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Review Reimbursement</h2>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{reviewTarget.title} — <strong>{fmtRupiah(reviewTarget.amount)}</strong></p>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan (opsional)</label>
                  <textarea rows={3} placeholder="Alasan persetujuan atau penolakan..." value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleReview(reviewTarget.id, "rejected")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "1.5px solid #fecaca", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <XCircle size={15} /> Tolak
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleReview(reviewTarget.id, "approved")} disabled={submitting}
                    style={{ flex: 1, padding: "11px", border: "none", borderRadius: 11, background: "linear-gradient(135deg, #10b981, #047857)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <CheckCircle size={15} /> Setujui
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTrxId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Transaksi?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Data transaksi ini akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteTrxId(null)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>Batal</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDeleteTrx(deleteTrxId)}
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
