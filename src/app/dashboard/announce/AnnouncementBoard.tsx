"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import { createAnnouncementAction } from "./actions";
import {
  Plus, X, Check, Pin, PinOff, Megaphone,
  Edit2, Trash2, Bell, Info, AlertTriangle, PartyPopper, ImagePlus, ChevronLeft, ChevronRight,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "event";
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  image_urls?: string[] | null;
  profiles?: { full_name: string; role: string } | null;
}

const TYPE_CFG = {
  info:    { label: "Info",    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", icon: <Info size={14} /> },
  warning: { label: "Penting", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: <AlertTriangle size={14} /> },
  success: { label: "Sukses",  color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", icon: <Check size={14} /> },
  event:   { label: "Event",   color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", icon: <PartyPopper size={14} /> },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", manager: "Manager", program_admin: "Program Admin",
  kep_marketing: "Kep. Marketing", staff_kreatif: "Staff Kreatif",
  staff_marketing: "Staff Marketing", kep_finance: "Kep. Finance",
  staff_finance: "Staff Finance", staff_dokumen: "Staff Dokumen",
  kep_trainer: "Kep. Trainer",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const EMPTY_FORM = { title: "", content: "", type: "info" as Announcement["type"], pinned: false };

interface Props {
  currentUser: UserProfile;
  initialAnnouncements: Announcement[];
}

export default function AnnouncementBoard({ currentUser, initialAnnouncements }: Props) {
  const supabase = createClient();
  const canManage = ["super_admin", "manager", "program_admin"].includes(currentUser.role);

  const [items, setItems] = useState<Announcement[]>(initialAnnouncements);
  const [filter, setFilter] = useState<"all" | Announcement["type"]>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPendingImages([]);
    setExistingImageUrls([]);
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, type: a.type, pinned: a.pinned });
    setPendingImages([]);
    setExistingImageUrls(a.image_urls ?? []);
    setShowModal(true);
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("announcement-images").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("announcement-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      let imageUrls = [...existingImageUrls];
      if (pendingImages.length > 0) {
        setImageUploading(true);
        const newUrls = await uploadImages(pendingImages);
        setImageUploading(false);
        imageUrls = [...imageUrls, ...newUrls];
      }

      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        pinned: form.pinned,
        image_urls: imageUrls,
        created_by: currentUser.id,
      };

      if (editing) {
        const { data, error } = await supabase
          .from("announcements").update(payload).eq("id", editing.id)
          .select("*, profiles(full_name, role)").single();
        if (error) showToast("Gagal memperbarui", false);
        else {
          setItems(prev => prev.map(a => a.id === editing.id ? data : a)
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
          showToast("Pengumuman diperbarui");
          setShowModal(false);
        }
      } else {
        const { data, error } = await createAnnouncementAction(payload);
        if (error) showToast("Gagal menyimpan", false);
        else {
          setItems(prev => [data as unknown as Announcement, ...prev].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
          showToast("Pengumuman ditambahkan");
          setShowModal(false);
        }
      }
    } finally {
      setSubmitting(false);
      setImageUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) showToast("Gagal menghapus", false);
    else { setItems(prev => prev.filter(a => a.id !== id)); showToast("Pengumuman dihapus"); }
    setDeleteId(null);
  };

  const togglePin = async (a: Announcement) => {
    const { data, error } = await supabase
      .from("announcements").update({ pinned: !a.pinned }).eq("id", a.id)
      .select("*, profiles(full_name, role)").single();
    if (!error && data) {
      setItems(prev => prev.map(x => x.id === a.id ? data : x)
        .sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0)));
      showToast(a.pinned ? "Pin dilepas" : "Pengumuman dipinned");
    }
  };

  const filtered = filter === "all" ? items : items.filter(a => a.type === filter);
  const pinned = filtered.filter(a => a.pinned);
  const unpinned = filtered.filter(a => !a.pinned);

  const TABS: { key: "all" | Announcement["type"]; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "info", label: "Info" },
    { key: "warning", label: "Penting" },
    { key: "success", label: "Sukses" },
    { key: "event", label: "Event" },
  ];

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
            <Megaphone size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Announcement</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              {items.length} pengumuman · {items.filter(a => a.pinned).length} dipinned
            </p>
          </div>
        </div>
        {canManage && (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={openCreate}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}
          >
            <Plus size={15} />
            Buat Pengumuman
          </motion.button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center", gap: 4,
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: "14px 16px", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: filter === t.key ? 700 : 500,
              color: filter === t.key ? "#f59e0b" : "#6b7280",
              borderBottom: filter === t.key ? "2px solid #f59e0b" : "2px solid transparent",
              transition: "all 0.15s ease", position: "relative",
            }}
          >
            {t.label}
            {t.key !== "all" && (
              <span style={{
                marginLeft: 5, fontSize: 10, fontWeight: 700,
                background: filter === t.key ? "#fef3c7" : "#f3f4f6",
                color: filter === t.key ? "#d97706" : "#9ca3af",
                borderRadius: 20, padding: "1px 6px",
              }}>
                {items.filter(a => a.type === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="board-main" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16,
              padding: "60px 40px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>Belum ada pengumuman</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
              {canManage ? "Buat pengumuman pertama untuk tim" : "Belum ada pengumuman saat ini"}
            </p>
            {canManage && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={openCreate}
                style={{
                  marginTop: 20, background: "#f59e0b", color: "#fff", border: "none",
                  borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Buat Sekarang
              </motion.button>
            )}
          </motion.div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Pin size={13} color="#f59e0b" />
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Dipinned ({pinned.length})
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence mode="popLayout">
                    {pinned.map((a, i) => (
                      <AnnCard
                        key={a.id} item={a} index={i}
                        expanded={expandedId === a.id}
                        onExpand={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        canManage={canManage}
                        onEdit={() => openEdit(a)}
                        onDelete={() => setDeleteId(a.id)}
                        onPin={() => togglePin(a)}
                        onImageClick={(idx) => setLightbox({ urls: a.image_urls ?? [], idx })}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Regular */}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Bell size={13} color="#9ca3af" />
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Lainnya ({unpinned.length})
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence mode="popLayout">
                    {unpinned.map((a, i) => (
                      <AnnCard
                        key={a.id} item={a} index={i}
                        expanded={expandedId === a.id}
                        onExpand={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        canManage={canManage}
                        onEdit={() => openEdit(a)}
                        onDelete={() => setDeleteId(a.id)}
                        onPin={() => togglePin(a)}
                        onImageClick={(idx) => setLightbox({ urls: a.image_urls ?? [], idx })}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
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
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  {editing ? "Edit Pengumuman" : "Buat Pengumuman"}
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}
                >
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Type selector */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
                    Tipe Pengumuman
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    {(Object.entries(TYPE_CFG) as [Announcement["type"], typeof TYPE_CFG[keyof typeof TYPE_CFG]][]).map(([key, cfg]) => (
                      <motion.button
                        key={key}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setForm(f => ({ ...f, type: key }))}
                        style={{
                          padding: "10px 6px",
                          border: form.type === key ? `2px solid ${cfg.color}` : "2px solid #e5e7eb",
                          borderRadius: 10, background: form.type === key ? cfg.bg : "#f9fafb",
                          cursor: "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", gap: 4, transition: "all 0.15s",
                        }}
                      >
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: form.type === key ? cfg.color : "#9ca3af" }}>
                          {cfg.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Judul <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Judul pengumuman..."
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      fontSize: 13, color: "#111827", outline: "none",
                      fontFamily: "inherit", boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                {/* Content */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Isi Pengumuman <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Tulis isi pengumuman di sini..."
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      fontSize: 13, color: "#111827", resize: "vertical",
                      outline: "none", fontFamily: "inherit", lineHeight: 1.6,
                      boxSizing: "border-box", transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
                    Foto / Poster <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(opsional, maks. 5 foto)</span>
                  </label>

                  {/* Existing + pending thumbnails */}
                  {(existingImageUrls.length > 0 || pendingImages.length > 0) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {existingImageUrls.map((url, i) => (
                        <div key={`ex-${i}`} style={{ position: "relative", width: 72, height: 72 }}>
                          <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #e5e7eb" }} />
                          <button
                            onClick={() => setExistingImageUrls(p => p.filter((_, j) => j !== i))}
                            style={{
                              position: "absolute", top: -6, right: -6,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#ef4444", border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            }}
                          >
                            <X size={10} color="#fff" />
                          </button>
                        </div>
                      ))}
                      {pendingImages.map((file, i) => (
                        <div key={`pend-${i}`} style={{ position: "relative", width: 72, height: 72 }}>
                          <img src={URL.createObjectURL(file)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #e5e7eb" }} />
                          <button
                            onClick={() => setPendingImages(p => p.filter((_, j) => j !== i))}
                            style={{
                              position: "absolute", top: -6, right: -6,
                              width: 18, height: 18, borderRadius: "50%",
                              background: "#ef4444", border: "none", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            }}
                          >
                            <X size={10} color="#fff" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add photo button */}
                  {(existingImageUrls.length + pendingImages.length) < 5 && (
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "9px 14px", border: "1.5px dashed #d1d5db",
                      borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      color: "#6b7280", background: "#f9fafb",
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "#f59e0b"; (e.currentTarget as HTMLLabelElement).style.color = "#f59e0b"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "#d1d5db"; (e.currentTarget as HTMLLabelElement).style.color = "#6b7280"; }}
                    >
                      <ImagePlus size={15} />
                      Tambah Foto
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={e => {
                          const files = Array.from(e.target.files ?? []);
                          const remaining = 5 - existingImageUrls.length - pendingImages.length;
                          setPendingImages(p => [...p, ...files.slice(0, remaining)]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Pin toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                    style={{
                      width: 40, height: 22, borderRadius: 11,
                      background: form.pinned ? "#f59e0b" : "#e5e7eb",
                      position: "relative", transition: "background 0.2s", cursor: "pointer",
                    }}
                  >
                    <motion.div
                      animate={{ x: form.pinned ? 20 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{
                        position: "absolute", top: 3, width: 16, height: 16,
                        borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                    Pin pengumuman ini di atas
                  </span>
                </label>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.content.trim()}
                  style={{
                    width: "100%", padding: "12px",
                    background: submitting || !form.title.trim() || !form.content.trim()
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: submitting || !form.title.trim() || !form.content.trim() ? "not-allowed" : "pointer",
                    boxShadow: submitting ? "none" : "0 4px 14px rgba(245,158,11,0.35)",
                    transition: "all 0.2s",
                  }}
                >
                  {imageUploading ? "Mengupload foto..." : submitting ? "Menyimpan..." : editing ? "Perbarui" : "Publikasikan"}
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
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%",
                boxShadow: "0 25px 50px rgba(0,0,0,0.2)", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Pengumuman?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                Pengumuman ini akan dihapus permanen.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDeleteId(null)}
                  style={{
                    flex: 1, padding: "10px", border: "1px solid #e5e7eb",
                    borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
                  }}
                >Batal</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDelete(deleteId)}
                  style={{
                    flex: 1, padding: "10px", border: "none", borderRadius: 10,
                    background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff",
                  }}
                >Hapus</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 80,
              background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <button
              onClick={e => { e.stopPropagation(); setLightbox(null); }}
              style={{
                position: "absolute", top: 20, right: 20,
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "rgba(255,255,255,0.15)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={18} color="#fff" />
            </button>

            {lightbox.urls.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: (lb.idx - 1 + lb.urls.length) % lb.urls.length })); }}
                style={{
                  position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.15)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronLeft size={20} color="#fff" />
              </button>
            )}

            <motion.img
              key={lightbox.idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={lightbox.urls[lightbox.idx]}
              alt=""
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: "90vw", maxHeight: "85vh",
                borderRadius: 12, objectFit: "contain",
                boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              }}
            />

            {lightbox.urls.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: (lb.idx + 1) % lb.urls.length })); }}
                style={{
                  position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.15)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronRight size={20} color="#fff" />
              </button>
            )}

            {lightbox.urls.length > 1 && (
              <div style={{
                position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: 6,
              }}>
                {lightbox.urls.map((_, i) => (
                  <div
                    key={i}
                    onClick={e => { e.stopPropagation(); setLightbox(lb => lb && ({ ...lb, idx: i })); }}
                    style={{
                      width: i === lightbox.idx ? 20 : 6, height: 6, borderRadius: 3,
                      background: i === lightbox.idx ? "#fff" : "rgba(255,255,255,0.4)",
                      transition: "all 0.2s", cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              background: toast.ok ? "#111827" : "#ef4444",
              color: "#fff", borderRadius: 12, padding: "12px 18px",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
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

function AnnCard({ item, index, expanded, onExpand, canManage, onEdit, onDelete, onPin, onImageClick }: {
  item: Announcement; index: number; expanded: boolean; onExpand: () => void;
  canManage: boolean; onEdit: () => void; onDelete: () => void; onPin: () => void;
  onImageClick: (idx: number) => void;
}) {
  const cfg = TYPE_CFG[item.type];
  const name = (item.profiles as any)?.full_name || "—";
  const role = (item.profiles as any)?.role || "";
  const preview = item.content.length > 120 && !expanded
    ? item.content.slice(0, 120) + "..."
    : item.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.05, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "#fff",
        border: item.pinned ? `1.5px solid ${cfg.color}40` : "1px solid #f3f4f6",
        borderRadius: 14, overflow: "hidden",
      }}
    >
      {/* Left accent bar */}
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, background: cfg.color, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "16px 18px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              {item.pinned && <Pin size={13} color={cfg.color} style={{ flexShrink: 0, marginTop: 2 }} />}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                borderRadius: 20, padding: "2px 8px", flexShrink: 0,
              }}>
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{item.title}</h3>
            </div>

            {canManage && (
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={onPin}
                  style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}
                  title={item.pinned ? "Lepas pin" : "Pin"}
                >
                  {item.pinned ? <PinOff size={13} color="#9ca3af" /> : <Pin size={13} color="#9ca3af" />}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={onEdit}
                  style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}
                >
                  <Edit2 size={13} color="#6b7280" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={onDelete}
                  style={{ padding: 6, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 }}
                >
                  <Trash2 size={13} color="#ef4444" />
                </motion.button>
              </div>
            )}
          </div>

          {/* Content */}
          <p style={{
            fontSize: 13, color: "#4b5563", lineHeight: 1.65,
            marginTop: 10, whiteSpace: "pre-wrap",
          }}>
            {preview}
          </p>
          {item.content.length > 120 && (
            <button
              onClick={onExpand}
              style={{
                marginTop: 6, border: "none", background: "transparent",
                fontSize: 12, fontWeight: 600, color: cfg.color, cursor: "pointer", padding: 0,
              }}
            >
              {expanded ? "Tampilkan lebih sedikit" : "Baca selengkapnya"}
            </button>
          )}

          {/* Image gallery */}
          {item.image_urls && item.image_urls.length > 0 && (
            <div style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: item.image_urls.length === 1 ? "1fr" : item.image_urls.length === 2 ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: 6,
            }}>
              {item.image_urls.map((url, i) => (
                <div
                  key={i}
                  onClick={() => onImageClick(i)}
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    borderRadius: 8,
                    overflow: "hidden",
                    aspectRatio: item.image_urls!.length === 1 ? "16/7" : "1",
                    background: "#f3f4f6",
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: "100%", height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}99)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff",
            }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {name} · {ROLE_LABELS[role] ?? role} · {fmtDate(item.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
