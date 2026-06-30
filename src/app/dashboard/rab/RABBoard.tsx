"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, X, ChevronDown, ChevronUp, Trash2,
  CheckCircle, XCircle, Clock, Send, Download,
  Printer, AlertTriangle, TrendingUp, TrendingDown,
  Calculator, Search, Calendar, User, Edit2,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PemasukanRow { id: string; jenis_harga: string; orang: string; nilai_investasi: string }
interface PengeluaranRow { id: string; kategori: string; item: string; jumlah: string; satuan: string; tarif: string }

interface RABRecord {
  id: string;
  nama_kegiatan: string;
  pic: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  pemasukan_rows: { jenis_harga: string; orang: number; nilai_investasi: number }[];
  harga_jual: number | null;
  dpp: number | null;
  ppn: number | null;
  institutional_fee: number | null;
  jenis_rab: "in_house" | "umum";
  catatan: string | null;
  pengeluaran: { kategori: string; item: string; jumlah: number; satuan: string; tarif: number }[];
  status: "draft" | "diajukan" | "disetujui" | "ditolak";
  total_pemasukan: number;
  total_pengeluaran: number;
  profit_loss: number;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  creator?: { full_name: string } | null;
  reviewer?: { full_name: string } | null;
}

const EMPTY_FORM = {
  nama_kegiatan: "", pic: "", tanggal_mulai: "", tanggal_selesai: "",
  harga_jual: "", dpp: "", ppn: "", institutional_fee: "",
  catatan: "",
};

const KATEGORI_PRESET = [
  "Honor Personel", "Honor Kepanitiaan", "Biaya Non-personel",
  "Konsumsi & Snack", "Transportasi", "Akomodasi", "Sewa Venue",
  "Perlengkapan & ATK", "Publikasi & Promosi", "Dokumentasi",
  "Sertifikasi & Perizinan", "Teknologi & IT", "Lain-lain",
];

const SATUAN_OPTIONS = ["jam", "hari", "paket", "orang", "bulan", "kali", "lembar", "unit", "set", "lot"];

