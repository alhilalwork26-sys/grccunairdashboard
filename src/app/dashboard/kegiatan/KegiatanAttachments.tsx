"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import {
  X, Check, Edit2, Paperclip, Upload, Loader2, FileText,
  CalendarDays, ListChecks, ImageIcon, Plus, ChevronDown,
} from "lucide-react";

const CHECKLIST_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CHECKLIST_FILE_ALLOWED_TYPES = [
  "application/pdf", "image/png", "image/jpeg",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

interface Lampiran {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  item_name: string;
  pic: string | null;
  status: "belum" | "sudah";
  deadline: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

const STATUS_CFG = {
  belum: { label: "Belum", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  sudah: { label: "Sudah", color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
};

function fmtChecklistDeadline(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23503") {
    return "Data ini sudah tidak ada (mungkin dihapus di tab/perangkat lain). Silakan refresh halaman.";
  }
  return error.message;
}

function StatusBadge({
  status, onChange,
}: { status: ChecklistItem["status"]; onChange: (s: ChecklistItem["status"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CFG[status];

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 11, fontWeight: 700, padding: "3px 8px 3px 10px", borderRadius: 6,
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
        }}>
        {cfg.label} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, minWidth: 110,
        }}>
          {(Object.keys(STATUS_CFG) as ChecklistItem["status"][]).map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              style={{
                width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7,
                border: "none", background: s === status ? "#f9fafb" : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 12,
              }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_CFG[s].color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: "#374151" }}>{STATUS_CFG[s].label}</span>
              {s === status && <Check size={12} color="#10b981" style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressDonut({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const size = 72, stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? "#10b981" : "#6366f1"}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }} />
      </svg>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{pct}%</p>
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          {total === 0 ? "Belum ada checklist" : `${done} dari ${total} selesai`}
        </p>
      </div>
    </div>
  );
}

interface Props {
  currentUser: UserProfile;
  kegiatanId: string | null;
}

export default function KegiatanAttachments({ currentUser, kegiatanId }: Props) {
  const supabase = createClient();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [lampiranList, setLampiranList] = useState<Lampiran[]>([]);
  const [loadingLampiran, setLoadingLampiran] = useState(!!kegiatanId);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(!!kegiatanId);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPic, setNewItemPic] = useState("");
  const [newItemDeadline, setNewItemDeadline] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ item_name: "", pic: "", deadline: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const checklistFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (!kegiatanId) return;
    let cancelled = false;
    supabase.from("kegiatan_lampiran").select("id, file_name, file_url, created_at")
      .eq("kegiatan_id", kegiatanId).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) { setLampiranList(data ?? []); setLoadingLampiran(false); } });
    supabase.from("kegiatan_checklist").select("id, item_name, pic, status, deadline, file_url, file_name, created_at")
      .eq("kegiatan_id", kegiatanId).order("created_at", { ascending: true })
      .then(({ data }) => { if (!cancelled) { setChecklist(data ?? []); setLoadingChecklist(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kegiatanId]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !kegiatanId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${kegiatanId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("kegiatan-lampiran").upload(path, file, { contentType: file.type });
      if (upErr) { showToast(`Gagal upload ${file.name}: ${upErr.message}`, false); continue; }
      const { data: { publicUrl } } = supabase.storage.from("kegiatan-lampiran").getPublicUrl(path);
      const { data: row, error: insErr } = await supabase
        .from("kegiatan_lampiran")
        .insert({ kegiatan_id: kegiatanId, file_name: file.name, file_url: publicUrl, uploaded_by: currentUser.id })
        .select("id, file_name, file_url, created_at")
        .single();
      if (insErr) { showToast(`Gagal simpan ${file.name}: ${friendlyDbError(insErr)}`, false); continue; }
      setLampiranList(prev => [row, ...prev]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteLampiran = async (l: Lampiran) => {
    const marker = "/kegiatan-lampiran/";
    const idx = l.file_url.indexOf(marker);
    if (idx !== -1) {
      const path = l.file_url.slice(idx + marker.length);
      await supabase.storage.from("kegiatan-lampiran").remove([path]);
    }
    await supabase.from("kegiatan_lampiran").delete().eq("id", l.id);
    setLampiranList(prev => prev.filter(x => x.id !== l.id));
    showToast("Lampiran dihapus");
  };

  const resetChecklistDraft = () => { setNewItemName(""); setNewItemPic(""); setNewItemDeadline(""); };

  const handleAddChecklistItem = async () => {
    if (!newItemName.trim() || !kegiatanId) return;
    setAddingItem(true);
    const { data, error } = await supabase
      .from("kegiatan_checklist")
      .insert({
        kegiatan_id: kegiatanId, item_name: newItemName.trim(),
        pic: newItemPic.trim() || null, deadline: newItemDeadline || null,
        status: "belum", created_by: currentUser.id,
      })
      .select("id, item_name, pic, status, deadline, file_url, file_name, created_at")
      .single();
    if (error) showToast(friendlyDbError(error), false);
    else { setChecklist(prev => [...prev, data]); resetChecklistDraft(); }
    setAddingItem(false);
  };

  const handleToggleChecklistStatus = async (item: ChecklistItem, next: ChecklistItem["status"]) => {
    setChecklist(prev => prev.map(c => (c.id === item.id ? { ...c, status: next } : c)));
    const { error } = await supabase.from("kegiatan_checklist").update({ status: next }).eq("id", item.id);
    if (error) {
      setChecklist(prev => prev.map(c => (c.id === item.id ? { ...c, status: item.status } : c)));
      showToast("Gagal update status checklist", false);
    }
  };

  const handleDeleteChecklistItem = async (id: string) => {
    setChecklist(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from("kegiatan_checklist").delete().eq("id", id);
    if (error) showToast(error.message, false);
  };

  const startEditChecklistItem = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditDraft({ item_name: item.item_name, pic: item.pic ?? "", deadline: item.deadline ?? "" });
  };
  const cancelEditChecklistItem = () => setEditingItemId(null);

  const handleSaveEditChecklistItem = async () => {
    if (!editingItemId || !editDraft.item_name.trim()) return;
    setSavingEdit(true);
    const payload = {
      item_name: editDraft.item_name.trim(),
      pic: editDraft.pic.trim() || null,
      deadline: editDraft.deadline || null,
    };
    const { error } = await supabase.from("kegiatan_checklist").update(payload).eq("id", editingItemId);
    if (error) showToast(error.message, false);
    else {
      setChecklist(prev => prev.map(c => (c.id === editingItemId ? { ...c, ...payload } : c)));
      setEditingItemId(null);
    }
    setSavingEdit(false);
  };

  const handleUploadChecklistFile = async (itemId: string, file: File | undefined) => {
    if (!file) return;
    if (!CHECKLIST_FILE_ALLOWED_TYPES.includes(file.type)) {
      showToast("File harus PDF, PNG, JPG, DOC, atau XLS", false);
      if (checklistFileInputRef.current) checklistFileInputRef.current.value = "";
      return;
    }
    setUploadTargetId(itemId);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `checklist/${itemId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("kegiatan-lampiran").upload(path, file, { contentType: file.type });
    if (upErr) { showToast(`Gagal upload: ${upErr.message}`, false); setUploadTargetId(null); return; }
    const { data: { publicUrl } } = supabase.storage.from("kegiatan-lampiran").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("kegiatan_checklist")
      .update({ file_url: publicUrl, file_name: file.name })
      .eq("id", itemId);
    if (updErr) showToast(updErr.message, false);
    else setChecklist(prev => prev.map(c => (c.id === itemId ? { ...c, file_url: publicUrl, file_name: file.name } : c)));
    setUploadTargetId(null);
    if (checklistFileInputRef.current) checklistFileInputRef.current.value = "";
  };

  const handleRemoveChecklistFile = async (item: ChecklistItem) => {
    if (!item.file_url) return;
    const marker = "/kegiatan-lampiran/";
    const idx = item.file_url.indexOf(marker);
    if (idx !== -1) {
      const path = item.file_url.slice(idx + marker.length);
      await supabase.storage.from("kegiatan-lampiran").remove([path]);
    }
    const { error } = await supabase.from("kegiatan_checklist").update({ file_url: null, file_name: null }).eq("id", item.id);
    if (error) { showToast(error.message, false); return; }
    setChecklist(prev => prev.map(c => (c.id === item.id ? { ...c, file_url: null, file_name: null } : c)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative" }}>
      {/* Lampiran / upload folder */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Paperclip size={12} color="#9ca3af" />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Lampiran / Upload Folder</label>
          </div>
          {kegiatanId && (
            <label style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
              color: "#4f46e5", cursor: uploading ? "not-allowed" : "pointer",
              padding: "5px 10px", border: "1px solid #e0e7ff", borderRadius: 8, background: "#eef2ff",
            }}>
              {uploading ? <Loader2 size={11} className="spin" /> : <Upload size={11} />}
              {uploading ? "Mengunggah…" : "Upload File"}
              <input ref={fileInputRef} type="file" multiple disabled={uploading}
                onChange={e => handleUploadFiles(e.target.files)}
                style={{ display: "none" }} />
            </label>
          )}
        </div>

        {!kegiatanId ? (
          <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Simpan dulu, baru bisa upload lampiran.</p>
        ) : loadingLampiran ? (
          <p style={{ fontSize: 11, color: "#9ca3af" }}>Memuat lampiran…</p>
        ) : lampiranList.length === 0 ? (
          <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Belum ada file.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lampiranList.map(l => (
              <div key={l.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8,
              }}>
                <FileText size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                <a href={l.file_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#374151", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.file_name}
                </a>
                <button onClick={() => handleDeleteLampiran(l)}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                  <X size={13} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checklist / rincian kebutuhan */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          <ListChecks size={12} color="#9ca3af" />
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Checklist / Rincian Kebutuhan</label>
          <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(opsional)</span>
        </div>

        {!kegiatanId ? (
          <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Simpan dulu, baru bisa tambah checklist.</p>
        ) : (
          <>
            {checklist.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", padding: "12px 14px", marginBottom: 12,
                background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12,
              }}>
                <ProgressDonut done={checklist.filter(c => c.status === "sudah").length} total={checklist.length} />
              </div>
            )}

            <input ref={checklistFileInputRef} type="file" accept={CHECKLIST_FILE_ACCEPT} style={{ display: "none" }}
              onChange={e => { if (uploadTargetId) handleUploadChecklistFile(uploadTargetId, e.target.files?.[0]); }} />

            {loadingChecklist ? (
              <p style={{ fontSize: 11, color: "#9ca3af" }}>Memuat checklist…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {checklist.map((item, i) => {
                  const isEditing = editingItemId === item.id;
                  const isUploadingThis = uploadTargetId === item.id;
                  return (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      background: isEditing ? "#eef2ff" : "#f9fafb",
                      border: `1px solid ${isEditing ? "#c7d2fe" : "#f3f4f6"}`, borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 10, color: "#d1d5db", fontWeight: 700, width: 16, flexShrink: 0 }}>{i + 1}</span>

                      {isEditing ? (
                        <>
                          <input type="text" value={editDraft.item_name} autoFocus
                            onChange={e => setEditDraft(d => ({ ...d, item_name: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveEditChecklistItem(); if (e.key === "Escape") cancelEditChecklistItem(); }}
                            style={{ flex: 1, minWidth: 0, padding: "5px 8px", border: "1.5px solid #c7d2fe", borderRadius: 7, fontSize: 12, outline: "none", fontFamily: "inherit" }} />
                          <input type="text" value={editDraft.pic} placeholder="PIC…"
                            onChange={e => setEditDraft(d => ({ ...d, pic: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveEditChecklistItem(); if (e.key === "Escape") cancelEditChecklistItem(); }}
                            style={{ width: 100, flexShrink: 0, padding: "5px 8px", border: "1.5px solid #c7d2fe", borderRadius: 7, fontSize: 12, outline: "none", fontFamily: "inherit" }} />
                          <input type="date" value={editDraft.deadline}
                            onChange={e => setEditDraft(d => ({ ...d, deadline: e.target.value }))}
                            style={{ width: 132, flexShrink: 0, padding: "5px 6px", border: "1.5px solid #c7d2fe", borderRadius: 7, fontSize: 12, outline: "none" }} />
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.item_name}
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.pic || "—"}
                          </span>
                          <span style={{ fontSize: 11, color: item.deadline ? "#6b7280" : "#d1d5db", flexShrink: 0, width: 56, display: "flex", alignItems: "center", gap: 3 }}>
                            {item.deadline && <CalendarDays size={10} style={{ flexShrink: 0 }} />}
                            {item.deadline ? fmtChecklistDeadline(item.deadline) : "—"}
                          </span>
                        </>
                      )}

                      {item.file_url ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer" title={item.file_name ?? "Lihat file"}
                            style={{ display: "flex", padding: 5, borderRadius: 6, background: "#f0fdf4", border: "1px solid #d1fae5" }}>
                            {/\.(png|jpe?g|gif|webp)$/i.test(item.file_name ?? "")
                              ? <ImageIcon size={12} color="#10b981" />
                              : <FileText size={12} color="#10b981" />}
                          </a>
                          <button onClick={() => handleRemoveChecklistFile(item)} title="Hapus file"
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                            <X size={11} color="#ef4444" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setUploadTargetId(item.id); checklistFileInputRef.current?.click(); }}
                          disabled={isUploadingThis}
                          title="Upload file bukti (PDF/PNG/JPG/DOC/XLS)"
                          style={{
                            flexShrink: 0, display: "flex", padding: 5, borderRadius: 6,
                            border: "1px solid #e5e7eb", background: "#fff",
                            cursor: isUploadingThis ? "not-allowed" : "pointer",
                          }}>
                          {isUploadingThis ? <Loader2 size={12} color="#9ca3af" className="spin" /> : <Upload size={12} color="#9ca3af" />}
                        </button>
                      )}

                      <div style={{ flexShrink: 0 }}>
                        <StatusBadge status={item.status} onChange={s => handleToggleChecklistStatus(item, s)} />
                      </div>

                      {isEditing ? (
                        <>
                          <button onClick={handleSaveEditChecklistItem} disabled={savingEdit || !editDraft.item_name.trim()}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                            {savingEdit ? <Loader2 size={13} color="#6366f1" className="spin" /> : <Check size={14} color="#10b981" />}
                          </button>
                          <button onClick={cancelEditChecklistItem}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                            <X size={13} color="#9ca3af" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditChecklistItem(item)}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                            <Edit2 size={12} color="#9ca3af" />
                          </button>
                          <button onClick={() => handleDeleteChecklistItem(item.id)}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                            <X size={13} color="#ef4444" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input type="text" placeholder="Nama kebutuhan…" value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newItemName.trim()) handleAddChecklistItem(); }}
                style={{ flex: 2, padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
              <input type="text" placeholder="PIC…" value={newItemPic}
                onChange={e => setNewItemPic(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newItemName.trim()) handleAddChecklistItem(); }}
                style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
              <input type="date" value={newItemDeadline}
                onChange={e => setNewItemDeadline(e.target.value)}
                style={{ width: 132, padding: "8px 8px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 12, outline: "none", boxSizing: "border-box", flexShrink: 0 }}
                onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
              <button onClick={handleAddChecklistItem} disabled={!newItemName.trim() || addingItem}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  width: 34, border: "none", borderRadius: 9, cursor: newItemName.trim() ? "pointer" : "not-allowed",
                  background: newItemName.trim() ? "#4f46e5" : "#e5e7eb", color: "#fff",
                }}>
                {addingItem ? <Loader2 size={13} className="spin" /> : <Plus size={15} />}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          background: toast.ok ? "#111827" : "#ef4444",
          color: "#fff", borderRadius: 12, padding: "12px 18px",
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
        </div>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
