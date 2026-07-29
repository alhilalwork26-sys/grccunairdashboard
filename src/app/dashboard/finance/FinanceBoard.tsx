"use client";

import { useState, useRef, Fragment, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { uploadPayProofAction, uploadGroupPayProofAction, reviewReimbursementAction, archiveReimbursementAction, notifyFinanceNewReimbAction } from "./actions";
import type { UserProfile, FinanceTransaction, Reimbursement } from "@/types";
import {
  Wallet, Plus, X, Check,
  DollarSign, Clock, CheckCircle, XCircle, Eye,
  Edit2, Trash2, ArrowUpRight, ArrowDownRight, FileText,
  Search, Upload, Paperclip, Receipt,
  Loader2, Tag, CalendarDays, ImageIcon, Banknote, RotateCcw,
  ChevronDown, ChevronUp, ExternalLink, Archive,
} from "lucide-react";

const EXPENSE_CATEGORIES    = ["Operasional", "Marketing", "Training", "SDM", "Teknologi", "Transportasi", "Konsumsi", "Lainnya"];
const INCOME_CATEGORIES     = ["Pembayaran Klien", "Training Fee", "Konsultasi", "Hibah", "Lainnya"];
const REIMB_CATEGORIES      = ["Transport", "Makan & Minum", "Akomodasi", "ATK", "Komunikasi", "Perlengkapan", "Lainnya"];

function fmtRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateShort(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
const isImg = (url?: string | null) => !!url && !url.toLowerCase().endsWith(".pdf");

const STATUS_REIMB: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending:  { label: "Menunggu",  color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: <Clock size={11} /> },
  approved: { label: "Disetujui", color: "#059669", bg: "#f0fdf4", border: "#a7f3d0", icon: <CheckCircle size={11} /> },
  rejected: { label: "Ditolak",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: <XCircle size={11} /> },
};

const EMPTY_TRX   = { title: "", amount: "", type: "expense" as "income" | "expense", category: "Operasional", date: new Date().toISOString().split("T")[0], description: "", status: "confirmed" as FinanceTransaction["status"] };
const newReimbRow = () => ({
  key: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  title: "", amount: "", category: "Transport",
  expense_date: new Date().toISOString().split("T")[0],
  description: "", file: null as File | null,
});

function storageStamp() {
  return new Date().getTime();
}

const WIB = 7 * 3600000; // UTC+7

function getWeekKeyFromDate(utcDateStr: string): string {
  const wib = new Date(new Date(utcDateStr).getTime() + WIB);
  const day  = wib.getUTCDay();
  const off  = day === 0 ? 6 : day - 1;
  const mon  = new Date(wib);
  mon.setUTCDate(mon.getUTCDate() - off);
  return [mon.getUTCFullYear(), String(mon.getUTCMonth() + 1).padStart(2, "0"), String(mon.getUTCDate()).padStart(2, "0")].join("-");
}

function getWeekDeadline(weekKey: string): Date {
  // Sunday of the week at 17:00 WIB = 10:00 UTC
  const d = new Date(weekKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

function getWeekLabel(weekKey: string): string {
  const mon = new Date(weekKey + "T00:00:00Z");
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const sunShort = sun.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" });
  const year = sun.getUTCFullYear();
  if (mon.getUTCMonth() === sun.getUTCMonth()) {
    return `${mon.getUTCDate()}–${sun.getUTCDate()} ${sunShort} ${year}`;
  }
  const monShort = mon.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${monShort} – ${sun.getUTCDate()} ${sunShort} ${year}`;
}

function getSundayStr(weekKey: string): string {
  const d = new Date(weekKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function TimelineStep({ done, color, label, date, last }: { done: boolean; color: string; label: string; date: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: done ? color : "#e5e7eb", border: `2px solid ${done ? color : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {done && <Check size={9} color="#fff" strokeWidth={3} />}
        </div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 14, background: done ? color : "#e5e7eb", marginTop: 2, borderRadius: 1, opacity: 0.5 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 10 }}>
        <p style={{ fontSize: 11.5, fontWeight: done ? 600 : 500, color: done ? "#111827" : "#9ca3af", lineHeight: 1.3 }}>{label}</p>
        {date && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{date}</p>}
      </div>
    </div>
  );
}

interface Props {
  currentUser: UserProfile;
  initialTransactions: FinanceTransaction[];
  initialReimbursements: Reimbursement[];
}

export default function FinanceBoard({ currentUser, initialTransactions, initialReimbursements }: Props) {
  const supabase = createClient();

  const isFinanceRole = ["super_admin", "manager", "kep_finance", "staff_finance", "staff_dokumen"].includes(currentUser.role);
  const canManageTrx  = ["kep_finance", "staff_finance", "staff_dokumen"].includes(currentUser.role);
  const canApprove    = ["kep_finance", "manager"].includes(currentUser.role);
  const canPayOut     = ["kep_finance", "manager"].includes(currentUser.role);
  const isViewOnly    = isFinanceRole && !canManageTrx;

  // Non-finance roles always land on reimbursement tab
  const [tab, setTab] = useState<"overview" | "transaksi" | "reimbursement">(isFinanceRole ? "reimbursement" : "reimbursement");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(initialTransactions);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>(initialReimbursements);

  // Transaction state
  const [showTrxModal, setShowTrxModal] = useState(false);
  const [editingTrx, setEditingTrx]     = useState<FinanceTransaction | null>(null);
  const [trxForm, setTrxForm]           = useState(EMPTY_TRX);
  const [deleteTrxId, setDeleteTrxId]   = useState<string | null>(null);
  const [typeFilter, setTypeFilter]     = useState<"all" | "income" | "expense">("all");

  // Reimbursement state
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [reimbRows, setReimbRows]           = useState<ReturnType<typeof newReimbRow>[]>([newReimbRow()]);
  const [reimbStatusFilter, setReimbStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [reimbSearch, setReimbSearch]       = useState("");
  const [fileTargetKey, setFileTargetKey]   = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deleteReimbId, setDeleteReimbId]   = useState<string | null>(null);
  const batchFileRef                        = useRef<HTMLInputElement>(null);

  // Payment proof upload — single item (Ganti Bukti on single-item group)
  const [payProofTarget, setPayProofTarget] = useState<Reimbursement | null>(null);
  // Payment proof upload — group (one proof for all items)
  const [payProofGroupTarget, setPayProofGroupTarget] = useState<{ items: Reimbursement[]; name: string; total: number } | null>(null);
  const [payProofFile, setPayProofFile]     = useState<File | null>(null);
  const [uploadingPayProof, setUploadingPayProof] = useState(false);
  const payProofFileRef                     = useRef<HTMLInputElement>(null);

  // Image expand
  const [expandedImg, setExpandedImg]       = useState<string | null>(null);

  // Group collapse state — collapsed by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Weekly countdown
  const currentWeekKey = getWeekKeyFromDate(new Date().toISOString());
  const [countdown, setCountdown] = useState<string>("");
  const [weekClosed, setWeekClosed] = useState(() => Date.now() >= getWeekDeadline(getWeekKeyFromDate(new Date().toISOString())).getTime());

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const wk  = getWeekKeyFromDate(new Date(now).toISOString());
      const dl  = getWeekDeadline(wk).getTime();
      const diff = dl - now;
      if (diff <= 0) { setWeekClosed(true); setCountdown(""); return; }
      setWeekClosed(false);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}h ${h}j ${m}m` : `${h}j ${m}m ${s}d`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Review
  const [reviewTarget, setReviewTarget] = useState<Reimbursement | null>(null);
  const [reviewNote, setReviewNote]     = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Stats ──
  const totalIncome  = transactions.filter(t => t.type === "income"  && t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense" && t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;
  const activeReimb    = reimbursements.filter(r => !r.is_archived);
  const archivedCount  = reimbursements.filter(r => r.is_archived).length;
  const pendingReimb   = activeReimb.filter(r => r.status === "pending").length;
  const approvedReimbTotal = activeReimb.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);

  const expenseByCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: transactions.filter(t => t.type === "expense" && t.category === cat && t.status === "confirmed").reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // ── Filtered reimbursements ──
  const filteredReimb = reimbursements.filter(r => {
    if (showArchived ? !r.is_archived : r.is_archived) return false;
    if (reimbStatusFilter !== "all" && r.status !== reimbStatusFilter) return false;
    if (reimbSearch && !r.title.toLowerCase().includes(reimbSearch.toLowerCase())) return false;
    return true;
  });

  // ── Group by requester + ISO week (Mon–Sun WIB), most recent first ──
  const reimbGroups = (() => {
    const map = new Map<string, { key: string; requesterId: string; requesterName: string; weekKey: string; items: Reimbursement[] }>();
    for (const r of filteredReimb) {
      const weekKey = getWeekKeyFromDate(r.created_at);
      const gKey    = `${r.requested_by ?? "anon"}_${weekKey}`;
      if (!map.has(gKey)) map.set(gKey, { key: gKey, requesterId: r.requested_by ?? "", requesterName: (r.requester as any)?.full_name ?? "—", weekKey, items: [] });
      map.get(gKey)!.items.push(r);
    }
    return [...map.values()].sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  })();

  // ── CRUD: Transactions ──
  const handleSaveTrx = async () => {
    if (!trxForm.title.trim() || !trxForm.amount) return;
    setSubmitting(true);
    const payload = {
      title: trxForm.title.trim(),
      amount: Number(String(trxForm.amount).replace(/\D/g, "")),
      type: trxForm.type, category: trxForm.category,
      date: trxForm.date, description: trxForm.description.trim() || null,
      status: trxForm.status, created_by: currentUser.id,
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

  // ── CRUD: Reimbursements (batch) ──
  const handleSubmitReimbBatch = async () => {
    const validRows = reimbRows.filter(r => r.title.trim() && r.amount);
    if (validRows.length === 0) return;
    setSubmitting(true);
    const inserted: Reimbursement[] = [];

    for (const row of validRows) {
      let receipt_path: string | null = null;
      if (row.file) {
        setUploadingReceipt(true);
        const ext  = row.file.name.split(".").pop();
        const path = `${currentUser.id}/${storageStamp()}_${row.key.slice(0, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, row.file, { upsert: false, contentType: row.file.type });
        if (upErr) { showToast(`Gagal upload bukti "${row.title}": ${upErr.message}`, false); continue; }
        const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(path);
        receipt_path = publicUrl;
        setUploadingReceipt(false);
      }
      const { data, error } = await supabase.from("reimbursements").insert({
        title:        row.title.trim(),
        amount:       Number(row.amount.replace(/\D/g, "")),
        description:  row.description.trim() || null,
        category:     row.category || null,
        expense_date: row.expense_date || null,
        receipt_path,
        requested_by: currentUser.id,
      }).select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role)").single();
      if (!error && data) inserted.push(data);
    }

    if (inserted.length > 0) {
      setReimbursements(prev => [...inserted.reverse(), ...prev]);
      showToast(`${inserted.length} reimbursement berhasil diajukan`);
      const total = inserted.reduce((s, r) => s + r.amount, 0);
      notifyFinanceNewReimbAction(currentUser.full_name, inserted.length, total);
    }
    setSubmitting(false);
    setUploadingReceipt(false);
    setReimbRows([newReimbRow()]);
    if (batchFileRef.current) batchFileRef.current.value = "";
    setShowReimbModal(false);
  };

  const handleDeleteReimb = async (id: string) => {
    const { error } = await supabase.from("reimbursements").delete().eq("id", id);
    if (error) showToast(error.message, false);
    else { setReimbursements(prev => prev.filter(r => r.id !== id)); showToast("Pengajuan dihapus"); }
    setDeleteReimbId(null);
  };

  const handleReview = async (id: string, status: "approved" | "rejected" | "pending") => {
    if (!canApprove) { showToast("Hanya Kepala Finance atau Manager yang dapat menyetujui reimbursement", false); return; }
    setSubmitting(true);
    const { error } = await reviewReimbursementAction(id, status, reviewNote.trim() || undefined);
    if (error) {
      showToast(error, false);
    } else {
      // Refresh local state: re-fetch the updated row via anon client (read is allowed)
      const { data: updated } = await supabase.from("reimbursements")
        .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role), reviewer:profiles!reimbursements_reviewed_by_fkey(full_name)")
        .eq("id", id).single();
      if (updated) setReimbursements(prev => prev.map(r => r.id === id ? updated : r));
      showToast(status === "approved" ? "Disetujui" : status === "rejected" ? "Ditolak" : "Dikembalikan ke menunggu");
    }
    setSubmitting(false);
    setReviewTarget(null);
    setReviewNote("");
  };

  const handleArchive = async (ids: string[], archived = true) => {
    const { error } = await archiveReimbursementAction(ids, archived);
    if (error) { showToast(error, false); return; }
    setReimbursements(prev => prev.map(r => ids.includes(r.id) ? { ...r, is_archived: archived } : r));
    showToast(archived ? "Diarsipkan" : "Dipindah ke aktif");
  };

  const handlePayProof = async () => {
    if (!payProofTarget || !payProofFile) return;
    setUploadingPayProof(true);
    // Upload file via anon client (storage policy allows authenticated upload)
    const ext  = payProofFile.name.split(".").pop();
    // Path must start with currentUser.id — storage RLS policy: foldername(name)[1] = auth.uid()
    const path = `${currentUser.id}/payment/${payProofTarget.id}/${storageStamp()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, payProofFile, { upsert: true, contentType: payProofFile.type });
    if (upErr) { showToast("Gagal upload bukti bayar: " + upErr.message, false); setUploadingPayProof(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(path);
    // Use server action (admin client) to update DB — bypasses RLS
    const { error } = await uploadPayProofAction(payProofTarget.id, publicUrl);
    if (error) {
      showToast("Gagal upload bukti bayar: " + error, false);
    } else {
      // Re-fetch updated row for local state
      const { data: updated } = await supabase.from("reimbursements")
        .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role), reviewer:profiles!reimbursements_reviewed_by_fkey(full_name)")
        .eq("id", payProofTarget.id).single();
      if (updated) setReimbursements(prev => prev.map(r => r.id === payProofTarget.id ? updated : r));
      showToast("Bukti pembayaran berhasil diupload");
    }
    setUploadingPayProof(false);
    setPayProofTarget(null);
    setPayProofFile(null);
    if (payProofFileRef.current) payProofFileRef.current.value = "";
  };

  const handlePayProofGroup = async () => {
    if (!payProofGroupTarget || !payProofFile) return;
    setUploadingPayProof(true);
    const ext  = payProofFile.name.split(".").pop();
    const path = `${currentUser.id}/payment/grp-${payProofGroupTarget.items[0].id}/${storageStamp()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, payProofFile, { upsert: true, contentType: payProofFile.type });
    if (upErr) { showToast("Gagal upload: " + upErr.message, false); setUploadingPayProof(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(path);
    const ids = payProofGroupTarget.items.map(r => r.id);
    const { error } = await uploadGroupPayProofAction(ids, publicUrl);
    if (error) {
      showToast("Gagal: " + error, false);
    } else {
      const now = new Date().toISOString();
      setReimbursements(prev => prev.map(r => ids.includes(r.id) ? { ...r, payment_proof_url: publicUrl, paid_at: now, paid_by: currentUser.id } : r));
      showToast("Bukti pembayaran berhasil diupload untuk semua item");
      setPayProofGroupTarget(null);
      setPayProofFile(null);
      if (payProofFileRef.current) payProofFileRef.current.value = "";
    }
    setUploadingPayProof(false);
  };

  const filteredTrx = transactions.filter(t => typeFilter === "all" || t.type === typeFilter);

  const TABS = (isFinanceRole ? [
    { key: "overview",      label: "Overview" },
    { key: "transaksi",     label: "Transaksi" },
    { key: "reimbursement", label: `Reimbursement${pendingReimb > 0 ? ` (${pendingReimb})` : ""}` },
  ] : [
    { key: "reimbursement", label: "Reimbursement Saya" },
  ]) as { key: "overview" | "transaksi" | "reimbursement"; label: string }[];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #047857)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
            <Wallet size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Finance</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              {!isFinanceRole ? "Ajukan reimbursement pengeluaran" : isViewOnly ? "Mode lihat saja" : "Manajemen keuangan"}
              {canApprove && pendingReimb > 0 && <span style={{ marginLeft: 6, color: "#f59e0b", fontWeight: 600 }}>· {pendingReimb} menunggu review</span>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageTrx && tab === "transaksi" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingTrx(null); setTrxForm(EMPTY_TRX); setShowTrxModal(true); }}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg, #10b981, #047857)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}>
              <Plus size={15} /> Tambah Transaksi
            </motion.button>
          )}
          {tab === "reimbursement" && (
            <motion.button
              whileHover={{ scale: weekClosed ? 1 : 1.02 }} whileTap={{ scale: weekClosed ? 1 : 0.97 }}
              onClick={() => { if (weekClosed) { showToast("Periode minggu ini sudah tutup. Dibuka kembali Senin mendatang.", false); return; } setReimbRows([newReimbRow()]); setShowReimbModal(true); }}
              style={{ display: "flex", alignItems: "center", gap: 7, background: weekClosed ? "#e5e7eb" : "linear-gradient(135deg, #6366f1, #4f46e5)", color: weekClosed ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: weekClosed ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, boxShadow: weekClosed ? "none" : "0 4px 14px rgba(99,102,241,0.35)" }}>
              <Plus size={15} /> Ajukan Reimbursement
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px", display: "flex", gap: 4, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? "#10b981" : "#6b7280", borderBottom: tab === t.key ? "2px solid #10b981" : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="board-main" style={{ flex: 1, overflow: "auto" }}>
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW TAB ── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { label: "Total Pemasukan",   val: fmtRupiah(totalIncome),  icon: <ArrowUpRight size={18} />,   color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
                  { label: "Total Pengeluaran", val: fmtRupiah(totalExpense), icon: <ArrowDownRight size={18} />, color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
                  { label: "Saldo Bersih",      val: fmtRupiah(balance),      icon: <DollarSign size={18} />,    color: balance >= 0 ? "#10b981" : "#ef4444", bg: balance >= 0 ? "#f0fdf4" : "#fef2f2", border: balance >= 0 ? "#d1fae5" : "#fecaca" },
                  { label: "Reimb. Pending",    val: `${pendingReimb} pengajuan`, icon: <Clock size={18} />,     color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
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
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                              style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #047857)", borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 24px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Transaksi Terbaru</h3>
                {transactions.slice(0, 8).length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Belum ada transaksi</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {transactions.slice(0, 8).map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: t.type === "income" ? "#f0fdf4" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {t.type === "income" ? <ArrowUpRight size={15} color="#10b981" /> : <ArrowDownRight size={15} color="#ef4444" />}
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

          {/* ── TRANSAKSI TAB ── */}
          {tab === "transaksi" && (
            <motion.div key="transaksi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "all", label: "Semua" }, { key: "income", label: "Pemasukan" }, { key: "expense", label: "Pengeluaran" }].map(f => (
                  <motion.button key={f.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setTypeFilter(f.key as any)}
                    style={{ padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600, border: typeFilter === f.key ? "1.5px solid #10b981" : "1.5px solid #e5e7eb", background: typeFilter === f.key ? "#f0fdf4" : "#fff", color: typeFilter === f.key ? "#059669" : "#6b7280", transition: "all 0.15s" }}>
                    {f.label}
                  </motion.button>
                ))}
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px", padding: "11px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                  {["Transaksi", "Tipe", "Kategori", "Tanggal", "Jumlah", "Aksi"].map(h => (
                    <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</p>
                  ))}
                </div>
                {filteredTrx.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}><p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada transaksi</p></div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredTrx.map((t, i) => (
                      <motion.div key={t.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                        style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px", padding: "14px 20px", alignItems: "center", borderBottom: "1px solid #f9fafb" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.title}</p>
                          {t.description && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{t.description}</p>}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: t.type === "income" ? "#f0fdf4" : "#fef2f2", color: t.type === "income" ? "#059669" : "#dc2626" }}>
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
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

          {/* ── REIMBURSEMENT TAB ── */}
          {tab === "reimbursement" && (
            <motion.div key="reimbursement" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Weekly deadline countdown */}
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  background: weekClosed ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : "linear-gradient(135deg, #eef2ff, #e0e7ff)",
                  border: `1.5px solid ${weekClosed ? "#fecaca" : "#c7d2fe"}`, borderRadius: 12,
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: weekClosed ? "#ef4444" : "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={16} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: weekClosed ? "#991b1b" : "#3730a3" }}>
                    {weekClosed ? "Periode Minggu Ini Sudah Tutup" : `Periode: ${getWeekLabel(currentWeekKey)}`}
                  </p>
                  <p style={{ fontSize: 12, color: weekClosed ? "#b91c1c" : "#4f46e5", marginTop: 2 }}>
                    {weekClosed
                      ? "Pengajuan reimbursement dibuka kembali Senin mendatang."
                      : `Tutup: ${getSundayStr(currentWeekKey)} pukul 17.00 WIB`}
                  </p>
                </div>
                {!weekClosed && countdown && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 10, color: "#6366f1", fontWeight: 600, marginBottom: 2, opacity: 0.7 }}>sisa waktu</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#4f46e5", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                      {countdown}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Notification banner for kep_finance when there are pending reimbs */}
              {currentUser.role === "kep_finance" && pendingReimb > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
                    border: "1.5px solid #fde68a", borderRadius: 12,
                    padding: "13px 18px",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Receipt size={17} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                      {pendingReimb} Reimbursement Menunggu Review Anda
                    </p>
                    <p style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>
                      Sebagai Kepala Finance, Anda perlu meninjau dan menyetujui atau menolak pengajuan ini.
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#d97706" }}>{pendingReimb}</span>
                  </div>
                </motion.div>
              )}

              {/* Info banner for non-finance roles */}
              {!isFinanceRole && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 10 }}>
                  <CheckCircle size={15} color="#059669" />
                  <p style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}>
                    Pengajuan reimbursement Anda akan diteruskan ke Kepala Finance untuk ditinjau.
                  </p>
                </div>
              )}

              {/* Info banner for finance roles that can't approve */}
              {isFinanceRole && !canApprove && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 500 }}>
                    Persetujuan reimbursement hanya dapat dilakukan oleh <strong>Kepala Finance</strong> atau <strong>Manager</strong>.
                  </p>
                </div>
              )}

              {/* Stats bar — for all finance roles */}
              {isFinanceRole && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Menunggu Review", value: reimbursements.filter(r => r.status === "pending").length, suffix: "pengajuan", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
                    { label: "Total Disetujui",  value: fmtRupiah(approvedReimbTotal),           suffix: "",           color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
                    { label: "Ditolak",          value: reimbursements.filter(r => r.status === "rejected").length, suffix: "pengajuan", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                  ].map(s => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: "#fff", border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 18px" }}>
                      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 6 }}>{s.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>
                        {s.value}{s.suffix && <span style={{ fontSize: 12, fontWeight: 500, color: s.color, marginLeft: 4 }}>{s.suffix}</span>}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Filter + Search bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Status filter pills */}
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { key: "all",      label: "Semua",    count: (showArchived ? reimbursements.filter(r => r.is_archived) : activeReimb).length },
                    { key: "pending",  label: "Menunggu", count: (showArchived ? reimbursements.filter(r => r.is_archived) : activeReimb).filter(r => r.status === "pending").length },
                    { key: "approved", label: "Disetujui",count: (showArchived ? reimbursements.filter(r => r.is_archived) : activeReimb).filter(r => r.status === "approved").length },
                    { key: "rejected", label: "Ditolak",  count: (showArchived ? reimbursements.filter(r => r.is_archived) : activeReimb).filter(r => r.status === "rejected").length },
                  ] as const).map(f => (
                    <motion.button key={f.key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setReimbStatusFilter(f.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "6px 13px", borderRadius: 20, cursor: "pointer",
                        fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                        border: reimbStatusFilter === f.key ? "1.5px solid #6366f1" : "1.5px solid #e5e7eb",
                        background: reimbStatusFilter === f.key ? "#eef2ff" : "#fff",
                        color: reimbStatusFilter === f.key ? "#4f46e5" : "#6b7280",
                      }}>
                      {f.label}
                      <span style={{ fontSize: 10, fontWeight: 700, background: reimbStatusFilter === f.key ? "#6366f1" : "#f3f4f6", color: reimbStatusFilter === f.key ? "#fff" : "#9ca3af", borderRadius: 20, padding: "1px 6px" }}>
                        {f.count}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {/* Arsip toggle + Search */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowArchived(v => !v); setReimbStatusFilter("all"); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                      fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                      border: showArchived ? "1.5px solid #d97706" : "1.5px solid #e5e7eb",
                      background: showArchived ? "#fffbeb" : "#fff",
                      color: showArchived ? "#d97706" : "#9ca3af",
                    }}
                  >
                    <Archive size={12} />
                    Arsip
                    {archivedCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: showArchived ? "#d97706" : "#f3f4f6", color: showArchived ? "#fff" : "#9ca3af", borderRadius: 20, padding: "1px 6px" }}>
                        {archivedCount}
                      </span>
                    )}
                  </motion.button>
                  <div style={{ position: "relative" }}>
                    <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      value={reimbSearch} onChange={e => setReimbSearch(e.target.value)}
                      placeholder="Cari reimbursement..."
                      style={{ padding: "7px 12px 7px 30px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 12, color: "#111827", background: "#fff", outline: "none", width: 200 }}
                    />
                  </div>
                </div>
              </div>

              {/* Card list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredReimb.length === 0 ? (
                  <div style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
                    <Receipt size={40} style={{ color: "#e5e7eb", margin: "0 auto 14px" }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                      {showArchived ? "Belum ada arsip" : reimbSearch || reimbStatusFilter !== "all" ? "Tidak ada yang cocok" : "Belum ada pengajuan reimbursement"}
                    </p>
                    {!reimbSearch && reimbStatusFilter === "all" && !weekClosed && !showArchived && (
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { setReimbRows([newReimbRow()]); setShowReimbModal(true); }}
                        style={{ marginTop: 18, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                        Ajukan Sekarang
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {reimbGroups.map((group, gi) => {
                      const isOwn = group.requesterId === currentUser.id;

                      /* ── Unified rendering (single & multi) ── */
                      const isSingle   = group.items.length === 1;
                      const singleItem = isSingle ? group.items[0] : null;
                      const singleSt   = singleItem ? STATUS_REIMB[singleItem.status] : null;
                      const singleIsPaid    = singleItem ? !!singleItem.paid_at : false;
                      const singleReviewer  = singleItem ? (singleItem.reviewer as any)?.full_name || null : null;

                      const totalAmt   = group.items.reduce((s, r) => s + r.amount, 0);
                      const pendingCnt = group.items.filter(r => r.status === "pending").length;
                      const approvCnt  = group.items.filter(r => r.status === "approved").length;
                      const rejectCnt  = group.items.filter(r => r.status === "rejected").length;
                      const isExpanded = isSingle || expandedGroups.has(group.key);

                      return (
                        <motion.div key={group.key} layout
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ delay: gi * 0.04 }}
                          style={{ background: "#fff", border: "1px solid #e0e7ff", borderLeft: "3px solid #6366f1", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

                          {/* Header */}
                          <div onClick={() => !isSingle && toggleGroup(group.key)}
                            style={{ padding: "14px 20px", cursor: isSingle ? "default" : "pointer", userSelect: "none" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                                {isSingle ? (
                                  <>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: singleSt!.bg, color: singleSt!.color, border: `1px solid ${singleSt!.border}` }}>
                                      {singleSt!.icon} {singleSt!.label}
                                    </span>
                                    {singleItem!.category && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280" }}>
                                        <Tag size={9} /> {singleItem!.category}
                                      </span>
                                    )}
                                    {singleIsPaid && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#f0fdf4", color: "#059669", border: "1px solid #a7f3d0" }}>
                                        <Banknote size={10} /> Sudah Dibayar
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                                      {group.items.length} Reimbursement
                                    </span>
                                    {pendingCnt > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>{pendingCnt} menunggu</span>}
                                    {approvCnt  > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#f0fdf4", color: "#059669", border: "1px solid #a7f3d0" }}>{approvCnt} disetujui</span>}
                                    {rejectCnt  > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{rejectCnt} ditolak</span>}
                                  </>
                                )}
                                {isOwn && <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "2px 7px" }}>Milikmu</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                <p style={{ fontSize: 15, fontWeight: 800, color: isSingle ? (singleItem!.status === "approved" ? "#059669" : singleItem!.status === "rejected" ? "#9ca3af" : "#111827") : "#111827", letterSpacing: "-0.02em", lineHeight: 1 }}>
                                  {fmtRupiah(totalAmt)}
                                </p>
                                {!isSingle && (
                                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown size={16} color="#9ca3af" />
                                  </motion.div>
                                )}
                              </div>
                            </div>
                            {isSingle && (
                              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.35, marginTop: 5 }}>{singleItem!.title}</p>
                            )}
                            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: isSingle ? 3 : 5 }}>
                              {group.requesterName} · Minggu {getWeekLabel(group.weekKey)}
                            </p>
                          </div>

                          {/* Body */}
                          {isSingle ? (
                            /* Single-item: always visible, rich detail */
                            <div>
                              <div style={{ padding: "0 20px 14px" }}>
                                {singleItem!.description && (
                                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55, marginBottom: 10 }}>{singleItem!.description}</p>
                                )}
                                {singleItem!.review_note && (
                                  <div style={{ marginBottom: 10, padding: "8px 11px", background: singleItem!.status === "approved" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${singleItem!.status === "approved" ? "#a7f3d0" : "#fecaca"}`, borderRadius: 8, fontSize: 11.5, color: singleItem!.status === "approved" ? "#059669" : "#dc2626", lineHeight: 1.5 }}>
                                    <strong>Catatan{singleReviewer ? ` dari ${singleReviewer}` : ""}:</strong> {singleItem!.review_note}
                                  </div>
                                )}
                                {(singleItem!.receipt_path || singleItem!.payment_proof_url) && (
                                  <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {singleItem!.receipt_path && (
                                      <div>
                                        {isImg(singleItem!.receipt_path) ? (
                                          <>
                                            <button onClick={() => setExpandedImg(expandedImg === singleItem!.receipt_path ? null : singleItem!.receipt_path!)}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                                              <ImageIcon size={11} color="#6366f1" /> Bukti Pengajuan
                                              {expandedImg === singleItem!.receipt_path ? <ChevronUp size={10} color="#9ca3af" /> : <ChevronDown size={10} color="#9ca3af" />}
                                            </button>
                                            {expandedImg === singleItem!.receipt_path && (
                                              <div style={{ marginTop: 6, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", maxWidth: 280 }}>
                                                <img src={singleItem!.receipt_path} alt="Bukti" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block", background: "#f9fafb" }} />
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <a href={singleItem!.receipt_path} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 11, fontWeight: 600, color: "#374151", textDecoration: "none" }}>
                                            <FileText size={11} color="#6366f1" /> Bukti Pengajuan (PDF)
                                          </a>
                                        )}
                                      </div>
                                    )}
                                    {singleItem!.payment_proof_url && (
                                      <div>
                                        {isImg(singleItem!.payment_proof_url) ? (
                                          <>
                                            <button onClick={() => setExpandedImg(expandedImg === singleItem!.payment_proof_url ? null : singleItem!.payment_proof_url!)}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid #a7f3d0", background: "#f0fdf4", fontSize: 11, fontWeight: 600, color: "#059669", cursor: "pointer" }}>
                                              <ImageIcon size={11} color="#10b981" /> Bukti Pembayaran
                                              {expandedImg === singleItem!.payment_proof_url ? <ChevronUp size={10} color="#9ca3af" /> : <ChevronDown size={10} color="#9ca3af" />}
                                            </button>
                                            {expandedImg === singleItem!.payment_proof_url && (
                                              <div style={{ marginTop: 6, borderRadius: 8, overflow: "hidden", border: "1px solid #a7f3d0", maxWidth: 280 }}>
                                                <img src={singleItem!.payment_proof_url} alt="Bukti Bayar" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block", background: "#f0fdf4" }} />
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <a href={singleItem!.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid #a7f3d0", background: "#f0fdf4", fontSize: 11, fontWeight: 600, color: "#059669", textDecoration: "none" }}>
                                            <FileText size={11} color="#10b981" /> Bukti Pembayaran (PDF)
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                                  <TimelineStep done color="#6366f1" label={`Diajukan oleh ${group.requesterName}`} date={fmtDate(singleItem!.created_at)} last={singleItem!.status === "pending" && !singleItem!.reviewed_at} />
                                  {singleItem!.status !== "pending" && (
                                    <TimelineStep done color={singleItem!.status === "approved" ? "#10b981" : "#ef4444"}
                                      label={singleItem!.status === "approved" ? `Disetujui${singleReviewer ? ` oleh ${singleReviewer}` : ""}` : `Ditolak${singleReviewer ? ` oleh ${singleReviewer}` : ""}`}
                                      date={singleItem!.reviewed_at ? fmtDate(singleItem!.reviewed_at) : ""}
                                      last={singleItem!.status !== "approved" || singleIsPaid} />
                                  )}
                                  {singleItem!.status === "approved" && (
                                    <TimelineStep done={singleIsPaid} color="#10b981"
                                      label={singleIsPaid ? "Sudah Dibayar" : "Menunggu Pembayaran"}
                                      date={singleItem!.paid_at ? fmtDate(singleItem!.paid_at) : ""} last />
                                  )}
                                </div>
                              </div>
                              {/* Single footer with actions */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 20px", borderTop: "1px solid #f3f4f6", background: "#fafafa", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                  {singleItem!.expense_date && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                      <CalendarDays size={10} /> Tgl pengeluaran: <strong style={{ color: "#374151" }}>{fmtDateShort(singleItem!.expense_date)}</strong>
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {canApprove && singleItem!.status === "pending" && (
                                    <motion.button whileHover={{ background: "#ede9fe" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => { setReviewTarget(singleItem!); setReviewNote(""); }}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", border: "1px solid #c4b5fd", borderRadius: 7, background: "#f5f3ff", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#6d28d9", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <Eye size={11} /> Review
                                    </motion.button>
                                  )}
                                  {canApprove && singleItem!.status !== "pending" && !singleIsPaid && (
                                    <motion.button whileHover={{ background: "#fffbeb" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => handleReview(singleItem!.id, "pending")}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #fde68a", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#d97706", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <RotateCcw size={11} /> Tinjau Ulang
                                    </motion.button>
                                  )}
                                  {canPayOut && singleItem!.status === "approved" && !singleIsPaid && (
                                    <motion.button whileHover={{ background: "#f0fdf4" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => { setPayProofTarget(singleItem!); setPayProofFile(null); }}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", border: "1px solid #a7f3d0", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#059669", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <Upload size={11} /> Bukti Bayar
                                    </motion.button>
                                  )}
                                  {canPayOut && singleIsPaid && (
                                    <motion.button whileHover={{ background: "#fffbeb" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => { setPayProofTarget(singleItem!); setPayProofFile(null); }}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", border: "1px solid #fbbf24", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#d97706", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <RotateCcw size={11} /> Ganti Bukti
                                    </motion.button>
                                  )}
                                  {isOwn && singleItem!.status === "pending" && (
                                    <motion.button whileHover={{ background: "#fef2f2" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => setDeleteReimbId(singleItem!.id)}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #fecaca", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#dc2626", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <Trash2 size={11} /> Batalkan
                                    </motion.button>
                                  )}
                                  {canApprove && singleItem!.status !== "pending" && !showArchived && (
                                    <motion.button whileHover={{ background: "#fffbeb" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => handleArchive([singleItem!.id])}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #fde68a", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#d97706", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <Archive size={11} /> Arsipkan
                                    </motion.button>
                                  )}
                                  {canApprove && showArchived && (
                                    <motion.button whileHover={{ background: "#f0fdf4" }} whileTap={{ scale: 0.97 }}
                                      onClick={() => handleArchive([singleItem!.id], false)}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #a7f3d0", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#059669", whiteSpace: "nowrap", transition: "background 0.12s" }}>
                                      <Archive size={11} /> Buka Arsip
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Multi-item: collapsible body */
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  key="body"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                  style={{ overflow: "hidden" }}>
                                  <div style={{ padding: "0 20px 14px" }}>
                                    <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #f0f0f0", overflow: "hidden" }}>
                                      {group.items.map((item, idx) => {
                                        const st       = STATUS_REIMB[item.status];
                                        const isPaid   = !!item.paid_at;
                                        const reviewer = (item.reviewer as any)?.full_name || null;
                                        return (
                                          <div key={item.id}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: idx % 2 === 0 ? "#f9fafb" : "#fff", borderTop: idx > 0 ? "1px solid #f0f0f0" : "none" }}>
                                              <span style={{ fontSize: 11, fontWeight: 700, color: "#d1d5db", flexShrink: 0, minWidth: 16, textAlign: "right" }}>{idx + 1}.</span>
                                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}`, flexShrink: 0, whiteSpace: "nowrap" }}>
                                                {st.icon} {st.label}
                                              </span>
                                              <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                                                {item.category && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{item.category}</p>}
                                              </div>
                                              <span style={{ fontSize: 12, fontWeight: 700, color: item.status === "approved" ? "#059669" : item.status === "rejected" ? "#9ca3af" : "#374151", flexShrink: 0, letterSpacing: "-0.02em" }}>
                                                {fmtRupiah(item.amount)}
                                              </span>
                                              <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                                                {item.receipt_path && (
                                                  isImg(item.receipt_path) ? (
                                                    <button onClick={() => setExpandedImg(expandedImg === item.receipt_path ? null : item.receipt_path!)}
                                                      title="Lihat Bukti"
                                                      style={{ display: "inline-flex", alignItems: "center", padding: "3px 6px", borderRadius: 5, border: "1px solid #e5e7eb", background: expandedImg === item.receipt_path ? "#eef2ff" : "#fff", cursor: "pointer" }}>
                                                      <ImageIcon size={10} color="#6366f1" />
                                                    </button>
                                                  ) : (
                                                    <a href={item.receipt_path} target="_blank" rel="noopener noreferrer" title="Buka PDF"
                                                      style={{ display: "inline-flex", alignItems: "center", padding: "3px 6px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff" }}>
                                                      <FileText size={10} color="#6366f1" />
                                                    </a>
                                                  )
                                                )}
                                                {canApprove && item.status === "pending" && (
                                                  <button onClick={() => { setReviewTarget(item); setReviewNote(""); }}
                                                    style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", border: "1px solid #c4b5fd", borderRadius: 5, background: "#f5f3ff", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#6d28d9" }}>
                                                    <Eye size={9} /> Review
                                                  </button>
                                                )}
                                                {canApprove && item.status !== "pending" && !isPaid && (
                                                  <button onClick={() => handleReview(item.id, "pending")} title="Tinjau Ulang"
                                                    style={{ display: "inline-flex", alignItems: "center", padding: "3px 6px", border: "1px solid #fde68a", borderRadius: 5, background: "#fff", cursor: "pointer" }}>
                                                    <RotateCcw size={9} color="#d97706" />
                                                  </button>
                                                )}
                                                {isOwn && item.status === "pending" && (
                                                  <button onClick={() => setDeleteReimbId(item.id)} title="Batalkan"
                                                    style={{ display: "inline-flex", alignItems: "center", padding: "3px 6px", border: "1px solid #fecaca", borderRadius: 5, background: "#fff", cursor: "pointer" }}>
                                                    <Trash2 size={9} color="#dc2626" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                            {expandedImg === item.receipt_path && item.receipt_path && (
                                              <div style={{ padding: "0 12px 10px", background: idx % 2 === 0 ? "#f9fafb" : "#fff" }}>
                                                <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", maxWidth: 260 }}>
                                                  <img src={item.receipt_path} alt="Bukti" style={{ width: "100%", maxHeight: 160, objectFit: "contain", display: "block", background: "#f9fafb" }} />
                                                </div>
                                              </div>
                                            )}
                                            {item.review_note && (
                                              <div style={{ margin: "0 12px 8px", padding: "6px 10px", background: item.status === "approved" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${item.status === "approved" ? "#a7f3d0" : "#fecaca"}`, borderRadius: 7, fontSize: 11, color: item.status === "approved" ? "#059669" : "#dc2626" }}>
                                                <strong>Catatan{reviewer ? ` dari ${reviewer}` : ""}:</strong> {item.review_note}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                                      <TimelineStep done color="#6366f1" label={`Diajukan oleh ${group.requesterName}`} date={fmtDate(group.items[0].created_at)} last />
                                    </div>
                                  </div>
                                  {/* Group-level payment proof footer */}
                                  {(() => {
                                    const groupPaid    = group.items.every(r => !!r.paid_at);
                                    const allApproved  = group.items.every(r => r.status === "approved");
                                    const anyApproved  = group.items.some(r => r.status === "approved" && !r.paid_at);
                                    const groupProofUrl = group.items.find(r => !!r.payment_proof_url)?.payment_proof_url ?? null;
                                    return (
                                      <div style={{ padding: "10px 20px", borderTop: "1px solid #f3f4f6", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                          {group.items.length} item · Total {fmtRupiah(totalAmt)}
                                          {groupPaid && <span style={{ marginLeft: 6, color: "#10b981", fontWeight: 600 }}>· Sudah Dibayar</span>}
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          {/* View group proof */}
                                          {groupProofUrl && (
                                            isImg(groupProofUrl) ? (
                                              <button onClick={() => setExpandedImg(expandedImg === groupProofUrl ? null : groupProofUrl)}
                                                title="Lihat Bukti Bayar"
                                                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #a7f3d0", background: expandedImg === groupProofUrl ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#059669" }}>
                                                <ImageIcon size={10} /> Bukti Bayar
                                              </button>
                                            ) : (
                                              <a href={groupProofUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #a7f3d0", background: "#fff", fontSize: 10, fontWeight: 600, color: "#059669", textDecoration: "none" }}>
                                                <FileText size={10} /> Bukti Bayar
                                              </a>
                                            )
                                          )}
                                          {/* Upload group proof — all approved, not yet paid */}
                                          {canPayOut && allApproved && anyApproved && (
                                            <button onClick={() => { setPayProofGroupTarget({ items: group.items, name: group.requesterName, total: totalAmt }); setPayProofFile(null); }}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid #a7f3d0", background: "#f0fdf4", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#059669" }}>
                                              <Upload size={10} /> Upload Bukti Bayar
                                            </button>
                                          )}
                                          {/* Ganti group proof — already paid */}
                                          {canPayOut && groupPaid && (
                                            <button onClick={() => { setPayProofGroupTarget({ items: group.items, name: group.requesterName, total: totalAmt }); setPayProofFile(null); }}
                                              title="Ganti Bukti Bayar"
                                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid #fbbf24", background: "#fffbeb", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#d97706" }}>
                                              <RotateCcw size={10} /> Ganti Bukti
                                            </button>
                                          )}
                                          {/* Arsipkan grup — semua selesai (tidak ada yang pending) */}
                                          {canApprove && pendingCnt === 0 && !showArchived && (
                                            <button onClick={() => handleArchive(group.items.map(r => r.id))}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid #fde68a", background: "#fffbeb", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#d97706" }}>
                                              <Archive size={10} /> Arsipkan
                                            </button>
                                          )}
                                          {canApprove && showArchived && (
                                            <button onClick={() => handleArchive(group.items.map(r => r.id), false)}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid #a7f3d0", background: "#f0fdf4", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#059669" }}>
                                              <Archive size={10} /> Buka Arsip
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {/* Expanded group proof image */}
                                  {(() => {
                                    const groupProofUrl = group.items.find(r => !!r.payment_proof_url)?.payment_proof_url ?? null;
                                    return groupProofUrl && expandedImg === groupProofUrl && isImg(groupProofUrl) ? (
                                      <div style={{ padding: "0 20px 12px", background: "#fafafa" }}>
                                        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #a7f3d0", maxWidth: 300 }}>
                                          <img src={groupProofUrl} alt="Bukti Bayar" style={{ width: "100%", maxHeight: 180, objectFit: "contain", display: "block", background: "#f0fdf4" }} />
                                        </div>
                                      </div>
                                    ) : null;
                                  })()}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ══════════ MODALS ══════════ */}

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
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}><X size={16} color="#6b7280" /></motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 0, border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  {[["income", "Pemasukan", "#10b981"], ["expense", "Pengeluaran", "#ef4444"]].map(([k, label, color]) => (
                    <button key={k} onClick={() => setTrxForm(f => ({ ...f, type: k as any, category: k === "income" ? "Pembayaran Klien" : "Operasional" }))}
                      style={{ flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: trxForm.type === k ? color : "#fff", color: trxForm.type === k ? "#fff" : "#9ca3af", transition: "all 0.15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Keterangan *</label>
                  <input type="text" placeholder="Nama transaksi..." value={trxForm.title}
                    onChange={e => setTrxForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Jumlah (Rp) *</label>
                  <input type="text" placeholder="0" value={trxForm.amount}
                    onChange={e => setTrxForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, "") }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  {trxForm.amount && <p style={{ fontSize: 11, color: "#10b981", marginTop: 3 }}>{fmtRupiah(Number(trxForm.amount))}</p>}
                </div>
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
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan</label>
                  <textarea rows={2} placeholder="Keterangan tambahan..." value={trxForm.description}
                    onChange={e => setTrxForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#10b981")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSaveTrx}
                  disabled={submitting || !trxForm.title.trim() || !trxForm.amount}
                  style={{ width: "100%", padding: "12px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", background: submitting || !trxForm.title.trim() || !trxForm.amount ? "#d1d5db" : "linear-gradient(135deg, #10b981, #047857)", color: "#fff", transition: "all 0.2s" }}>
                  {submitting ? "Menyimpan..." : editingTrx ? "Perbarui" : "Simpan Transaksi"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reimb Modal — tabel multi-baris */}
      <AnimatePresence>
        {showReimbModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
            onClick={e => { if (e.target === e.currentTarget) setShowReimbModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 860, boxShadow: "0 25px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Ajukan Reimbursement</h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Isi satu atau beberapa pengeluaran sekaligus, lalu submit bersama</p>
                </div>
                <button onClick={() => setShowReimbModal(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#9ca3af" />
                </button>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 28 }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 32 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                      {["#", "Keperluan *", "Jumlah (Rp) *", "Kategori", "Tgl Keluar", "Keterangan", "Bukti", ""].map(h => (
                        <th key={h} style={{ padding: "6px 6px 8px", fontSize: 11, fontWeight: 700, color: "#6b7280", textAlign: "left", letterSpacing: "0.03em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reimbRows.map((row, i) => (
                      <tr key={row.key} style={{ borderBottom: "1px solid #f9fafb" }}>
                        {/* No */}
                        <td style={{ padding: "6px 6px", fontSize: 12, color: "#9ca3af", fontWeight: 600, textAlign: "center" }}>{i + 1}</td>
                        {/* Keperluan */}
                        <td style={{ padding: "5px 4px" }}>
                          <input type="text" placeholder="Nama pengeluaran..." value={row.title}
                            onChange={e => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, title: e.target.value } : r))}
                            style={{ width: "100%", padding: "7px 9px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                        </td>
                        {/* Jumlah */}
                        <td style={{ padding: "5px 4px" }}>
                          <input type="text" placeholder="0" value={row.amount}
                            onChange={e => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, amount: e.target.value.replace(/\D/g, "") } : r))}
                            style={{ width: "100%", padding: "7px 9px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                          {row.amount && <p style={{ fontSize: 10, color: "#6366f1", marginTop: 1, paddingLeft: 9 }}>{fmtRupiah(Number(row.amount))}</p>}
                        </td>
                        {/* Kategori */}
                        <td style={{ padding: "5px 4px" }}>
                          <select value={row.category} onChange={e => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, category: e.target.value } : r))}
                            style={{ width: "100%", padding: "7px 6px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                            {REIMB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        {/* Tanggal */}
                        <td style={{ padding: "5px 4px" }}>
                          <input type="date" value={row.expense_date}
                            onChange={e => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, expense_date: e.target.value } : r))}
                            style={{ width: "100%", padding: "7px 6px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 11, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                        </td>
                        {/* Keterangan */}
                        <td style={{ padding: "5px 4px" }}>
                          <input type="text" placeholder="Opsional..." value={row.description}
                            onChange={e => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, description: e.target.value } : r))}
                            style={{ width: "100%", padding: "7px 9px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                        </td>
                        {/* Bukti */}
                        <td style={{ padding: "5px 4px" }}>
                          {row.file ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 7 }}>
                              <Paperclip size={11} color="#10b981" />
                              <span style={{ fontSize: 10, color: "#059669", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.file.name}</span>
                              <button onClick={() => setReimbRows(rows => rows.map(r => r.key === row.key ? { ...r, file: null } : r))}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                                <X size={11} color="#9ca3af" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setFileTargetKey(row.key); setTimeout(() => batchFileRef.current?.click(), 0); }}
                              style={{ width: "100%", padding: "6px 4px", border: "1.5px dashed #c4b5fd", borderRadius: 7, background: "#faf5ff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <Upload size={11} /> Upload
                            </button>
                          )}
                        </td>
                        {/* Hapus baris */}
                        <td style={{ padding: "5px 4px", textAlign: "center" }}>
                          {reimbRows.length > 1 && (
                            <button onClick={() => setReimbRows(rows => rows.filter(r => r.key !== row.key))}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex", borderRadius: 6 }}>
                              <Trash2 size={13} color="#d1d5db" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Hidden file input */}
                <input ref={batchFileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: "none" }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && fileTargetKey) {
                      setReimbRows(rows => rows.map(r => r.key === fileTargetKey ? { ...r, file: f } : r));
                      setFileTargetKey(null);
                    }
                    e.target.value = "";
                  }} />
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
                {/* Tambah baris + total */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <button onClick={() => setReimbRows(rows => [...rows, newReimbRow()])}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", border: "1.5px dashed #c4b5fd", borderRadius: 8, background: "#faf5ff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#6366f1" }}>
                    <Plus size={13} /> Tambah Baris
                  </button>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>{reimbRows.filter(r => r.title.trim() && r.amount).length} item valid</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
                      Total: {fmtRupiah(reimbRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                    </p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitReimbBatch}
                  disabled={submitting || reimbRows.filter(r => r.title.trim() && r.amount).length === 0}
                  style={{ width: "100%", padding: "13px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", background: reimbRows.filter(r => r.title.trim() && r.amount).length === 0 ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {submitting
                    ? <><Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} /> {uploadingReceipt ? "Mengupload bukti..." : "Mengajukan..."}</>
                    : `Ajukan ${reimbRows.filter(r => r.title.trim() && r.amount).length || ""} Reimbursement`
                  }
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
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{reviewTarget.title} — <strong style={{ color: "#10b981" }}>{fmtRupiah(reviewTarget.amount)}</strong></p>
                {reviewTarget.category && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Kategori: {reviewTarget.category}</p>}
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {reviewTarget.receipt_path && (
                  <div>
                    {isImg(reviewTarget.receipt_path) ? (
                      <>
                        <button onClick={() => setExpandedImg(expandedImg === reviewTarget.receipt_path ? null : reviewTarget.receipt_path!)}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#6d28d9", cursor: "pointer" }}>
                          <Paperclip size={14} /> Lihat Bukti yang Dilampirkan
                          {expandedImg === reviewTarget.receipt_path ? <ChevronUp size={12} style={{ marginLeft: "auto" }} color="#9ca3af" /> : <ChevronDown size={12} style={{ marginLeft: "auto" }} color="#9ca3af" />}
                        </button>
                        {expandedImg === reviewTarget.receipt_path && (
                          <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: "1px solid #c4b5fd" }}>
                            <img src={reviewTarget.receipt_path} alt="Bukti" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block", background: "#fafafa" }} />
                          </div>
                        )}
                      </>
                    ) : (
                      <a href={reviewTarget.receipt_path} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#6d28d9", textDecoration: "none" }}>
                        <Paperclip size={14} /> Lihat Bukti yang Dilampirkan <ExternalLink size={11} color="#9ca3af" style={{ marginLeft: "auto" }} />
                      </a>
                    )}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Catatan (opsional)</label>
                  <textarea rows={3} placeholder="Alasan persetujuan atau penolakan..." value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }} />
                </div>
                {canApprove ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleReview(reviewTarget.id, "rejected")} disabled={submitting}
                      style={{ flex: 1, minWidth: 90, padding: "11px", border: "1.5px solid #fecaca", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <XCircle size={15} /> Tolak
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02, background: "#fffbeb" }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleReview(reviewTarget.id, "pending")} disabled={submitting}
                      style={{ flex: 1, minWidth: 90, padding: "11px", border: "1.5px solid #fde68a", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <RotateCcw size={14} /> Tunda
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleReview(reviewTarget.id, "approved")} disabled={submitting}
                      style={{ flex: 1, minWidth: 90, padding: "11px", border: "none", borderRadius: 11, background: "linear-gradient(135deg, #10b981, #047857)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <CheckCircle size={15} /> Setujui
                    </motion.button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 11 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                      Hanya Kepala Finance yang dapat menyetujui atau menolak reimbursement.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Proof Upload Modal */}
      <AnimatePresence>
        {payProofTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) { setPayProofTarget(null); setPayProofFile(null); } }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Upload Bukti Pembayaran</h2>
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{payProofTarget.title} — <strong style={{ color: "#059669" }}>{fmtRupiah(payProofTarget.amount)}</strong></p>
                </div>
                <button onClick={() => { setPayProofTarget(null); setPayProofFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#9ca3af" />
                </button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Foto / File Bukti Transfer</label>
                  <div
                    onClick={() => payProofFileRef.current?.click()}
                    style={{ border: "2px dashed #a7f3d0", borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: "#f0fdf4", transition: "background 0.15s" }}>
                    {payProofFile ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        {payProofFile.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(payProofFile)} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                        ) : (
                          <FileText size={32} color="#10b981" />
                        )}
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>{payProofFile.name}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>{(payProofFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Upload size={28} color="#10b981" />
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>Klik untuk pilih file</p>
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>JPG, PNG, PDF · Maks 10MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={payProofFileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPayProofFile(f); }} />
                </div>
                {payProofFile && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>Setelah upload, status reimbursement akan tercatat sebagai &quot;Sudah Dibayar&quot; dengan timestamp saat ini.</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setPayProofTarget(null); setPayProofFile(null); }}
                    style={{ flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    Batal
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handlePayProof} disabled={!payProofFile || uploadingPayProof}
                    style={{ flex: 1, padding: "11px", border: "none", borderRadius: 11, background: payProofFile ? "linear-gradient(135deg, #10b981, #047857)" : "#e5e7eb", cursor: payProofFile ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, color: payProofFile ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {uploadingPayProof ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingPayProof ? "Mengupload..." : "Upload Bukti"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Payment Proof Upload Modal */}
      <AnimatePresence>
        {payProofGroupTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) { setPayProofGroupTarget(null); setPayProofFile(null); } }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Upload Bukti Pembayaran</h2>
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                    {payProofGroupTarget.name} · <strong style={{ color: "#059669" }}>{fmtRupiah(payProofGroupTarget.total)}</strong>
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>({payProofGroupTarget.items.length} item)</span>
                  </p>
                </div>
                <button onClick={() => { setPayProofGroupTarget(null); setPayProofFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#9ca3af" />
                </button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Foto / File Bukti Transfer</label>
                  <div onClick={() => payProofFileRef.current?.click()}
                    style={{ border: "2px dashed #a7f3d0", borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: "#f0fdf4" }}>
                    {payProofFile ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        {payProofFile.type.startsWith("image/") ? (
                          <img src={URL.createObjectURL(payProofFile)} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                        ) : (
                          <FileText size={32} color="#10b981" />
                        )}
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>{payProofFile.name}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>{(payProofFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Upload size={28} color="#10b981" />
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>Klik untuk pilih file</p>
                        <p style={{ fontSize: 11, color: "#9ca3af" }}>JPG, PNG, PDF · Maks 10MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={payProofFileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPayProofFile(f); }} />
                </div>
                {payProofFile && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
                      Bukti ini akan diterapkan ke semua {payProofGroupTarget.items.length} item sekaligus dan tercatat sebagai &quot;Sudah Dibayar&quot;.
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setPayProofGroupTarget(null); setPayProofFile(null); }}
                    style={{ flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 11, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    Batal
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handlePayProofGroup} disabled={!payProofFile || uploadingPayProof}
                    style={{ flex: 1, padding: "11px", border: "none", borderRadius: 11, background: payProofFile ? "linear-gradient(135deg, #10b981, #047857)" : "#e5e7eb", cursor: payProofFile ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, color: payProofFile ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {uploadingPayProof ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingPayProof ? "Mengupload..." : "Upload Bukti"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Transaksi confirm */}
      <AnimatePresence>
        {deleteTrxId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Transaksi?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Data transaksi ini akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteTrxId(null)} style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>Batal</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDeleteTrx(deleteTrxId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>Hapus</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Reimb confirm */}
      <AnimatePresence>
        {deleteReimbId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Batalkan Pengajuan?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Pengajuan reimbursement ini akan dibatalkan dan tidak bisa dikembalikan.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteReimbId(null)} style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>Kembali</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDeleteReimb(deleteReimbId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>Batalkan</motion.button>
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