const STATUS_CONFIG = {
  draft:     { label: "Draft",     color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: Clock },
  diajukan:  { label: "Diajukan",  color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: Send },
  disetujui: { label: "Disetujui", color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", icon: CheckCircle },
  ditolak:   { label: "Ditolak",   color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: XCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function n(s: string) { return parseFloat(s.replace(/[^0-9.]/g, "")) || 0; }

function fmtRupiah(v: number, compact = false) {
  if (compact) {
    if (v >= 1_000_000_000) return "Rp " + (v / 1_000_000_000).toFixed(1) + "M";
    if (v >= 1_000_000)     return "Rp " + (v / 1_000_000).toFixed(1) + "jt";
    if (v >= 1_000)         return "Rp " + (v / 1_000).toFixed(0) + "rb";
  }
  return "Rp " + Math.round(v).toLocaleString("id-ID");
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function calcSummary(
  rows: PemasukanRow[],
  hargaJualStr: string,
  dppStr: string,
  ppnStr: string,
  instFeeStr: string,
  pengeluaran: PengeluaranRow[],
  jenisRAB: "in_house" | "umum" = "umum",
) {
  const totalPenerimaanAwal = rows.reduce((s, r) => s + n(r.orang) * n(r.nilai_investasi), 0);
  const hargaJual = hargaJualStr !== "" ? n(hargaJualStr) : totalPenerimaanAwal;
  const dpp       = dppStr !== ""       ? n(dppStr)       : hargaJual * (100 / 112);
  const ppn       = ppnStr !== ""       ? n(ppnStr)       : dpp * 0.12;
  const autoInstFee = jenisRAB === "in_house" ? dpp * 0.10 : totalPenerimaanAwal * 0.10;
  const instFee   = instFeeStr !== ""   ? n(instFeeStr)   : autoInstFee;
  const penerimaanAktual = hargaJual - instFee;
  const totalPengeluaran = pengeluaran.reduce((s, r) => s + n(r.jumlah) * n(r.tarif), 0);
  const profitLoss = penerimaanAktual - totalPengeluaran;
  return { totalPenerimaanAwal, hargaJual, dpp, ppn, instFee, penerimaanAktual, totalPengeluaran, profitLoss };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 0 }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</p>}
    </motion.div>
  );
}

function CleanInput({ label, value, onChange, placeholder, type = "text", disabled = false, hint }: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="clean-input"
        style={{ width: "100%", boxSizing: "border-box", background: disabled ? "#f9fafb" : undefined, color: disabled ? "#9ca3af" : undefined }}
      />
      {hint && <p style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { currentUser: UserProfile; initialRAB: RABRecord[] }

export default function RABBoard({ currentUser, initialRAB }: Props) {
  const supabase = createClient();

  const [rabList, setRabList] = useState<RABRecord[]>(initialRAB);
  const [view, setView]       = useState<"list" | "form" | "detail">("list");
  const [editTarget, setEditTarget] = useState<RABRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<RABRecord | null>(null);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch]   = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [jenisRAB, setJenisRAB] = useState<"in_house" | "umum">("umum");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pemasukanRows, setPemasukanRows] = useState<PemasukanRow[]>([
    { id: uid(), jenis_harga: "Harga Utama", orang: "", nilai_investasi: "" },
  ]);
  const [pengeluaranRows, setPengeluaranRows] = useState<PengeluaranRow[]>([
    { id: uid(), kategori: "Honor Personel", item: "", jumlah: "", satuan: "jam", tarif: "" },
  ]);
  const [expandedSections, setExpandedSections] = useState({ pemasukan: true, pengeluaran: true });

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Derived calculations ──────────────────────────────────────────────────
  const calc = useMemo(
    () => calcSummary(pemasukanRows, form.harga_jual, form.dpp, form.ppn, form.institutional_fee, pengeluaranRows, jenisRAB),
    [pemasukanRows, form.harga_jual, form.dpp, form.ppn, form.institutional_fee, pengeluaranRows, jenisRAB],
  );

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (calc.totalPenerimaanAwal === 0) w.push("Total penerimaan awal masih kosong. Isi minimal satu jenis harga dan jumlah orang.");
    if (pengeluaranRows.some(r => r.tarif === "" || n(r.tarif) === 0)) w.push("Ada item pengeluaran yang belum diisi tarifnya.");
    if (calc.profitLoss < 0 && calc.totalPenerimaanAwal > 0) w.push(`Profit/Loss negatif: ${fmtRupiah(calc.profitLoss)}. Cek kembali anggaran pengeluaran.`);
    if (form.tanggal_selesai && form.tanggal_mulai && form.tanggal_selesai < form.tanggal_mulai) w.push("Tanggal selesai lebih awal dari tanggal mulai.");
    return w;
  }, [calc, pengeluaranRows, form.tanggal_mulai, form.tanggal_selesai]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rabList
      .filter(r => filterStatus === "all" || r.status === filterStatus)
      .filter(r => !search || r.nama_kegiatan.toLowerCase().includes(search.toLowerCase()));
  }, [rabList, filterStatus, search]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: rabList.length,
    diajukan: rabList.filter(r => r.status === "diajukan").length,
    totalAnggaranApproved: rabList.filter(r => r.status === "disetujui").reduce((s, r) => s + (r.total_pemasukan || 0), 0),
    avgProfit: rabList.filter(r => r.status === "disetujui").length > 0
      ? rabList.filter(r => r.status === "disetujui").reduce((s, r) => s + (r.profit_loss || 0), 0) / rabList.filter(r => r.status === "disetujui").length
      : 0,
  }), [rabList]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, tanggal_mulai: new Date().toISOString().split("T")[0] });
    setJenisRAB("umum");
    setPemasukanRows([{ id: uid(), jenis_harga: "Harga Utama", orang: "", nilai_investasi: "" }]);
    setPengeluaranRows([
      { id: uid(), kategori: "Honor Personel", item: "Honor Narasumber", jumlah: "2", satuan: "jam", tarif: "" },
      { id: uid(), kategori: "Honor Kepanitiaan", item: "Honor Panitia", jumlah: "1", satuan: "hari", tarif: "" },
      { id: uid(), kategori: "Biaya Non-personel", item: "Biaya Seminar Kit", jumlah: "1", satuan: "paket", tarif: "" },
    ]);
    setView("form");
  }

  function openEdit(r: RABRecord) {
    setEditTarget(r);
    setForm({
      nama_kegiatan: r.nama_kegiatan,
      pic: r.pic ?? "",
      tanggal_mulai: r.tanggal_mulai,
      tanggal_selesai: r.tanggal_selesai ?? "",
      harga_jual: r.harga_jual != null ? String(r.harga_jual) : "",
      dpp: r.dpp != null ? String(r.dpp) : "",
      ppn: r.ppn != null ? String(r.ppn) : "",
      institutional_fee: r.institutional_fee != null ? String(r.institutional_fee) : "",
      catatan: r.catatan ?? "",
    });
    setPemasukanRows(r.pemasukan_rows.length > 0
      ? r.pemasukan_rows.map(x => ({ id: uid(), jenis_harga: x.jenis_harga, orang: String(x.orang), nilai_investasi: String(x.nilai_investasi) }))
      : [{ id: uid(), jenis_harga: "Harga Utama", orang: "", nilai_investasi: "" }]
    );
    setPengeluaranRows(r.pengeluaran.length > 0
      ? r.pengeluaran.map(x => ({ id: uid(), kategori: x.kategori, item: x.item, jumlah: String(x.jumlah), satuan: x.satuan, tarif: String(x.tarif) }))
      : [{ id: uid(), kategori: "", item: "", jumlah: "", satuan: "paket", tarif: "" }]
    );
    setJenisRAB(r.jenis_rab ?? "umum");
    setView("form");
  }

  function updatePemasukanRow(id: string, key: keyof PemasukanRow, val: string) {
    setPemasukanRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  }
  function updatePengeluaranRow(id: string, key: keyof PengeluaranRow, val: string) {
    setPengeluaranRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(submitStatus: "draft" | "diajukan" = "draft") {
    if (!form.nama_kegiatan.trim() || !form.tanggal_mulai) {
      showToast("Nama kegiatan dan tanggal mulai wajib diisi.", false); return;
    }
    setSaving(true);

    const c = calcSummary(pemasukanRows, form.harga_jual, form.dpp, form.ppn, form.institutional_fee, pengeluaranRows, jenisRAB);
    const payload = {
      nama_kegiatan: form.nama_kegiatan.trim(),
      pic: form.pic.trim() || null,
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai || null,
      pemasukan_rows: pemasukanRows.map(r => ({ jenis_harga: r.jenis_harga, orang: n(r.orang), nilai_investasi: n(r.nilai_investasi) })),
      harga_jual: form.harga_jual !== "" ? n(form.harga_jual) : null,
      dpp: form.dpp !== "" ? n(form.dpp) : null,
      ppn: form.ppn !== "" ? n(form.ppn) : null,
      institutional_fee: form.institutional_fee !== "" ? n(form.institutional_fee) : null,
      catatan: form.catatan.trim() || null,
      jenis_rab: jenisRAB,
      pengeluaran: pengeluaranRows.map(r => ({ kategori: r.kategori, item: r.item, jumlah: n(r.jumlah), satuan: r.satuan, tarif: n(r.tarif) })),
      status: submitStatus,
      total_pemasukan: c.totalPenerimaanAwal,
      total_pengeluaran: c.totalPengeluaran,
      profit_loss: c.profitLoss,
      updated_at: new Date().toISOString(),
    };

    let error, data;
    if (editTarget) {
      ({ error, data } = await supabase.from("rab").update(payload).eq("id", editTarget.id).select("*, creator:profiles!rab_created_by_fkey(full_name), reviewer:profiles!rab_reviewed_by_fkey(full_name)").single());
    } else {
      ({ error, data } = await supabase.from("rab").insert({ ...payload, created_by: currentUser.id }).select("*, creator:profiles!rab_created_by_fkey(full_name), reviewer:profiles!rab_reviewed_by_fkey(full_name)").single());
    }

    if (error) { showToast("Gagal menyimpan RAB.", false); setSaving(false); return; }

    if (editTarget) {
      setRabList(prev => prev.map(r => r.id === editTarget.id ? data : r));
    } else {
      setRabList(prev => [data, ...prev]);
    }
    showToast(submitStatus === "diajukan" ? "RAB berhasil diajukan!" : "RAB disimpan sebagai draft.");
    setView("list");
    setSaving(false);
  }

  // ── Review (approve / reject) ─────────────────────────────────────────────
  async function handleReview(newStatus: "disetujui" | "ditolak") {
    if (!detailTarget) return;
    if (newStatus === "ditolak" && !reviewNote.trim()) {
      showToast("Isi catatan alasan penolakan.", false); return;
    }
    setReviewLoading(true);
    const { data, error } = await supabase.from("rab")
      .update({ status: newStatus, review_note: reviewNote.trim() || null, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() })
      .eq("id", detailTarget.id)
      .select("*, creator:profiles!rab_created_by_fkey(full_name), reviewer:profiles!rab_reviewed_by_fkey(full_name)")
      .single();
    if (error) { showToast("Gagal memperbarui status.", false); setReviewLoading(false); return; }
    setRabList(prev => prev.map(r => r.id === detailTarget.id ? data : r));
    setDetailTarget(data);
    showToast(newStatus === "disetujui" ? "RAB disetujui!" : "RAB ditolak.");
    setReviewLoading(false);
    setReviewNote("");
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Hapus RAB ini? Tindakan tidak dapat dibatalkan.")) return;
    const { error } = await supabase.from("rab").delete().eq("id", id);
    if (error) { showToast("Gagal menghapus RAB.", false); return; }
    setRabList(prev => prev.filter(r => r.id !== id));
    if (detailTarget?.id === id) { setDetailTarget(null); setView("list"); }
    showToast("RAB dihapus.");
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV(r: RABRecord) {
    const c2 = calcSummary(
      r.pemasukan_rows.map(x => ({ id: "", jenis_harga: x.jenis_harga, orang: String(x.orang), nilai_investasi: String(x.nilai_investasi) })),
      r.harga_jual != null ? String(r.harga_jual) : "",
      r.dpp != null ? String(r.dpp) : "",
      r.ppn != null ? String(r.ppn) : "",
      r.institutional_fee != null ? String(r.institutional_fee) : "",
      r.pengeluaran.map(x => ({ id: "", kategori: x.kategori, item: x.item, jumlah: String(x.jumlah), satuan: x.satuan, tarif: String(x.tarif) })),
      r.jenis_rab ?? "umum",
    );
    const rows: (string | number)[][] = [
      [`RAB — ${r.nama_kegiatan}`],
      [`PIC: ${r.pic ?? "-"}`, `Tanggal: ${fmtDate(r.tanggal_mulai)}${r.tanggal_selesai ? " s/d " + fmtDate(r.tanggal_selesai) : ""}`],
      [],
      ["=== RAB PEMASUKAN ==="],
      ["Jenis Harga", "Orang", "Nilai Investasi", "Subtotal"],
      ...r.pemasukan_rows.map(x => [x.jenis_harga, x.orang, x.nilai_investasi, x.orang * x.nilai_investasi]),
      [],
      ["Total Penerimaan Awal", "", "", c2.totalPenerimaanAwal],
      ["Harga Jual", "", "", c2.hargaJual],
      ["DPP", "", "", Math.round(c2.dpp)],
      ["PPN (12%)", "", "", Math.round(c2.ppn)],
      ["Institutional Fee (10%)", "", "", Math.round(c2.instFee)],
      ["Penerimaan Aktual", "", "", Math.round(c2.penerimaanAktual)],
      [],
      ["=== RAB PENGELUARAN ==="],
      ["Kategori", "Item", "Jumlah", "Satuan", "Tarif", "Subtotal"],
      ...r.pengeluaran.map(x => [x.kategori, x.item, x.jumlah, x.satuan, x.tarif, x.jumlah * x.tarif]),
      [],
      ["Total Pengeluaran", "", "", "", "", c2.totalPengeluaran],
      ["Profit / Loss", "", "", "", "", Math.round(c2.profitLoss)],
    ];
    if (r.catatan) rows.push([], ["Catatan", r.catatan]);
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `RAB-${r.nama_kegiatan.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
        <Topbar user={currentUser} title="RAB" />

        <main className="board-main" style={{ flex: 1 }}>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <FileText size={20} color="#6366f1" strokeWidth={2} />
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Rencana Anggaran Biaya</h2>
              </div>
              <p style={{ fontSize: 13, color: "#6b7280" }}>Kelola RAB kegiatan GRCC — hanya dapat diakses oleh Super Admin & Manager.</p>
            </div>
            <motion.button whileHover={{ y: -1, boxShadow: "0 6px 20px rgba(99,102,241,0.3)" }} whileTap={{ scale: 0.97 }}
              onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #4f46e5)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Plus size={15} /> Buat RAB
            </motion.button>
          </motion.div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <StatCard label="Total RAB" value={String(stats.total)} color="#111827" sub="semua status" />
            <StatCard label="Menunggu Review" value={String(stats.diajukan)} color="#f59e0b" sub={stats.diajukan > 0 ? "perlu tindakan" : "semua beres"} />
            <StatCard label="Anggaran Disetujui" value={fmtRupiah(stats.totalAnggaranApproved, true)} color="#10b981" sub="total penerimaan" />
            <StatCard label="Avg Profit/Loss" value={fmtRupiah(Math.abs(stats.avgProfit), true)} color={stats.avgProfit >= 0 ? "#10b981" : "#ef4444"} sub={stats.avgProfit >= 0 ? "surplus rata-rata" : "defisit rata-rata"} />
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
              <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama kegiatan..."
                className="clean-input" style={{ paddingLeft: 36, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "draft", "diajukan", "disetujui", "ditolak"].map(s => (
                <motion.button key={s} whileTap={{ scale: 0.97 }} onClick={() => setFilterStatus(s)}
                  style={{
                    padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                    background: filterStatus === s ? "#6366f1" : "#fff",
                    color: filterStatus === s ? "#fff" : "#374151",
                    boxShadow: filterStatus === s ? "0 2px 8px rgba(99,102,241,0.3)" : "0 0 0 1px #e5e7eb",
                  }}>
                  {s === "all" ? "Semua" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
                </motion.button>
              ))}
            </div>
          </div>

          {/* RAB Cards */}
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "60px 0" }}>
              <FileText size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Belum ada RAB</p>
              <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Klik &quot;Buat RAB&quot; untuk memulai.</p>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence>
                {filtered.map((r, i) => {
                  const s = STATUS_CONFIG[r.status];
                  const StatusIcon = s.icon;
                  const isProfit = r.profit_loss >= 0;
                  return (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.07)" }}
                      style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.2s" }}
                      onClick={() => { setDetailTarget(r); setView("detail"); }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nama_kegiatan}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: r.jenis_rab === "in_house" ? "#f5f3ff" : "#eff6ff", color: r.jenis_rab === "in_house" ? "#7c3aed" : "#2563eb", border: `1px solid ${r.jenis_rab === "in_house" ? "#ddd6fe" : "#bfdbfe"}`, flexShrink: 0 }}>
                              {r.jenis_rab === "in_house" ? "In House" : "Umum"}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                              <StatusIcon size={9} /> {s.label}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            {r.pic && <span style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}><User size={11} />{r.pic}</span>}
                            <span style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} />{fmtDate(r.tanggal_mulai)}{r.tanggal_selesai ? " — " + fmtDate(r.tanggal_selesai) : ""}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>by {r.creator?.full_name ?? "—"}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 20, flexShrink: 0, alignItems: "center" }}>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Penerimaan</p>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{fmtRupiah(r.total_pemasukan, true)}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Pengeluaran</p>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{fmtRupiah(r.total_pengeluaran, true)}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Profit/Loss</p>
                            <p style={{ fontSize: 14, fontWeight: 800, color: isProfit ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                              {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {fmtRupiah(Math.abs(r.profit_loss), true)}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(r)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Edit2 size={13} color="#6b7280" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => exportCSV(r)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Download size={13} color="#6b7280" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(r.id)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Trash2 size={13} color="#ef4444" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </main>

        <Toast toast={toast} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "detail" && detailTarget) {
    const r = detailTarget;
    const c2 = calcSummary(
      r.pemasukan_rows.map(x => ({ id: "", jenis_harga: x.jenis_harga, orang: String(x.orang), nilai_investasi: String(x.nilai_investasi) })),
      r.harga_jual != null ? String(r.harga_jual) : "",
      r.dpp != null ? String(r.dpp) : "",
      r.ppn != null ? String(r.ppn) : "",
      r.institutional_fee != null ? String(r.institutional_fee) : "",
      r.pengeluaran.map(x => ({ id: "", kategori: x.kategori, item: x.item, jumlah: String(x.jumlah), satuan: x.satuan, tarif: String(x.tarif) })),
      r.jenis_rab ?? "umum",
    );
    const s = STATUS_CONFIG[r.status];
    const StatusIcon = s.icon;

    return (
      <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
        <Topbar user={currentUser} title="RAB" />
        <main className="board-main" style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%" }}>

          {/* Back + actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView("list")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6366f1" }}>
              ← Kembali ke daftar
            </motion.button>
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => exportCSV(r)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                <Download size={13} /> Export CSV
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => window.print()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #111827", background: "#111827", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                <Printer size={13} /> Cetak
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => openEdit(r)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#6366f1", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                <Edit2 size={13} /> Edit
              </motion.button>
            </div>
          </div>

          {/* Header card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{r.nama_kegiatan}</h2>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {r.pic && <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5 }}><User size={12} /> {r.pic}</span>}
                  <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5 }}><Calendar size={12} /> {fmtDate(r.tanggal_mulai)}{r.tanggal_selesai ? " — " + fmtDate(r.tanggal_selesai) : ""}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Dibuat oleh {r.creator?.full_name ?? "—"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: r.jenis_rab === "in_house" ? "#f5f3ff" : "#eff6ff", color: r.jenis_rab === "in_house" ? "#7c3aed" : "#2563eb", border: `1px solid ${r.jenis_rab === "in_house" ? "#ddd6fe" : "#bfdbfe"}` }}>
                  {r.jenis_rab === "in_house" ? "In House" : "Umum"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", gap: 5 }}>
                  <StatusIcon size={12} /> {s.label}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total Penerimaan", value: fmtRupiah(c2.totalPenerimaanAwal), color: "#111827" },
              { label: "Penerimaan Aktual", value: fmtRupiah(c2.penerimaanAktual), color: "#3b82f6" },
              { label: "Total Pengeluaran", value: fmtRupiah(c2.totalPengeluaran), color: "#f59e0b" },
              { label: "Profit / Loss", value: fmtRupiah(Math.abs(c2.profitLoss)), color: c2.profitLoss >= 0 ? "#10b981" : "#ef4444", sub: c2.profitLoss >= 0 ? "surplus" : "defisit" },
            ].map((cs, i) => (
              <motion.div key={cs.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{cs.label}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: cs.color }}>{cs.value}</p>
                {cs.sub && <p style={{ fontSize: 10, color: cs.color, marginTop: 2, fontWeight: 600 }}>{cs.sub}</p>}
              </motion.div>
            ))}
          </div>

          {/* Pemasukan table */}
          <DetailSection title="RAB Pemasukan" delay={0.1}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Jenis Harga", "Orang", "Nilai Investasi", "Subtotal"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.pemasukan_rows.map((x, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{x.jenis_harga}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{x.orang.toLocaleString("id-ID")}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{fmtRupiah(x.nilai_investasi)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>{fmtRupiah(x.orang * x.nilai_investasi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 12px 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
              {[
                { label: "Harga Jual", value: fmtRupiah(c2.hargaJual) },
                { label: "DPP", value: fmtRupiah(c2.dpp) },
                { label: "PPN (12%)", value: fmtRupiah(c2.ppn) },
                { label: `Institutional Fee (10% × ${r.jenis_rab === "in_house" ? "DPP" : "Penerimaan Awal"})`, value: fmtRupiah(c2.instFee) },
                { label: "Penerimaan Aktual", value: fmtRupiah(c2.penerimaanAktual) },
              ].map(d => (
                <div key={d.label}>
                  <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 }}>{d.value}</p>
                </div>
              ))}
            </div>
          </DetailSection>

          {/* Pengeluaran table */}
          <DetailSection title="RAB Pengeluaran" delay={0.15}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Kategori", "Item", "Jumlah", "Satuan", "Tarif", "Subtotal"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.pengeluaran.map((x, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{x.kategori}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{x.item}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{x.jumlah}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{x.satuan}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{fmtRupiah(x.tarif)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>{fmtRupiah(x.jumlah * x.tarif)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                  <td colSpan={5} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: 13 }}>Total Pengeluaran</td>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: "#ef4444", fontSize: 15 }}>{fmtRupiah(c2.totalPengeluaran)}</td>
                </tr>
              </tfoot>
            </table>
          </DetailSection>

          {r.catatan && (
            <DetailSection title="Catatan" delay={0.2}>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, padding: "0 12px 12px" }}>{r.catatan}</p>
            </DetailSection>
          )}

          {/* Review section — only for pending */}
          {r.status === "diajukan" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, padding: "20px 24px", marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>RAB ini menunggu keputusan Anda</span>
              </div>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Catatan review (wajib diisi jika menolak)..."
                rows={3} className="clean-input"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                  disabled={reviewLoading} onClick={() => handleReview("disetujui")}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <CheckCircle size={14} /> {reviewLoading ? "..." : "Setujui RAB"}
                </motion.button>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                  disabled={reviewLoading} onClick={() => handleReview("ditolak")}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <XCircle size={14} /> {reviewLoading ? "..." : "Tolak RAB"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Review result */}
          {(r.status === "disetujui" || r.status === "ditolak") && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ background: r.status === "disetujui" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${r.status === "disetujui" ? "#d1fae5" : "#fecaca"}`, borderRadius: 16, padding: "16px 24px", marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: r.review_note ? 8 : 0 }}>
                {r.status === "disetujui" ? <CheckCircle size={15} color="#10b981" /> : <XCircle size={15} color="#ef4444" />}
                <span style={{ fontSize: 13, fontWeight: 700, color: r.status === "disetujui" ? "#065f46" : "#991b1b" }}>
                  {r.status === "disetujui" ? "Disetujui" : "Ditolak"} oleh {r.reviewer?.full_name ?? "—"}
                  {r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString("id-ID")}` : ""}
                </span>
              </div>
              {r.review_note && <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, marginLeft: 23 }}>{r.review_note}</p>}
            </motion.div>
          )}

        </main>
        <Toast toast={toast} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f9fafb" }}>
      <Topbar user={currentUser} title="RAB" />

      <main className="board-main" style={{ flex: 1, maxWidth: 860, margin: "0 auto", width: "100%" }}>

        {/* Form header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{editTarget ? "Edit RAB" : "Buat RAB Baru"}</h2>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Semua perhitungan otomatis. Override manual tersedia di tiap field.</p>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView("list")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            <X size={13} /> Batal
          </motion.button>
        </motion.div>

        {/* Info kegiatan */}
        <FormSection title="Informasi Kegiatan" delay={0}>
          {/* Jenis RAB toggle */}
          <div style={{ marginBottom: 18, padding: "14px 16px", background: jenisRAB === "in_house" ? "#faf5ff" : "#eff6ff", borderRadius: 12, border: `1px solid ${jenisRAB === "in_house" ? "#e9d5ff" : "#bfdbfe"}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Jenis RAB</p>
            <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 10, padding: 3, width: "fit-content", boxShadow: "0 0 0 1px #e5e7eb" }}>
              {(["umum", "in_house"] as const).map(type => (
                <motion.button key={type} whileTap={{ scale: 0.97 }}
                  onClick={() => setJenisRAB(type)}
                  style={{
                    padding: "9px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                    background: jenisRAB === type
                      ? type === "in_house" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "linear-gradient(135deg, #6366f1, #4f46e5)"
                      : "transparent",
                    color: jenisRAB === type ? "#fff" : "#6b7280",
                    boxShadow: jenisRAB === type ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                    transition: "all 0.15s ease",
                  }}>
                  {type === "in_house" ? "In House" : "Umum"}
                </motion.button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: jenisRAB === "in_house" ? "#6d28d9" : "#4f46e5", marginTop: 10, fontWeight: 500 }}>
              {jenisRAB === "in_house"
                ? "Institutional Fee = 10% × DPP"
                : "Institutional Fee = 10% × Total Penerimaan Awal"}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <CleanInput label="Nama Kegiatan *" value={form.nama_kegiatan} onChange={v => setForm(f => ({ ...f, nama_kegiatan: v }))} placeholder="Contoh: Pelatihan Public Batch 1" />
            <CleanInput label="PIC" value={form.pic} onChange={v => setForm(f => ({ ...f, pic: v }))} placeholder="Nama PIC kegiatan" />
            <CleanInput label="Tanggal Mulai *" type="date" value={form.tanggal_mulai} onChange={v => setForm(f => ({ ...f, tanggal_mulai: v }))} />
            <CleanInput label="Tanggal Selesai" type="date" value={form.tanggal_selesai} onChange={v => setForm(f => ({ ...f, tanggal_selesai: v }))} />
          </div>
        </FormSection>

        {/* RAB Pemasukan */}
        <FormSection title="RAB Pemasukan" subtitle="Bisa memakai lebih dari satu jenis harga. Total penerimaan awal dijumlahkan dari semua baris." delay={0.05}
          onToggle={() => setExpandedSections(s => ({ ...s, pemasukan: !s.pemasukan }))}
          expanded={expandedSections.pemasukan}
          action={<motion.button whileTap={{ scale: 0.97 }} onClick={() => setPemasukanRows(prev => [...prev, { id: uid(), jenis_harga: "", orang: "", nilai_investasi: "" }])}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #6366f1", background: "#fff", color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={12} /> Tambah Harga
          </motion.button>}
        >
          {/* Rows */}
          <AnimatePresence>
            {pemasukanRows.map((row, i) => (
              <motion.div key={row.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 36px", gap: 10, marginBottom: 10 }}>
                <CleanInput label={i === 0 ? "Jenis Harga" : undefined} value={row.jenis_harga} onChange={v => updatePemasukanRow(row.id, "jenis_harga", v)} placeholder="Harga Utama" />
                <CleanInput label={i === 0 ? "Orang" : undefined} type="number" value={row.orang} onChange={v => updatePemasukanRow(row.id, "orang", v)} placeholder="Orang" />
                <CleanInput label={i === 0 ? "Nilai Investasi" : undefined} type="number" value={row.nilai_investasi} onChange={v => updatePemasukanRow(row.id, "nilai_investasi", v)} placeholder="Nilai investasi" />
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 1 }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPemasukanRows(prev => prev.filter(r => r.id !== row.id))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={13} color="#ef4444" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Calculated summary */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Total Penerimaan Awal</p>
                <div className="clean-input" style={{ background: "#f3f4f6", color: "#374151", fontWeight: 700 }}>{fmtRupiah(calc.totalPenerimaanAwal)}</div>
              </div>
              <CleanInput label="Harga Jual" type="number" value={form.harga_jual}
                onChange={v => setForm(f => ({ ...f, harga_jual: v }))}
                placeholder={`Auto: ${fmtRupiah(calc.totalPenerimaanAwal)}`}
                hint="Kosong = total penerimaan awal" />
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>DPP</p>
                <CleanInput value={form.dpp} onChange={v => setForm(f => ({ ...f, dpp: v }))} placeholder={`Auto: ${fmtRupiah(calc.dpp)}`} hint="Kosong = auto. Isi 0/manual jika perlu." />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <CleanInput label="PPN" value={form.ppn} onChange={v => setForm(f => ({ ...f, ppn: v }))} placeholder={`Auto: ${fmtRupiah(calc.ppn)}`} hint="Kosong = DPP × 12%. Isi 0 untuk bebas PPN." />
              <CleanInput label="Institutional Fee" value={form.institutional_fee} onChange={v => setForm(f => ({ ...f, institutional_fee: v }))} placeholder={`Auto: ${fmtRupiah(calc.instFee)}`} hint={jenisRAB === "in_house" ? "Kosong = 10% × DPP (In House). Bisa manual/0." : "Kosong = 10% × Total Penerimaan Awal (Umum). Bisa manual/0."} />
            </div>
          </div>
        </FormSection>

        {/* Catatan */}
        <FormSection title="Catatan" delay={0.08}>
          <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
            placeholder="Opsional — catatan tambahan untuk RAB ini"
            rows={3} className="clean-input"
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        </FormSection>

        {/* RAB Pengeluaran */}
        <FormSection title="RAB Pengeluaran" subtitle="Kategori + item + jumlah × satuan/jam × tarif akan dihitung otomatis." delay={0.1}
          onToggle={() => setExpandedSections(s => ({ ...s, pengeluaran: !s.pengeluaran }))}
          expanded={expandedSections.pengeluaran}
          action={<motion.button whileTap={{ scale: 0.97 }} onClick={() => setPengeluaranRows(prev => [...prev, { id: uid(), kategori: "", item: "", jumlah: "", satuan: "paket", tarif: "" }])}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #6366f1", background: "#fff", color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={12} /> Tambah Item
          </motion.button>}
        >
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 0.7fr 0.7fr 1fr 36px", gap: 8, marginBottom: 6 }}>
            {["KATEGORI", "ITEM", "JUMLAH", "SATUAN", "TARIF", ""].map(h => (
              <p key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</p>
            ))}
          </div>
          <AnimatePresence>
            {pengeluaranRows.map(row => (
              <motion.div key={row.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 0.7fr 0.7fr 1fr 36px", gap: 8, marginBottom: 8 }}>
                {/* Kategori with datalist */}
                <div style={{ position: "relative" }}>
                  <input value={row.kategori} onChange={e => updatePengeluaranRow(row.id, "kategori", e.target.value)}
                    list={`kat-${row.id}`} placeholder="Kategori" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                  <datalist id={`kat-${row.id}`}>
                    {KATEGORI_PRESET.map(k => <option key={k} value={k} />)}
                  </datalist>
                </div>
                <input value={row.item} onChange={e => updatePengeluaranRow(row.id, "item", e.target.value)}
                  placeholder="Item" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                <input type="number" value={row.jumlah} onChange={e => updatePengeluaranRow(row.id, "jumlah", e.target.value)}
                  placeholder="0" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                <select value={row.satuan} onChange={e => updatePengeluaranRow(row.id, "satuan", e.target.value)}
                  className="clean-input" style={{ width: "100%", boxSizing: "border-box" }}>
                  {SATUAN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="number" value={row.tarif} onChange={e => updatePengeluaranRow(row.id, "tarif", e.target.value)}
                  placeholder="Tarif" className="clean-input" style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", alignItems: "center" }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPengeluaranRows(prev => prev.filter(r => r.id !== row.id))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={13} color="#ef4444" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div style={{ textAlign: "right", marginTop: 8, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>Total: {fmtRupiah(calc.totalPengeluaran)}</span>
          </div>
        </FormSection>

        {/* Live summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <Calculator size={14} color="#6366f1" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Ringkasan Kalkulasi</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "PPN", value: fmtRupiah(calc.ppn), color: "#374151" },
              { label: "Penerimaan Aktual", value: fmtRupiah(calc.penerimaanAktual), color: "#3b82f6" },
              { label: "Pengeluaran", value: fmtRupiah(calc.totalPengeluaran), color: "#f59e0b" },
              { label: "Profit / Loss", value: fmtRupiah(Math.abs(calc.profitLoss)), color: calc.profitLoss >= 0 ? "#10b981" : "#ef4444" },
            ].map(d => (
              <div key={d.label} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{d.label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: d.color, marginTop: 4 }}>{d.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Warnings */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Warning Angka</span>
              </div>
              {warnings.map((w, i) => (
                <p key={i} style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5, marginLeft: 21 }}>• {w}</p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setView("list")}
            style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            Batal
          </motion.button>
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
            disabled={saving}
            onClick={() => handleSave("draft")}
            style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            {saving ? "Menyimpan..." : "Simpan Draft"}
          </motion.button>
          <motion.button whileHover={{ y: -1, boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }} whileTap={{ scale: 0.97 }}
            disabled={saving}
            onClick={() => handleSave("diajukan")}
            style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <Send size={13} /> {saving ? "Mengajukan..." : "Ajukan RAB"}
          </motion.button>
        </motion.div>

      </main>
      <Toast toast={toast} />
    </div>
  );
}

// ─── Small reusable pieces ────────────────────────────────────────────────────
function FormSection({ title, subtitle, children, delay = 0, onToggle, expanded = true, action }: {
  title: string; subtitle?: string; children: React.ReactNode; delay?: number;
  onToggle?: () => void; expanded?: boolean; action?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded ? 14 : 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, cursor: onToggle ? "pointer" : "default" }} onClick={onToggle}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{title}</h3>
            {onToggle && (expanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />)}
          </div>
          {subtitle && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <AnimatePresence>
        {expanded && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{children}</motion.div>}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailSection({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f9fafb" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function Toast({ toast }: { toast: { msg: string; ok: boolean } | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 9999,
            background: toast.ok ? "#111827" : "#ef4444",
            color: "#fff", padding: "12px 20px", borderRadius: 12,
            fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
