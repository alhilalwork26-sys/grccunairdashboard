"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Document } from "@/types";
import {
  FolderOpen, X, Check, Search, Download,
  Trash2, FileText, Image, FileArchive, File,
  Upload, Lock, Eye, EyeOff, KeyRound, ShieldAlert,
} from "lucide-react";

const CATEGORIES = ["Umum", "Keuangan", "Marketing", "Pelatihan", "HR", "Legal", "Lainnya"];

const CAT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  Umum:      { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
  Keuangan:  { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  Marketing: { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
  Pelatihan: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  HR:        { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  Legal:     { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  Lainnya:   { bg: "#fff7ed", text: "#7c2d12", border: "#fed7aa" },
};

function getFileIcon(type: string | null | undefined) {
  if (!type) return <File size={20} />;
  if (type.startsWith("image/")) return <Image size={20} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return <FileArchive size={20} />;
  return <FileText size={20} />;
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

const EMPTY_FORM = { title: "", description: "", category: "Umum", is_locked: false, password: "" };

interface Props {
  currentUser: UserProfile;
  initialDocs: Document[];
  totalCount: number;
  pageSize: number;
}

export default function DocsBoard({ currentUser, initialDocs, totalCount, pageSize }: Props) {
  const supabase = createClient();
  const canManage = ["super_admin", "manager", "program_admin"].includes(currentUser.role);

  const [docs, setDocs] = useState<Document[]>(initialDocs);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [lockTarget, setLockTarget] = useState<Document | null>(null);
  const [lockInput, setLockInput] = useState("");
  const [lockError, setLockError] = useState(false);
  const [lockShake, setLockShake] = useState(false);
  const [showUploadPass, setShowUploadPass] = useState(false);
  const [showLockPass, setShowLockPass] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverTotal, setServerTotal] = useState(totalCount);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasMore = docs.length < serverTotal;

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

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

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
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `${currentUser.id}/${fileName}`;

    setUploadProgress(30);
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      showToast("Gagal upload: " + uploadError.message, false);
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    setUploadProgress(70);
    const { data, error: dbError } = await supabase
      .from("documents")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category: form.category,
        uploaded_by: currentUser.id,
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
      setShowModal(false);
      setForm(EMPTY_FORM);
      setFile(null);
      setUploadProgress(0);
    }
    setUploading(false);
  };

  const handleDownload = async (doc: Document) => {
    if (doc.is_locked) {
      setLockTarget(doc);
      setLockInput("");
      setLockError(false);
      setShowLockPass(false);
      return;
    }
    await doDownload(doc);
  };

  const doDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (error || !data) { showToast("Gagal membuat link download", false); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.file_name;
    a.click();
    showToast(`Mengunduh ${doc.file_name}`);
  };

  const handlePasswordSubmit = async () => {
    if (!lockTarget) return;
    if (btoa(lockInput) !== lockTarget.password_hash) {
      setLockError(true);
      setLockShake(true);
      setTimeout(() => setLockShake(false), 600);
      return;
    }
    const target = lockTarget;
    setLockTarget(null);
    await doDownload(target);
  };

  const handleDelete = async (id: string) => {
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    await supabase.storage.from("documents").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) showToast("Gagal menghapus", false);
    else { setDocs(prev => prev.filter(d => d.id !== id)); setServerTotal(t => t - 1); showToast("Dokumen dihapus"); }
    setDeleteId(null);
  };

  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.file_name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.category.toLowerCase() === catFilter.toLowerCase();
    return matchSearch && matchCat;
  });

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
        {canManage && (
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

      {/* Filter tabs */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, overflowX: "auto",
      }}>
        {[{ key: "all", label: "Semua" }, ...CATEGORIES.map(c => ({ key: c, label: c }))].map(t => (
          <button
            key={t.key}
            onClick={() => setCatFilter(t.key)}
            style={{
              padding: "14px 14px", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: catFilter === t.key ? 700 : 500,
              color: catFilter === t.key ? "#f59e0b" : "#6b7280", whiteSpace: "nowrap",
              borderBottom: catFilter === t.key ? "2px solid #f59e0b" : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {t.label}
            {t.key !== "all" && (
              <span style={{
                marginLeft: 4, fontSize: 10, fontWeight: 700,
                background: catFilter === t.key ? "#fef3c7" : "#f3f4f6",
                color: catFilter === t.key ? "#d97706" : "#9ca3af",
                borderRadius: 20, padding: "1px 5px",
              }}>
                {docs.filter(d => d.category.toLowerCase() === t.key.toLowerCase()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Search */}
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text" placeholder="Cari dokumen..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 36px",
              border: "1.5px solid #e5e7eb", borderRadius: 10,
              fontSize: 13, color: "#111827", outline: "none",
              background: "#fff", boxSizing: "border-box", transition: "border-color 0.15s",
            }}
            onFocus={e => (e.target.style.borderColor = "#f59e0b")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* File grid */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16,
              padding: "60px 40px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada dokumen</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
              {canManage ? "Upload dokumen pertama untuk tim" : "Belum ada dokumen yang dibagikan"}
            </p>
            {canManage && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowModal(true)}
                style={{
                  marginTop: 20, background: "#f59e0b", color: "#fff", border: "none",
                  borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Upload Sekarang
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((doc, i) => {
                const fileColor = getFileColor(doc.file_type);
                const catStyle = CAT_COLOR[doc.category] ?? CAT_COLOR["Umum"];
                const uploader = (doc.profiles as any)?.full_name || "—";
                return (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.93 }}
                    transition={{ delay: i * 0.04, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      background: doc.is_locked ? "#fffbfb" : "#fff",
                      border: doc.is_locked ? "1px solid #fecaca" : "1px solid #f3f4f6",
                      borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10,
                      boxShadow: doc.is_locked ? "0 1px 8px rgba(239,68,68,0.07)" : "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* File icon */}
                    <div style={{
                      position: "relative", width: "100%", height: 72, borderRadius: 10,
                      background: doc.is_locked ? "#fff1f1" : `${fileColor}12`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ color: doc.is_locked ? "#ef4444" : fileColor, opacity: doc.is_locked ? 0.4 : 1 }}>
                        {getFileIcon(doc.file_type)}
                      </span>
                      {doc.is_locked && (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            borderRadius: 10, padding: "6px 10px",
                            display: "flex", alignItems: "center", gap: 5,
                            boxShadow: "0 4px 12px rgba(239,68,68,0.35)",
                          }}>
                            <Lock size={13} color="#fff" />
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>RAHASIA</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 700, color: "#111827",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                        }}>
                          {doc.title}
                        </p>
                        {doc.is_locked && <Lock size={11} color="#ef4444" style={{ flexShrink: 0 }} />}
                      </div>
                      {doc.description && (
                        <p style={{
                          fontSize: 11, color: "#9ca3af", marginTop: 2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {doc.description}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                          background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                        }}>
                          {doc.category}
                        </span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{fmtSize(doc.file_size)}</span>
                      </div>
                      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 5 }}>
                        {uploader} · {fmtDate(doc.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handleDownload(doc)}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          padding: "8px",
                          border: doc.is_locked ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                          borderRadius: 8,
                          background: doc.is_locked ? "#fff5f5" : "#fff",
                          cursor: "pointer", fontSize: 12, fontWeight: 600,
                          color: doc.is_locked ? "#dc2626" : "#374151",
                        }}
                      >
                        {doc.is_locked ? <Lock size={13} /> : <Download size={13} />}
                        {doc.is_locked ? "Buka Kunci" : "Download"}
                      </motion.button>
                      {(canManage || doc.uploaded_by === currentUser.id) && (
                        <motion.button
                          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setDeleteId(doc.id)}
                          style={{
                            padding: "8px 10px", border: "1px solid #fee2e2", borderRadius: 8,
                            background: "#fff", cursor: "pointer", display: "flex",
                          }}
                        >
                          <Trash2 size={13} color="#ef4444" />
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
        {filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 8 }}>
            {search === "" && catFilter === "all" && hasMore && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 24px", border: "1.5px solid #e5e7eb", borderRadius: 12,
                  background: "#fff", cursor: loadingMore ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600, color: "#374151",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                {loadingMore ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      style={{ width: 14, height: 14, border: "2px solid #e5e7eb", borderTopColor: "#f59e0b", borderRadius: "50%" }}
                    />
                    Memuat...
                  </>
                ) : (
                  <>Muat {Math.min(pageSize, serverTotal - docs.length)} dokumen lagi</>
                )}
              </motion.button>
            )}
            <p style={{ fontSize: 11, color: "#d1d5db" }}>
              {search !== "" || catFilter !== "all"
                ? `${filtered.length} hasil dari ${docs.length} dokumen yang dimuat`
                : `${docs.length} dari ${serverTotal} dokumen dimuat`}
            </p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Upload Dokumen</h2>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* File drop zone */}
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                <motion.div
                  whileHover={{ borderColor: "#f59e0b", background: "#fffbeb" }}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: "2px dashed #e5e7eb", borderRadius: 12, padding: "24px 16px",
                    textAlign: "center", cursor: "pointer", transition: "all 0.15s",
                    background: file ? "#fffbeb" : "#f9fafb",
                  }}
                >
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

                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Nama Dokumen <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input type="text" placeholder="Nama dokumen..." value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                {/* Category */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kategori</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => {
                      const s = CAT_COLOR[cat] ?? CAT_COLOR["Umum"];
                      return (
                        <motion.button
                          key={cat} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setForm(f => ({ ...f, category: cat }))}
                          style={{
                            padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                            border: form.category === cat ? `1.5px solid ${s.text}` : "1.5px solid #e5e7eb",
                            background: form.category === cat ? s.bg : "#f9fafb",
                            color: form.category === cat ? s.text : "#9ca3af", transition: "all 0.12s",
                          }}
                        >{cat}</motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Deskripsi</label>
                  <textarea rows={2} placeholder="Deskripsi singkat..." value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                {/* Rahasia toggle */}
                <div style={{
                  border: form.is_locked ? "1.5px solid #fca5a5" : "1.5px solid #e5e7eb",
                  borderRadius: 12, padding: "12px 14px",
                  background: form.is_locked ? "#fff5f5" : "#f9fafb",
                  transition: "all 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: form.is_locked ? "linear-gradient(135deg,#ef4444,#dc2626)" : "#f3f4f6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                      }}>
                        {form.is_locked
                          ? <Lock size={14} color="#fff" />
                          : <Lock size={14} color="#9ca3af" />}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: form.is_locked ? "#dc2626" : "#374151" }}>
                          Dokumen Rahasia
                        </p>
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                          Dilindungi password saat diunduh
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_locked: !f.is_locked, password: "" }))}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                        background: form.is_locked ? "#ef4444" : "#d1d5db",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <motion.div
                        animate={{ x: form.is_locked ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{
                          position: "absolute", top: 2, left: 2,
                          width: 20, height: 20, borderRadius: 10,
                          background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {form.is_locked && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ marginTop: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", display: "block", marginBottom: 5 }}>
                            Password <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <div style={{ position: "relative" }}>
                            <KeyRound size={13} color="#ef4444" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                            <input
                              type={showUploadPass ? "text" : "password"}
                              placeholder="Buat password rahasia..."
                              value={form.password}
                              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                              style={{
                                width: "100%", padding: "9px 36px 9px 30px",
                                border: "1.5px solid #fca5a5", borderRadius: 8,
                                fontSize: 13, outline: "none", boxSizing: "border-box",
                                fontFamily: "inherit", background: "#fff",
                              }}
                              onFocus={e => (e.target.style.borderColor = "#ef4444")}
                              onBlur={e => (e.target.style.borderColor = "#fca5a5")}
                            />
                            <button
                              type="button"
                              onClick={() => setShowUploadPass(p => !p)}
                              style={{
                                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                border: "none", background: "transparent", cursor: "pointer", padding: 2,
                              }}
                            >
                              {showUploadPass ? <EyeOff size={13} color="#9ca3af" /> : <Eye size={13} color="#9ca3af" />}
                            </button>
                          </div>
                          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                            Password diperlukan setiap kali dokumen ini diunduh
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Progress bar */}
                {uploading && (
                  <div>
                    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        style={{ height: "100%", background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 3 }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "center" }}>Mengupload... {uploadProgress}%</p>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={uploading || !file || !form.title.trim() || (form.is_locked && !form.password.trim())}
                  style={{
                    width: "100%", padding: "12px",
                    background: uploading || !file || !form.title.trim() || (form.is_locked && !form.password.trim()) ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: uploading || !file ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(245,158,11,0.3)", transition: "all 0.2s",
                  }}
                >
                  {uploading ? `Mengupload ${uploadProgress}%...` : "Upload Dokumen"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}
            >
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

      {/* Password prompt modal */}
      <AnimatePresence>
        {lockTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setLockTarget(null); }}
          >
            <motion.div
              animate={lockShake ? {
                x: [0, -10, 10, -8, 8, -5, 5, 0],
                transition: { duration: 0.5, ease: "easeInOut" },
              } : {}}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: "#fff", borderRadius: 22, width: "100%", maxWidth: 400,
                  boxShadow: "0 30px 70px rgba(0,0,0,0.22)", overflow: "hidden",
                }}
              >
                {/* Header gradient */}
                <div style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  padding: "28px 24px 22px", textAlign: "center", position: "relative",
                }}>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
                    style={{
                      width: 60, height: 60, borderRadius: 18,
                      background: "rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 12px", border: "2px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    <Lock size={26} color="#fff" />
                  </motion.div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Dokumen Rahasia</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", maxWidth: 260, margin: "0 auto" }}>
                    Masukkan password untuk mengunduh
                  </p>
                  <button
                    onClick={() => setLockTarget(null)}
                    style={{
                      position: "absolute", top: 14, right: 14,
                      background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                      padding: 6, cursor: "pointer", display: "flex",
                    }}
                  >
                    <X size={15} color="#fff" />
                  </button>
                </div>

                <div style={{ padding: "22px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Doc info */}
                  <div style={{
                    background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10,
                    padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: "#fee2e2",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <ShieldAlert size={14} color="#ef4444" />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{lockTarget.title}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af" }}>{lockTarget.file_name} · {fmtSize(lockTarget.file_size)}</p>
                    </div>
                  </div>

                  {/* Password input */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound size={14} color={lockError ? "#ef4444" : "#9ca3af"} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                      <input
                        type={showLockPass ? "text" : "password"}
                        placeholder="Masukkan password..."
                        value={lockInput}
                        autoFocus
                        onChange={e => { setLockInput(e.target.value); setLockError(false); }}
                        onKeyDown={e => { if (e.key === "Enter") handlePasswordSubmit(); }}
                        style={{
                          width: "100%", padding: "11px 36px 11px 32px",
                          border: `1.5px solid ${lockError ? "#ef4444" : "#e5e7eb"}`,
                          borderRadius: 10, fontSize: 13, outline: "none",
                          boxSizing: "border-box", fontFamily: "inherit",
                          background: lockError ? "#fff5f5" : "#fff",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onFocus={e => { if (!lockError) e.target.style.borderColor = "#ef4444"; }}
                        onBlur={e => { if (!lockError) e.target.style.borderColor = "#e5e7eb"; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLockPass(p => !p)}
                        style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          border: "none", background: "transparent", cursor: "pointer", padding: 2,
                        }}
                      >
                        {showLockPass ? <EyeOff size={14} color="#9ca3af" /> : <Eye size={14} color="#9ca3af" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {lockError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{ fontSize: 11, color: "#ef4444", marginTop: 5, fontWeight: 600 }}
                        >
                          Password salah. Coba lagi.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setLockTarget(null)}
                      style={{
                        flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 10,
                        background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
                      }}
                    >
                      Batal
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handlePasswordSubmit}
                      style={{
                        flex: 2, padding: "11px",
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        border: "none", borderRadius: 10, cursor: "pointer",
                        fontSize: 13, fontWeight: 700, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
                      }}
                    >
                      <Download size={14} /> Buka & Unduh
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              background: toast.ok ? "#111827" : "#ef4444",
              color: "#fff", borderRadius: 12, padding: "12px 18px",
              fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
