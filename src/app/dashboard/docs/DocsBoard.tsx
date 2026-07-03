"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Document } from "@/types";
import {
  FolderOpen, X, Check, Search, Download, Trash2,
  FileText, Image as ImageIcon, FileArchive, File, Upload,
  Lock, Eye, EyeOff, KeyRound, ShieldAlert,
  LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown,
  Edit3, ZoomIn,
} from "lucide-react";

const FIXED_CATS = ["Pelatihan Publik", "Pelatihan In-House", "Pendampingan", "Pameran/Wayang", "Keuangan"];
const CATEGORIES = [...FIXED_CATS, "Lainnya"];

const CAT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  "Pelatihan Publik":  { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  "Pelatihan In-House":{ bg: "#fef9c3", text: "#713f12", border: "#fef08a" },
  Pendampingan:        { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  "Pameran/Wayang":    { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  Keuangan:            { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  Lainnya:             { bg: "#fff7ed", text: "#7c2d12", border: "#fed7aa" },
};

function getFileIcon(type: string | null | undefined, size = 20) {
  if (!type) return <File size={size} />;
  if (type.startsWith("image/")) return <ImageIcon size={size} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return <FileArchive size={size} />;
  return <FileText size={size} />;
}

function getFileColor(type: string | null | undefined) {
  if (!type) return "#9ca3af";
  if (type.startsWith("image/")) return "#10b981";
  if (type.includes("pdf")) return "#ef4444";
  if (type.includes("word") || type.includes("doc")) return "#3b82f6";
  if (type.includes("sheet") || type.includes("excel")) return "#16a34a";
  if (type.includes("zip") || type.includes("rar")) return "#f59e0b";
  return "#6366f1";
}

function fmtSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FORM = { title: "", description: "", category: "Pelatihan Publik", is_locked: false, password: "" };

type SortField = "date" | "name" | "size" | "category";

function uniqueFileName(ext: string | undefined) {
  return `${new Date().getTime()}-${crypto.randomUUID()}.${ext ?? "file"}`;
}

interface Props {
  currentUser: UserProfile;
  initialDocs: Document[];
  totalCount: number;
  pageSize: number;
}

export default function DocsBoard({ currentUser, initialDocs, totalCount, pageSize }: Props) {
  const supabase = createClient();
  const canUpload = true;
  const canManage = ["super_admin", "manager", "program_admin"].includes(currentUser.role);

  // Core state
  const [docs, setDocs] = useState<Document[]>(initialDocs);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [serverTotal, setServerTotal] = useState(totalCount);
  const [loadingMore, setLoadingMore] = useState(false);

  // View & sort
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Upload
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadPass, setShowUploadPass] = useState(false);

  // Edit metadata
  const [editTarget, setEditTarget] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "Pelatihan Publik" });
  const [editSaving, setEditSaving] = useState(false);

  // Preview
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Password lock
  const [lockTarget, setLockTarget] = useState<Document | null>(null);
  const [lockInput, setLockInput] = useState("");
  const [lockError, setLockError] = useState(false);
  const [lockShake, setLockShake] = useState(false);
  const [showLockPass, setShowLockPass] = useState(false);
  const [pendingPreviewAfterUnlock, setPendingPreviewAfterUnlock] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const hasMore = docs.length < serverTotal;

  // ─── Computed ──────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.file_name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all"
      || (catFilter === "Lainnya" ? !FIXED_CATS.includes(d.category) : d.category.toLowerCase() === catFilter.toLowerCase());
    return matchSearch && matchCat;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name")     cmp = a.title.localeCompare(b.title);
    else if (sortBy === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortBy === "size") cmp = (a.file_size ?? 0) - (b.file_size ?? 0);
    else if (sortBy === "category") cmp = a.category.localeCompare(b.category);
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ─── Helpers ───────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  // ─── Upload ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") }));
  };

  const handleUpload = async () => {
    if (!file || !form.title.trim()) return;
    if (form.is_locked && !form.password.trim()) return;
    setUploading(true);
    setUploadProgress(10);

    const ext = file.name.split(".").pop();
    const fileName = uniqueFileName(ext);
    const filePath = `${currentUser.id}/${fileName}`;

    setUploadProgress(30);
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      showToast("Gagal upload: " + uploadError.message, false);
      setUploading(false); setUploadProgress(0);
      return;
    }

    setUploadProgress(70);
    const { data, error: dbError } = await supabase
      .from("documents")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        file_path: filePath, file_name: file.name,
        file_size: file.size, file_type: file.type,
        category: form.category, uploaded_by: currentUser.id,
        is_locked: form.is_locked,
        password_hash: form.is_locked ? btoa(form.password) : null,
      })
      .select("*, profiles(full_name, role)")
      .single();

    setUploadProgress(100);
    if (dbError) showToast("Gagal menyimpan data: " + dbError.message, false);
    else {
      setDocs(prev => [data, ...prev]);
      setServerTotal(t => t + 1);
      showToast(`${file.name} berhasil diupload`);
      setShowModal(false); setForm(EMPTY_FORM); setFile(null); setUploadProgress(0);
    }
    setUploading(false);
  };

  // ─── Edit Metadata ─────────────────────────────────────────────
  const openEdit = (doc: Document) => {
    setEditTarget(doc);
    setEditForm({ title: doc.title, description: doc.description ?? "", category: doc.category });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    const { error } = await supabase.from("documents").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      category: editForm.category,
    }).eq("id", editTarget.id);

    if (error) showToast("Gagal menyimpan", false);
    else {
      setDocs(prev => prev.map(d => d.id === editTarget.id
        ? { ...d, title: editForm.title.trim(), description: editForm.description.trim() || null, category: editForm.category }
        : d));
      showToast("Dokumen diperbarui");
      setEditTarget(null);
    }
    setEditSaving(false);
  };

  // ─── Preview ───────────────────────────────────────────────────
  const openPreview = async (doc: Document, bypassLock = false) => {
    if (doc.is_locked && !bypassLock) {
      setPendingPreviewAfterUnlock(true);
      setLockTarget(doc); setLockInput(""); setLockError(false); setShowLockPass(false);
      return;
    }
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewLoading(true);
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
    setPreviewUrl(data?.signedUrl ?? null);
    setPreviewLoading(false);
  };

  // ─── Download ──────────────────────────────────────────────────
  const handleDownload = async (doc: Document) => {
    if (doc.is_locked) {
      setPendingPreviewAfterUnlock(false);
      setLockTarget(doc); setLockInput(""); setLockError(false); setShowLockPass(false);
      return;
    }
    await doDownload(doc);
  };

  const doDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (error || !data) { showToast("Gagal membuat link download", false); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = doc.file_name; a.click();
    showToast(`Mengunduh ${doc.file_name}`);
  };

  // ─── Password unlock ───────────────────────────────────────────
  const handlePasswordSubmit = async () => {
    if (!lockTarget) return;
    if (btoa(lockInput) !== lockTarget.password_hash) {
      setLockError(true); setLockShake(true);
      setTimeout(() => setLockShake(false), 600);
      return;
    }
    const target = lockTarget;
    const wasPreview = pendingPreviewAfterUnlock;
    setLockTarget(null); setPendingPreviewAfterUnlock(false);
    if (wasPreview) await openPreview(target, true);
    else await doDownload(target);
  };

  // ─── Delete ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    await supabase.storage.from("documents").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) showToast("Gagal menghapus", false);
    else { setDocs(prev => prev.filter(d => d.id !== id)); setServerTotal(t => t - 1); showToast("Dokumen dihapus"); }
    setDeleteId(null);
  };

  // ─── Load more ─────────────────────────────────────────────────
  const handleLoadMore = async () => {
    setLoadingMore(true);
    const { data, count } = await supabase
      .from("documents")
      .select("*, profiles(full_name, role)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(docs.length, docs.length + pageSize - 1);
    if (data) setDocs(prev => [...prev, ...data]);
    if (count != null) setServerTotal(count);
    setLoadingMore(false);
  };

  // ─── Render helpers ────────────────────────────────────────────
  const renderSortButton = (field: SortField, label: string) => (
    <button
      onClick={() => toggleSort(field)}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "6px 10px", border: sortBy === field ? "1.5px solid #f59e0b" : "1.5px solid #e5e7eb",
        borderRadius: 8, background: sortBy === field ? "#fffbeb" : "#fff",
        cursor: "pointer", fontSize: 11, fontWeight: 600,
        color: sortBy === field ? "#d97706" : "#6b7280", transition: "all 0.15s",
      }}
    >
      {label}
      {sortBy === field
        ? sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
        : <ArrowUpDown size={10} color="#d1d5db" />}
    </button>
  );

  const isImage = (type?: string | null) => !!type?.startsWith("image/");
  const isPdf   = (type?: string | null) => !!type?.includes("pdf");

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>

      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
          }}>
            <FolderOpen size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Dokumen</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              {docs.length} dari {serverTotal} file tersimpan
            </p>
          </div>
        </div>
        {canUpload && (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFile(null); setUploadProgress(0); }}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}
          >
            <Upload size={15} /> Upload Dokumen
          </motion.button>
        )}
      </div>

      {/* Category filter tabs */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, overflowX: "auto",
      }}>
        {[{ key: "all", label: "Semua" }, ...CATEGORIES.map(c => ({ key: c, label: c }))].map(t => (
          <button key={t.key} onClick={() => setCatFilter(t.key)} style={{
            padding: "14px 14px", border: "none", background: "transparent",
            cursor: "pointer", fontSize: 13, fontWeight: catFilter === t.key ? 700 : 500,
            color: catFilter === t.key ? "#f59e0b" : "#6b7280", whiteSpace: "nowrap",
            borderBottom: catFilter === t.key ? "2px solid #f59e0b" : "2px solid transparent",
            transition: "all 0.15s",
          }}>
            {t.label}
            {t.key !== "all" && (
              <span style={{
                marginLeft: 4, fontSize: 10, fontWeight: 700,
                background: catFilter === t.key ? "#fef3c7" : "#f3f4f6",
                color: catFilter === t.key ? "#d97706" : "#9ca3af",
                borderRadius: 20, padding: "1px 5px",
              }}>
                {t.key === "Lainnya"
                  ? docs.filter(d => !FIXED_CATS.includes(d.category)).length
                  : docs.filter(d => d.category.toLowerCase() === t.key.toLowerCase()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="board-main" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Search + controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 380 }}>
            <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text" placeholder="Cari dokumen..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 33px",
                border: "1.5px solid #e5e7eb", borderRadius: 10,
                fontSize: 13, color: "#111827", outline: "none",
                background: "#fff", boxSizing: "border-box", transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#f59e0b")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>

          {/* Sort buttons */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Urutkan:</span>
            {renderSortButton("date", "Tanggal")}
            {renderSortButton("name", "Nama")}
            {renderSortButton("size", "Ukuran")}
            {renderSortButton("category", "Kategori")}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", border: "1.5px solid #e5e7eb", borderRadius: 9, overflow: "hidden" }}>
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: "6px 10px", border: "none", cursor: "pointer",
                background: viewMode === v ? "#f59e0b" : "#fff",
                display: "flex", alignItems: "center", transition: "background 0.15s",
              }}>
                {v === "grid" ? <LayoutGrid size={14} color={viewMode === v ? "#fff" : "#9ca3af"} />
                              : <List size={14} color={viewMode === v ? "#fff" : "#9ca3af"} />}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada dokumen</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
              {canUpload ? "Upload dokumen pertama untuk tim" : "Belum ada dokumen yang dibagikan"}
            </p>
            {canUpload && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowModal(true)}
                style={{ marginTop: 20, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Upload Sekarang
              </motion.button>
            )}
          </motion.div>
        ) : viewMode === "grid" ? (

          /* ── Grid View ── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <AnimatePresence mode="popLayout">
              {sorted.map((doc, i) => {
                const fileColor = getFileColor(doc.file_type);
                const catStyle = CAT_COLOR[doc.category] ?? CAT_COLOR["Lainnya"];
                const uploader = (doc.profiles as any)?.full_name || "—";
                const canEdit = canManage || doc.uploaded_by === currentUser.id;
                return (
                  <motion.div key={doc.id} layout
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.93 }}
                    transition={{ delay: i * 0.03, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      background: doc.is_locked ? "#fffbfb" : "#fff",
                      border: doc.is_locked ? "1px solid #fecaca" : "1px solid #f3f4f6",
                      borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10,
                      boxShadow: doc.is_locked ? "0 1px 8px rgba(239,68,68,0.07)" : "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* File preview area */}
                    <div
                      onClick={() => openPreview(doc)}
                      style={{
                        position: "relative", width: "100%", height: 80, borderRadius: 10,
                        background: doc.is_locked ? "#fff1f1" : `${fileColor}12`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", overflow: "hidden",
                      }}
                    >
                      {isImage(doc.file_type) && !doc.is_locked ? (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: fileColor, opacity: 0.5 }}>{getFileIcon(doc.file_type, 22)}</span>
                        </div>
                      ) : (
                        <span style={{ color: doc.is_locked ? "#ef4444" : fileColor, opacity: doc.is_locked ? 0.3 : 1 }}>
                          {getFileIcon(doc.file_type, 22)}
                        </span>
                      )}
                      {doc.is_locked ? (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{
                            background: "linear-gradient(135deg, #ef4444, #dc2626)", borderRadius: 10,
                            padding: "5px 9px", display: "flex", alignItems: "center", gap: 4,
                            boxShadow: "0 4px 12px rgba(239,68,68,0.35)",
                          }}>
                            <Lock size={11} color="#fff" />
                            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>RAHASIA</span>
                          </div>
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                          style={{
                            position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: 10,
                          }}
                        >
                          <ZoomIn size={20} color="#fff" />
                        </motion.div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 700, color: "#111827", flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{doc.title}</p>
                        {doc.is_locked && <Lock size={10} color="#ef4444" style={{ flexShrink: 0 }} />}
                      </div>
                      {doc.description && (
                        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.description}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}>
                          {doc.category}
                        </span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{fmtSize(doc.file_size)}</span>
                      </div>
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{uploader} · {fmtDate(doc.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 5 }}>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handleDownload(doc)}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          padding: "7px",
                          border: doc.is_locked ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                          borderRadius: 8, background: doc.is_locked ? "#fff5f5" : "#fff",
                          cursor: "pointer", fontSize: 11, fontWeight: 600,
                          color: doc.is_locked ? "#dc2626" : "#374151",
                        }}>
                        {doc.is_locked ? <Lock size={11} /> : <Download size={11} />}
                        {doc.is_locked ? "Buka" : "Unduh"}
                      </motion.button>
                      {canEdit && (
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                          onClick={() => openEdit(doc)}
                          style={{ padding: "7px 9px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex" }}>
                          <Edit3 size={11} color="#6b7280" />
                        </motion.button>
                      )}
                      {canEdit && (
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setDeleteId(doc.id)}
                          style={{ padding: "7px 9px", border: "1px solid #fee2e2", borderRadius: 8, background: "#fff", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={11} color="#ef4444" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

        ) : (

          /* ── List View ── */
          <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            {/* List header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 80px 120px auto",
              padding: "10px 16px", background: "#f9fafb",
              borderBottom: "1px solid #f3f4f6", gap: 12,
            }}>
              {[
                { field: "name" as SortField, label: "Nama" },
                { field: "category" as SortField, label: "Kategori" },
                { field: "size" as SortField, label: "Ukuran" },
                { field: "date" as SortField, label: "Tanggal" },
              ].map(h => (
                <button key={h.field} onClick={() => toggleSort(h.field)} style={{
                  display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 11, fontWeight: 700, color: sortBy === h.field ? "#f59e0b" : "#9ca3af", padding: 0,
                }}>
                  {h.label}
                  {sortBy === h.field
                    ? sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    : <ArrowUpDown size={10} color="#d1d5db" />}
                </button>
              ))}
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>Aksi</span>
            </div>

            <AnimatePresence>
              {sorted.map((doc, i) => {
                const fileColor = getFileColor(doc.file_type);
                const catStyle = CAT_COLOR[doc.category] ?? CAT_COLOR["Lainnya"];
                const uploader = (doc.profiles as any)?.full_name || "—";
                const canEdit = canManage || doc.uploaded_by === currentUser.id;
                return (
                  <motion.div key={doc.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.02, duration: 0.18 }}
                    style={{
                      display: "grid", gridTemplateColumns: "2fr 1fr 80px 120px auto",
                      padding: "11px 16px", gap: 12, alignItems: "center",
                      borderBottom: i < sorted.length - 1 ? "1px solid #f9fafb" : "none",
                      background: doc.is_locked ? "#fffbfb" : "#fff",
                    }}
                  >
                    {/* Name + icon */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: doc.is_locked ? "#fee2e2" : `${fileColor}15`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {doc.is_locked
                          ? <Lock size={14} color="#ef4444" />
                          : <span style={{ color: fileColor }}>{getFileIcon(doc.file_type, 14)}</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.title}
                        </p>
                        <p style={{ fontSize: 10, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {uploader} · {doc.file_name}
                        </p>
                      </div>
                    </div>

                    {/* Category */}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, width: "fit-content" }}>
                      {doc.category}
                    </span>

                    {/* Size */}
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtSize(doc.file_size)}</span>

                    {/* Date */}
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(doc.created_at)}</span>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4 }}>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                        onClick={() => openPreview(doc)}
                        title="Preview"
                        style={{ padding: "6px 7px", border: "1px solid #e5e7eb", borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex" }}>
                        <ZoomIn size={12} color="#6b7280" />
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleDownload(doc)}
                        title={doc.is_locked ? "Buka Kunci" : "Download"}
                        style={{
                          padding: "6px 7px", borderRadius: 7, cursor: "pointer", display: "flex",
                          border: doc.is_locked ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                          background: doc.is_locked ? "#fff5f5" : "#fff",
                        }}>
                        {doc.is_locked ? <Lock size={12} color="#dc2626" /> : <Download size={12} color="#6b7280" />}
                      </motion.button>
                      {canEdit && (
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                          onClick={() => openEdit(doc)} title="Edit"
                          style={{ padding: "6px 7px", border: "1px solid #e5e7eb", borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex" }}>
                          <Edit3 size={12} color="#6b7280" />
                        </motion.button>
                      )}
                      {canEdit && (
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setDeleteId(doc.id)} title="Hapus"
                          style={{ padding: "6px 7px", border: "1px solid #fee2e2", borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={12} color="#ef4444" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Load more */}
        {sorted.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingBottom: 8 }}>
            {search === "" && catFilter === "all" && hasMore && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleLoadMore} disabled={loadingMore}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 22px", border: "1.5px solid #e5e7eb", borderRadius: 12,
                  background: "#fff", cursor: loadingMore ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600, color: "#374151",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                {loadingMore ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      style={{ width: 13, height: 13, border: "2px solid #e5e7eb", borderTopColor: "#f59e0b", borderRadius: "50%" }} />
                    Memuat...
                  </>
                ) : <>Muat {Math.min(pageSize, serverTotal - docs.length)} dokumen lagi</>}
              </motion.button>
            )}
            <p style={{ fontSize: 11, color: "#d1d5db" }}>
              {search !== "" || catFilter !== "all"
                ? `${sorted.length} hasil dari ${docs.length} dokumen yang dimuat`
                : `${docs.length} dari ${serverTotal} dokumen dimuat`}
            </p>
          </div>
        )}
      </div>

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Upload Dokumen</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                <motion.div whileHover={{ borderColor: "#f59e0b", background: "#fffbeb" }}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: "2px dashed #e5e7eb", borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer", transition: "all 0.15s", background: file ? "#fffbeb" : "#f9fafb" }}>
                  {file ? (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{file.name}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{fmtSize(file.size)}</p>
                      <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>Klik untuk ganti file</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={28} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Klik untuk pilih file</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Semua format didukung · Maks 50MB</p>
                    </div>
                  )}
                </motion.div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nama Dokumen <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" placeholder="Nama dokumen..." value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kategori</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => {
                      const s = CAT_COLOR[cat] ?? CAT_COLOR["Lainnya"];
                      const isActive = cat === "Lainnya"
                        ? !FIXED_CATS.includes(form.category)
                        : form.category === cat;
                      return (
                        <motion.button key={cat} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setForm(f => ({ ...f, category: cat === "Lainnya" ? "Lainnya" : cat }))}
                          style={{
                            padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                            border: isActive ? `1.5px solid ${s.text}` : "1.5px solid #e5e7eb",
                            background: isActive ? s.bg : "#f9fafb",
                            color: isActive ? s.text : "#9ca3af", transition: "all 0.12s",
                          }}>{cat}</motion.button>
                      );
                    })}
                  </div>
                  {!FIXED_CATS.includes(form.category) && (
                    <input
                      type="text"
                      placeholder="Ketik kategori lainnya..."
                      value={form.category === "Lainnya" ? "" : form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value.trim() || "Lainnya" }))}
                      style={{ marginTop: 8, width: "100%", padding: "8px 12px", border: "1.5px solid #fde68a", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea rows={2} placeholder="Deskripsi singkat..." value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                {/* Rahasia toggle */}
                <div style={{ border: form.is_locked ? "1.5px solid #fca5a5" : "1.5px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", background: form.is_locked ? "#fff5f5" : "#f9fafb", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: form.is_locked ? "linear-gradient(135deg,#ef4444,#dc2626)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                        <Lock size={14} color={form.is_locked ? "#fff" : "#9ca3af"} />
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: form.is_locked ? "#dc2626" : "#374151" }}>Dokumen Rahasia</p>
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>Dilindungi password saat diunduh</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, is_locked: !f.is_locked, password: "" }))}
                      style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: form.is_locked ? "#ef4444" : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <motion.div animate={{ x: form.is_locked ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: 10, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {form.is_locked && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
                        <div style={{ marginTop: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", display: "block", marginBottom: 5 }}>Password <span style={{ color: "#ef4444" }}>*</span></label>
                          <div style={{ position: "relative" }}>
                            <KeyRound size={13} color="#ef4444" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                            <input type={showUploadPass ? "text" : "password"} placeholder="Buat password rahasia..." value={form.password}
                              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                              style={{ width: "100%", padding: "9px 36px 9px 30px", border: "1.5px solid #fca5a5", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }}
                              onFocus={e => (e.target.style.borderColor = "#ef4444")} onBlur={e => (e.target.style.borderColor = "#fca5a5")} />
                            <button type="button" onClick={() => setShowUploadPass(p => !p)}
                              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", padding: 2 }}>
                              {showUploadPass ? <EyeOff size={13} color="#9ca3af" /> : <Eye size={13} color="#9ca3af" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {uploading && (
                  <div>
                    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }}
                        style={{ height: "100%", background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 3 }} />
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "center" }}>Mengupload... {uploadProgress}%</p>
                  </div>
                )}

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={uploading || !file || !form.title.trim() || (form.is_locked && !form.password.trim())}
                  style={{
                    width: "100%", padding: "12px",
                    background: uploading || !file || !form.title.trim() || (form.is_locked && !form.password.trim()) ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: uploading || !file ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(245,158,11,0.3)", transition: "all 0.2s",
                  }}>
                  {uploading ? `Mengupload ${uploadProgress}%...` : "Upload Dokumen"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Metadata Modal ── */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setEditTarget(null); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Edit3 size={14} color="#3b82f6" />
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Edit Dokumen</h2>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setEditTarget(null)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={15} color="#6b7280" />
                </motion.button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nama Dokumen <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#3b82f6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kategori</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => {
                      const s = CAT_COLOR[cat] ?? CAT_COLOR["Lainnya"];
                      const isActive = cat === "Lainnya"
                        ? !FIXED_CATS.includes(editForm.category)
                        : editForm.category === cat;
                      return (
                        <motion.button key={cat} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setEditForm(f => ({ ...f, category: cat === "Lainnya" ? "Lainnya" : cat }))}
                          style={{
                            padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                            border: isActive ? `1.5px solid ${s.text}` : "1.5px solid #e5e7eb",
                            background: isActive ? s.bg : "#f9fafb",
                            color: isActive ? s.text : "#9ca3af", transition: "all 0.12s",
                          }}>{cat}</motion.button>
                      );
                    })}
                  </div>
                  {!FIXED_CATS.includes(editForm.category) && (
                    <input
                      type="text"
                      placeholder="Ketik kategori lainnya..."
                      value={editForm.category === "Lainnya" ? "" : editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value.trim() || "Lainnya" }))}
                      style={{ marginTop: 8, width: "100%", padding: "8px 12px", border: "1.5px solid #fde68a", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea rows={3} placeholder="Deskripsi singkat..." value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#3b82f6")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditTarget(null)}
                    style={{ flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    Batal
                  </button>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={handleSaveEdit} disabled={editSaving || !editForm.title.trim()}
                    style={{
                      flex: 2, padding: "11px",
                      background: editSaving || !editForm.title.trim() ? "#d1d5db" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                      border: "none", borderRadius: 10, cursor: "pointer",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      boxShadow: "0 4px 14px rgba(59,130,246,0.3)",
                    }}>
                    <Check size={14} /> {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Preview Modal ── */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setPreviewDoc(null); }}>

            {/* Preview topbar */}
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
              style={{ width: "100%", maxWidth: 860, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewDoc.title}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{previewDoc.file_name} · {fmtSize(previewDoc.file_size)}</p>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={() => handleDownload(previewDoc)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, background: "rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                <Download size={13} /> Unduh
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => setPreviewDoc(null)}
                style={{ padding: 8, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, background: "rgba(255,255,255,0.1)", cursor: "pointer", display: "flex" }}>
                <X size={16} color="#fff" />
              </motion.button>
            </motion.div>

            {/* Preview content */}
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: "100%", maxWidth: 860, maxHeight: "76vh", borderRadius: 16, overflow: "hidden", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
              {previewLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                  style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#f59e0b", borderRadius: "50%" }} />
              ) : !previewUrl ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                  <p style={{ color: "#9ca3af", fontSize: 14 }}>Gagal memuat preview</p>
                </div>
              ) : isImage(previewDoc.file_type) ? (
                <img src={previewUrl} alt={previewDoc.title}
                  style={{ maxWidth: "100%", maxHeight: "76vh", objectFit: "contain", display: "block" }} />
              ) : isPdf(previewDoc.file_type) ? (
                <iframe src={previewUrl} style={{ width: "100%", height: "76vh", border: "none" }} title={previewDoc.title} />
              ) : (
                <div style={{ textAlign: "center", padding: 48 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: `${getFileColor(previewDoc.file_type)}20`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <span style={{ color: getFileColor(previewDoc.file_type) }}>{getFileIcon(previewDoc.file_type, 30)}</span>
                  </div>
                  <p style={{ color: "#e5e7eb", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Preview tidak tersedia</p>
                  <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Format ini tidak dapat ditampilkan langsung</p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleDownload(previewDoc)}
                    style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 auto", padding: "10px 20px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    <Download size={14} /> Download untuk membuka
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Dokumen?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>File akan dihapus permanen dari storage.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Batal
                </button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(deleteId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  Hapus
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Password prompt modal ── */}
      <AnimatePresence>
        {lockTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) { setLockTarget(null); setPendingPreviewAfterUnlock(false); } }}>
            <motion.div animate={lockShake ? { x: [0, -10, 10, -8, 8, -5, 5, 0], transition: { duration: 0.5 } } : {}}>
              <motion.div initial={{ opacity: 0, scale: 0.88, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: "#fff", borderRadius: 22, width: "100%", maxWidth: 400, boxShadow: "0 30px 70px rgba(0,0,0,0.22)", overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", padding: "28px 24px 22px", textAlign: "center", position: "relative" }}>
                  <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
                    style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", border: "2px solid rgba(255,255,255,0.25)" }}>
                    <Lock size={26} color="#fff" />
                  </motion.div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Dokumen Rahasia</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", maxWidth: 260, margin: "0 auto" }}>
                    Masukkan password untuk {pendingPreviewAfterUnlock ? "melihat preview" : "mengunduh"}
                  </p>
                  <button onClick={() => { setLockTarget(null); setPendingPreviewAfterUnlock(false); }}
                    style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
                    <X size={15} color="#fff" />
                  </button>
                </div>
                <div style={{ padding: "22px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ShieldAlert size={14} color="#ef4444" />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{lockTarget.title}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af" }}>{lockTarget.file_name} · {fmtSize(lockTarget.file_size)}</p>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={14} color={lockError ? "#ef4444" : "#9ca3af"} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                      <input type={showLockPass ? "text" : "password"} placeholder="Masukkan password..."
                        value={lockInput} autoFocus
                        onChange={e => { setLockInput(e.target.value); setLockError(false); }}
                        onKeyDown={e => { if (e.key === "Enter") handlePasswordSubmit(); }}
                        style={{ width: "100%", padding: "11px 36px 11px 32px", border: `1.5px solid ${lockError ? "#ef4444" : "#e5e7eb"}`, borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: lockError ? "#fff5f5" : "#fff", transition: "border-color 0.15s" }}
                        onFocus={e => { if (!lockError) e.target.style.borderColor = "#ef4444"; }}
                        onBlur={e => { if (!lockError) e.target.style.borderColor = "#e5e7eb"; }} />
                      <button type="button" onClick={() => setShowLockPass(p => !p)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", padding: 2 }}>
                        {showLockPass ? <EyeOff size={14} color="#9ca3af" /> : <Eye size={14} color="#9ca3af" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {lockError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{ fontSize: 11, color: "#ef4444", marginTop: 5, fontWeight: 600 }}>
                          Password salah. Coba lagi.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setLockTarget(null); setPendingPreviewAfterUnlock(false); }}
                      style={{ flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      Batal
                    </button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handlePasswordSubmit}
                      style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 14px rgba(239,68,68,0.35)" }}>
                      {pendingPreviewAfterUnlock ? <ZoomIn size={14} /> : <Download size={14} />}
                      {pendingPreviewAfterUnlock ? "Buka Preview" : "Buka & Unduh"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: toast.ok ? "#111827" : "#ef4444", color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8 }}>
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
