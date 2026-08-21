"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import {
  createKegiatanAction, updateKegiatanAction,
  deleteKegiatanAction, blastKegiatanAction,
} from "./actions";
import {
  Layers, Plus, X, Check, Edit2, Trash2, ChevronDown, ChevronUp,
  Search, AlertTriangle, Megaphone, UserCircle2, Paperclip,
  Upload, Loader2, FileText, CalendarDays, Link2, ListChecks, ImageIcon,
  Video, MapPin,
} from "lucide-react";

const CHECKLIST_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const CHECKLIST_FILE_ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

// Kategori sama persis dengan modul Kalender, supaya sinkron konsisten
const CALENDAR_TYPE_CFG = {
  meeting:  { label: "Meeting",  color: "#3b82f6", bg: "#eff6ff" },
  deadline: { label: "Deadline", color: "#ef4444", bg: "#fef2f2" },
  event:    { label: "Event",    color: "#8b5cf6", bg: "#f5f3ff" },
  holiday:  { label: "Libur",    color: "#10b981", bg: "#f0fdf4" },
  training: { label: "Training", color: "#f59e0b", bg: "#fffbeb" },
} as const;
type CalendarType = keyof typeof CALENDAR_TYPE_CFG;

const LINK_FIELDS = [
  { key: "virtual_background_url", label: "Virtual Background" },
  { key: "absensi_url",            label: "Absensi" },
  { key: "materi_url",             label: "Materi" },
  { key: "record_zoom_url",        label: "Record Zoom" },
  { key: "ujian_url",              label: "Ujian" },
  { key: "dokumentasi_url",        label: "Dokumentasi" },
  { key: "modul_url",              label: "Modul" },
  { key: "rundown_url",            label: "Rundown" },
] as const;
type LinkKey = typeof LINK_FIELDS[number]["key"];

interface Kegiatan {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  end_date?: string | null;
  status: "belum" | "sudah";
  pic_id?: string | null;
  mode?: "online" | "offline" | null;
  location?: string | null;
  calendar_type?: CalendarType | null;
  created_at: string;
  created_by?: string | null;
  pic?: { full_name: string } | null;
  creator?: { full_name: string } | null;
  lampiran?: { count: number }[];
  checklist?: { status: "belum" | "sudah" }[];
  virtual_background_url?: string | null;
  absensi_url?: string | null;
  materi_url?: string | null;
  record_zoom_url?: string | null;
  ujian_url?: string | null;
  dokumentasi_url?: string | null;
  modul_url?: string | null;
  rundown_url?: string | null;
}

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

function fmtChecklistDeadline(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const STATUS_CFG = {
  belum: { label: "Belum", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  sudah: { label: "Sudah", color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
};

function fmtDeadline(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function fmtDeadlineRange(startStr: string, endStr: string) {
  if (!endStr || startStr === endStr) return fmtDeadline(startStr);
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}`;
  }
  return `${fmtDeadline(startStr)} – ${fmtDeadline(endStr)}`;
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23503") {
    return "Kegiatan ini sudah tidak ada (mungkin dihapus di tab/perangkat lain). Silakan refresh halaman.";
  }
  return error.message;
}

function getQuarter(dateStr: string): string {
  const month = new Date(dateStr + "T00:00:00").getMonth();
  return `Q${Math.floor(month / 3) + 1}`;
}

function getDeadlineTone(startStr: string, endStr: string, status: string) {
  if (status === "sudah") return { color: "#9ca3af", label: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(startStr + "T00:00:00");
  const end = new Date((endStr || startStr) + "T00:00:00");
  if (today > end) return { color: "#ef4444", label: "Lewat" };
  if (today >= start && today <= end) return { color: "#10b981", label: "Berlangsung" };
  const diff = Math.round((start.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return { color: "#f59e0b", label: "Besok" };
  if (diff <= 3) return { color: "#f59e0b", label: `${diff}h lagi` };
  return { color: "#6b7280", label: null };
}

const EMPTY_LINKS = LINK_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {} as Record<LinkKey, string>);

const EMPTY = {
  title: "", description: "", deadline: "", end_date: "",
  status: "belum" as Kegiatan["status"], pic_id: "",
  mode: "offline" as "online" | "offline", location: "",
  calendar_type: "event" as CalendarType,
  ...EMPTY_LINKS,
};

interface Props {
  currentUser: UserProfile;
  initialItems: Kegiatan[];
  profiles: { id: string; full_name: string; role: string }[];
}

function StatusBadge({
  status, editable, onChange,
}: { status: Kegiatan["status"]; editable: boolean; onChange: (s: Kegiatan["status"]) => void }) {
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

  if (!editable) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>
        {cfg.label}
      </span>
    );
  }

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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.12 }}
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, minWidth: 110,
            }}>
            {(Object.keys(STATUS_CFG) as Kegiatan["status"][]).map(s => (
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
          </motion.div>
        )}
      </AnimatePresence>
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
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? "#10b981" : "#6366f1"}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
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

function MiniDonut({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const size = 26, stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = total === 0 ? "#e5e7eb" : pct === 100 ? "#10b981" : "#6366f1";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={total === 0 ? "Belum ada checklist" : `${done} dari ${total} checklist selesai`}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {total > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
        )}
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: total === 0 ? "#d1d5db" : "#374151" }}>
        {total === 0 ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

export default function KegiatanBoard({ currentUser, initialItems, profiles }: Props) {
  const supabase = createClient();
  const canEdit = ["super_admin", "manager", "kep_trainer", "staff_dokumen"].includes(currentUser.role);

  const [items, setItems]           = useState<Kegiatan[]>(initialItems);
  const [tab, setTab]               = useState<"all" | "belum" | "sudah">("all");
  const [quarterFilter, setQuarterFilter] = useState<"all" | "Q1" | "Q2" | "Q3" | "Q4">("all");
  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Kegiatan | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [blasting, setBlasting]     = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [showLinks, setShowLinks]   = useState(false);

  const [lampiranList, setLampiranList]   = useState<Lampiran[]>([]);
  const [loadingLampiran, setLoadingLampiran] = useState(false);
  const [uploading, setUploading]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checklist, setChecklist]         = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [newItemName, setNewItemName]     = useState("");
  const [newItemPic, setNewItemPic]       = useState("");
  const [newItemDeadline, setNewItemDeadline] = useState("");
  const [addingItem, setAddingItem]       = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft]         = useState({ item_name: "", pic: "", deadline: "" });
  const [savingEdit, setSavingEdit]       = useState(false);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const checklistFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const loadLampiran = useCallback(async (kegiatanId: string) => {
    setLoadingLampiran(true);
    const { data } = await supabase
      .from("kegiatan_lampiran")
      .select("id, file_name, file_url, created_at")
      .eq("kegiatan_id", kegiatanId)
      .order("created_at", { ascending: false });
    setLampiranList(data ?? []);
    setLoadingLampiran(false);
  }, [supabase]);

  const loadChecklist = useCallback(async (kegiatanId: string) => {
    setLoadingChecklist(true);
    const { data } = await supabase
      .from("kegiatan_checklist")
      .select("id, item_name, pic, status, deadline, file_url, file_name, created_at")
      .eq("kegiatan_id", kegiatanId)
      .order("created_at", { ascending: true });
    setChecklist(data ?? []);
    setLoadingChecklist(false);
  }, [supabase]);

  const resetChecklistDraft = () => {
    setNewItemName(""); setNewItemPic(""); setNewItemDeadline("");
    setEditingItemId(null); setUploadTargetId(null);
  };

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setLampiranList([]); setChecklist([]);
    setShowLinks(false); resetChecklistDraft(); setShowModal(true);
  };
  const openEdit = (k: Kegiatan) => {
    setEditing(k);
    const links = LINK_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: k[f.key] ?? "" }), {} as Record<LinkKey, string>);
    setForm({
      title: k.title, description: k.description ?? "", deadline: k.deadline,
      end_date: k.end_date ?? k.deadline,
      status: k.status, pic_id: k.pic_id ?? "",
      mode: k.mode ?? "offline", location: k.location ?? "",
      calendar_type: k.calendar_type ?? "event",
      ...links,
    });
    setShowLinks(LINK_FIELDS.some(f => k[f.key]));
    resetChecklistDraft();
    setShowModal(true);
    loadLampiran(k.id);
    loadChecklist(k.id);
  };

  const syncItemChecklist = useCallback((kegiatanId: string, next: ChecklistItem[]) => {
    setItems(prev => prev.map(k => k.id === kegiatanId
      ? { ...k, checklist: next.map(c => ({ status: c.status })) }
      : k));
  }, []);

  const handleAddChecklistItem = async () => {
    if (!newItemName.trim() || !editing) return;
    setAddingItem(true);
    const { data, error } = await supabase
      .from("kegiatan_checklist")
      .insert({
        kegiatan_id: editing.id, item_name: newItemName.trim(),
        pic: newItemPic.trim() || null, deadline: newItemDeadline || null,
        status: "belum", created_by: currentUser.id,
      })
      .select("id, item_name, pic, status, deadline, file_url, file_name, created_at")
      .single();
    if (error) showToast(friendlyDbError(error), false);
    else {
      setChecklist(prev => {
        const next = [...prev, data];
        if (editing) syncItemChecklist(editing.id, next);
        return next;
      });
      setNewItemName(""); setNewItemPic(""); setNewItemDeadline("");
    }
    setAddingItem(false);
  };

  const handleToggleChecklistStatus = async (item: ChecklistItem, next: ChecklistItem["status"]) => {
    setChecklist(prev => {
      const nextList = prev.map(c => c.id === item.id ? { ...c, status: next } : c);
      if (editing) syncItemChecklist(editing.id, nextList);
      return nextList;
    });
    const { error } = await supabase.from("kegiatan_checklist").update({ status: next }).eq("id", item.id);
    if (error) {
      setChecklist(prev => {
        const reverted = prev.map(c => c.id === item.id ? { ...c, status: item.status } : c);
        if (editing) syncItemChecklist(editing.id, reverted);
        return reverted;
      });
      showToast("Gagal update status checklist", false);
    }
  };

  const handleDeleteChecklistItem = async (id: string) => {
    setChecklist(prev => {
      const next = prev.filter(c => c.id !== id);
      if (editing) syncItemChecklist(editing.id, next);
      return next;
    });
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
      setChecklist(prev => prev.map(c => c.id === editingItemId ? { ...c, ...payload } : c));
      setEditingItemId(null);
    }
    setSavingEdit(false);
  };

  const handleUploadChecklistFile = async (itemId: string, file: File | undefined) => {
    if (!file || !editing) return;
    if (!CHECKLIST_FILE_ALLOWED_TYPES.includes(file.type)) {
      showToast("File harus PDF, PNG, atau JPG", false);
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
    if (updErr) { showToast(updErr.message, false); }
    else {
      setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, file_url: publicUrl, file_name: file.name } : c));
    }
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
    const { error } = await supabase
      .from("kegiatan_checklist")
      .update({ file_url: null, file_name: null })
      .eq("id", item.id);
    if (error) { showToast(error.message, false); return; }
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, file_url: null, file_name: null } : c));
  };

  // Sync kegiatan -> tabel events (Kalender). Ditandai [keg:<id>] di description
  // supaya bisa dicari/di-update/dihapus lagi tanpa kolom relasi tambahan.
  const syncCalendarEvent = async (
    kegiatanId: string,
    p: {
      title: string; description: string | null; deadline: string; end_date: string;
      mode: "online" | "offline"; location: string | null; calendar_type: CalendarType;
    },
    isNew: boolean,
  ) => {
    const marker = `[keg:${kegiatanId}]`;
    const descParts = [
      p.description ?? "",
      p.mode === "offline" && p.location ? `Lokasi: ${p.location}` : "",
      marker,
    ].filter(Boolean);
    const eventPayload = {
      title: `Kegiatan: ${p.title}`,
      description: descParts.join("\n"),
      start_date: p.deadline,
      end_date: p.end_date || p.deadline,
      type: p.calendar_type,
      meet_link: p.mode === "online" ? (p.location || null) : null,
      created_by: currentUser.id,
    };
    if (isNew) {
      await supabase.from("events").insert(eventPayload);
    } else {
      const { data: existing } = await supabase.from("events")
        .select("id").ilike("description", `%${marker}%`).maybeSingle();
      if (existing) await supabase.from("events").update(eventPayload).eq("id", existing.id);
      else await supabase.from("events").insert(eventPayload);
    }
  };

  const removeCalendarEvent = async (kegiatanId: string) => {
    await supabase.from("events").delete().ilike("description", `%[keg:${kegiatanId}]%`);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.deadline) return;
    setSubmitting(true);
    const links = LINK_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: form[f.key].trim() || null }), {} as Record<LinkKey, string | null>);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      deadline: form.deadline,
      end_date: form.end_date && form.end_date >= form.deadline ? form.end_date : form.deadline,
      status: form.status,
      pic_id: form.pic_id || null,
      mode: form.mode,
      location: form.location.trim() || null,
      calendar_type: form.calendar_type,
      ...links,
    };
    if (editing) {
      const { data, error } = await updateKegiatanAction(editing.id, payload);
      if (error) { showToast(error, false); }
      else {
        setItems(prev => prev.map(k => k.id === editing.id ? (data as unknown as Kegiatan) : k));
        showToast("Kegiatan diperbarui + kalender disinkron");
        setShowModal(false);
        syncCalendarEvent(editing.id, payload, false);
      }
    } else {
      const { data, error } = await createKegiatanAction(payload);
      if (error) { showToast(error, false); }
      else {
        const created = data as unknown as Kegiatan;
        setItems(prev => [...prev, created].sort((a, b) => a.deadline.localeCompare(b.deadline)));
        showToast("Kegiatan ditambahkan + kalender disinkron");
        setShowModal(false);
        syncCalendarEvent(created.id, payload, true);
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteKegiatanAction(id);
    if (error) showToast(error, false);
    else {
      await removeCalendarEvent(id);
      setItems(prev => prev.filter(k => k.id !== id));
      showToast("Kegiatan + event kalender dihapus");
    }
    setDeleteId(null);
  };

  const handleBlast = async (k: Kegiatan) => {
    setBlasting(k.id);
    const deadlineLabel = new Date(k.deadline + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const picLabel = k.pic?.full_name ? ` PIC: ${k.pic.full_name}.` : "";
    const content = `Kegiatan "${k.title}" — deadline ${deadlineLabel}.${picLabel}${k.description ? `\n\n${k.description}` : ""}`;

    const { error } = await blastKegiatanAction({
      title: `📢 Kegiatan: ${k.title}`,
      content,
    });

    if (error) showToast("Gagal mengirim notifikasi", false);
    else showToast("Notifikasi dikirim ke semua anggota!");
    setBlasting(null);
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !editing) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${editing.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("kegiatan-lampiran").upload(path, file, { contentType: file.type });
      if (upErr) { showToast(`Gagal upload ${file.name}: ${upErr.message}`, false); continue; }
      const { data: { publicUrl } } = supabase.storage.from("kegiatan-lampiran").getPublicUrl(path);
      const { data: row, error: insErr } = await supabase
        .from("kegiatan_lampiran")
        .insert({ kegiatan_id: editing.id, file_name: file.name, file_url: publicUrl, uploaded_by: currentUser.id })
        .select("id, file_name, file_url, created_at")
        .single();
      if (insErr) { showToast(`Gagal simpan ${file.name}: ${friendlyDbError(insErr)}`, false); continue; }
      setLampiranList(prev => [row, ...prev]);
      setItems(prev => prev.map(k => k.id === editing.id
        ? { ...k, lampiran: [{ count: (k.lampiran?.[0]?.count ?? 0) + 1 }] }
        : k));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteLampiran = async (l: Lampiran) => {
    if (!editing) return;
    const marker = "/kegiatan-lampiran/";
    const idx = l.file_url.indexOf(marker);
    if (idx !== -1) {
      const path = l.file_url.slice(idx + marker.length);
      await supabase.storage.from("kegiatan-lampiran").remove([path]);
    }
    await supabase.from("kegiatan_lampiran").delete().eq("id", l.id);
    setLampiranList(prev => prev.filter(x => x.id !== l.id));
    setItems(prev => prev.map(k => k.id === editing.id
      ? { ...k, lampiran: [{ count: Math.max(0, (k.lampiran?.[0]?.count ?? 1) - 1) }] }
      : k));
    showToast("Lampiran dihapus");
  };

  const filtered = useMemo(() => {
    let list = items.filter(k => tab === "all" ? true : k.status === tab);
    if (quarterFilter !== "all") list = list.filter(k => getQuarter(k.deadline) === quarterFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(k =>
        k.title.toLowerCase().includes(q) ||
        k.description?.toLowerCase().includes(q) ||
        k.pic?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, search, quarterFilter]);

  const stats = {
    total: items.length,
    belum: items.filter(k => k.status === "belum").length,
    sudah: items.filter(k => k.status === "sudah").length,
  };

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f9fafb" }}>
      {/* Topbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6",
        padding: "0 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, flexShrink: 0, gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
          }}>
            <Layers size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Kegiatan</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{stats.belum} belum selesai</p>
          </div>
        </div>

        <div style={{ flex: 1, maxWidth: 340, position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 12 }} />
          <input
            type="text" placeholder="Cari kegiatan…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 34px",
              border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13,
              outline: "none", background: "#f9fafb", fontFamily: "inherit",
            }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={12} color="#9ca3af" />
            </button>
          )}
        </div>

        {canEdit && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
            style={{
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
            }}>
            <Plus size={15} /> Tambah Kegiatan
          </motion.button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {([
            { key: "all",   label: "Semua",  count: stats.total },
            { key: "belum", label: "Belum",  count: stats.belum },
            { key: "sudah", label: "Sudah",  count: stats.sudah },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: "14px 16px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? "#4f46e5" : "#6b7280",
                borderBottom: tab === t.key ? "2px solid #4f46e5" : "2px solid transparent",
                transition: "all 0.15s",
              }}>
              {t.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                background: tab === t.key ? "#eef2ff" : "#f3f4f6",
                color: tab === t.key ? "#4f46e5" : "#9ca3af",
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
          {(["all", "Q1", "Q2", "Q3", "Q4"] as const).map(q => {
            const count = q === "all"
              ? items.filter(k => tab === "all" || k.status === tab).length
              : items.filter(k => (tab === "all" || k.status === tab) && getQuarter(k.deadline) === q).length;
            return (
              <button key={q} onClick={() => setQuarterFilter(q)}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${quarterFilter === q ? "#c7d2fe" : "#e5e7eb"}`,
                  background: quarterFilter === q ? "#eef2ff" : "#fff",
                  color: quarterFilter === q ? "#4f46e5" : "#6b7280",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                {q === "all" ? "Semua Kuartal" : q}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
                  background: quarterFilter === q ? "#e0e7ff" : "#f3f4f6",
                  color: quarterFilter === q ? "#4f46e5" : "#9ca3af",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="board-main" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#fff", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{search ? "🔍" : "🗂️"}</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
              {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada kegiatan"}
            </p>
            {canEdit && !search && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openCreate}
                style={{ marginTop: 20, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Tambah Kegiatan Pertama
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #f3f4f6", borderRadius: 14 }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: canEdit ? "2.2fr 1.2fr 0.9fr 1fr 2fr 0.8fr auto" : "2.2fr 1.2fr 0.9fr 1fr 2fr 0.8fr",
              gap: 12, padding: "10px 18px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
              borderTopLeftRadius: 14, borderTopRightRadius: 14,
            }}>
              {["Nama Kegiatan", "PIC", "Status", "Deadline", "Keterangan", "Lampiran"].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
              ))}
              {canEdit && <span />}
            </div>

            <AnimatePresence mode="popLayout">
              {filtered.map((k, i) => {
                const tone = getDeadlineTone(k.deadline, k.end_date ?? k.deadline, k.status);
                const lampiranCount = k.lampiran?.[0]?.count ?? 0;
                return (
                  <motion.div key={k.id} layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.18 }}
                    onClick={() => openEdit(k)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: canEdit ? "2.2fr 1.2fr 0.9fr 1fr 2fr 0.8fr auto" : "2.2fr 1.2fr 0.9fr 1fr 2fr 0.8fr",
                      gap: 12, padding: "13px 18px", borderBottom: "1px solid #f9fafb",
                      alignItems: "center", cursor: "pointer",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span
                        title={CALENDAR_TYPE_CFG[k.calendar_type ?? "event"].label}
                        style={{ width: 7, height: 7, borderRadius: "50%", background: CALENDAR_TYPE_CFG[k.calendar_type ?? "event"].color, flexShrink: 0 }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.title}</span>
                    </span>

                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      {k.pic?.full_name
                        ? <><UserCircle2 size={12} color="#9ca3af" style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.pic.full_name}</span></>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </span>

                    <MiniDonut
                      done={(k.checklist ?? []).filter(c => c.status === "sudah").length}
                      total={(k.checklist ?? []).length}
                    />

                    <span style={{ fontSize: 12, color: tone.color, fontWeight: tone.label ? 700 : 500, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <CalendarDays size={11} style={{ flexShrink: 0 }} />
                      {fmtDeadlineRange(k.deadline, k.end_date ?? k.deadline)}
                      {tone.label && <span style={{ fontSize: 10 }}>({tone.label})</span>}
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                        background: "#eef2ff", color: "#4f46e5", flexShrink: 0,
                      }}>
                        {getQuarter(k.deadline)}
                      </span>
                    </span>

                    <span style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {k.description || "—"}
                    </span>

                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      {lampiranCount > 0 && <><Paperclip size={11} color="#9ca3af" />{lampiranCount}</>}
                    </span>

                    {canEdit && (
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>
                        {k.status !== "sudah" && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                            onClick={() => handleBlast(k)} disabled={blasting === k.id}
                            title="Kirim notifikasi ke semua anggota"
                            style={{ padding: 6, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 7, cursor: blasting === k.id ? "not-allowed" : "pointer", display: "flex" }}>
                            {blasting === k.id
                              ? <Loader2 size={12} color="#9ca3af" className="spin" />
                              : <Megaphone size={12} color="#d97706" />}
                          </motion.button>
                        )}
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => openEdit(k)}
                          style={{ padding: 6, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 7, cursor: "pointer", display: "flex" }}>
                          <Edit2 size={12} color="#6b7280" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setDeleteId(k.id)}
                          style={{ padding: 6, border: "1px solid #fee2e2", background: "#fff", borderRadius: 7, cursor: "pointer", display: "flex" }}>
                          <Trash2 size={12} color="#ef4444" />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 760, boxShadow: "0 25px 60px rgba(0,0,0,0.18)", maxHeight: "92vh", overflow: "auto" }}
            >
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Layers size={14} color="#4f46e5" />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {editing ? "Edit Kegiatan" : "Tambah Kegiatan"}
                  </h2>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Nama Kegiatan <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input type="text" placeholder="Nama kegiatan…" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>PIC</label>
                    <select value={form.pic_id} onChange={e => setForm(f => ({ ...f, pic_id: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      <option value="">— Pilih PIC —</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Kegiatan["status"] }))}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                      Deadline <span style={{ color: "#ef4444" }}>*</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(tanggal mulai — otomatis masuk Kalender)</span>
                    </label>
                    {form.deadline && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: "#eef2ff", color: "#4f46e5", border: "1px solid #e0e7ff",
                      }}>
                        {getQuarter(form.deadline)} {new Date(form.deadline + "T00:00:00").getFullYear()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 4 }}>
                    <span />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>Jumlah Hari</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <input type="date" value={form.deadline}
                      onChange={e => {
                        const nextDeadline = e.target.value;
                        setForm(f => {
                          const duration = f.deadline && f.end_date ? daysBetween(f.deadline, f.end_date) : 1;
                          return { ...f, deadline: nextDeadline, end_date: nextDeadline ? addDays(nextDeadline, Math.max(0, duration - 1)) : "" };
                        });
                      }}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                    <input type="number" min={1} placeholder="Jumlah hari"
                      value={form.deadline && form.end_date ? daysBetween(form.deadline, form.end_date) : 1}
                      onChange={e => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        setForm(f => ({ ...f, end_date: f.deadline ? addDays(f.deadline, n - 1) : "" }));
                      }}
                      disabled={!form.deadline}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                  </div>
                  {form.deadline && form.end_date && form.end_date > form.deadline && (
                    <p style={{ fontSize: 11, color: "#6366f1", marginTop: 6, fontWeight: 600 }}>
                      Berlangsung {daysBetween(form.deadline, form.end_date)} hari — sampai {fmtDeadline(form.end_date)}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Kategori Kalender
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(sesuai kategori di halaman Kalender)</span>
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(Object.entries(CALENDAR_TYPE_CFG) as [CalendarType, typeof CALENDAR_TYPE_CFG[CalendarType]][]).map(([key, cfg]) => (
                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, calendar_type: key }))}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: `1.5px solid ${form.calendar_type === key ? cfg.color : "#e5e7eb"}`,
                          background: form.calendar_type === key ? cfg.bg : "#fff",
                          color: form.calendar_type === key ? cfg.color : "#6b7280",
                        }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kegiatan Online atau Offline?</label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {([
                      { key: "offline" as const, label: "Offline", Icon: MapPin },
                      { key: "online" as const, label: "Online", Icon: Video },
                    ]).map(({ key, label, Icon }) => (
                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, mode: key }))}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          padding: "9px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                          border: `1.5px solid ${form.mode === key ? "#6366f1" : "#e5e7eb"}`,
                          background: form.mode === key ? "#eef2ff" : "#fff",
                          color: form.mode === key ? "#4f46e5" : "#6b7280",
                        }}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                  <input type="text"
                    placeholder={form.mode === "online" ? "Link Zoom / Google Meet…" : "Lokasi acara…"}
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Keterangan</label>
                  <textarea rows={3} placeholder="Keterangan kegiatan…" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                </div>

                {/* Link & dokumen pendukung — opsional */}
                <div>
                  <button type="button" onClick={() => setShowLinks(s => !s)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showLinks ? 10 : 0,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Link2 size={12} color="#9ca3af" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Link &amp; Dokumen Pendukung</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(opsional)</span>
                    </div>
                    {showLinks ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                  </button>
                  {showLinks && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {LINK_FIELDS.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>{f.label}</label>
                          <input type="text" placeholder="https://…" value={form[f.key]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "#e5e7eb")} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lampiran / upload folder — only once kegiatan exists */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Paperclip size={12} color="#9ca3af" />
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Lampiran / Upload Folder</label>
                    </div>
                    {editing && (
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

                  {!editing ? (
                    <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                      Simpan kegiatan dulu, baru bisa upload lampiran.
                    </p>
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

                {/* Checklist / rincian kebutuhan kegiatan */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                    <ListChecks size={12} color="#9ca3af" />
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Checklist / Rincian Kebutuhan</label>
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>(opsional)</span>
                  </div>

                  {!editing ? (
                    <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                      Simpan kegiatan dulu, baru bisa tambah checklist.
                    </p>
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

                                {/* File bukti */}
                                {item.file_url ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                                    <a href={item.file_url} target="_blank" rel="noopener noreferrer" title={item.file_name ?? "Lihat file"}
                                      style={{ display: "flex", padding: 5, borderRadius: 6, background: "#f0fdf4", border: "1px solid #d1fae5" }}>
                                      {item.file_name?.toLowerCase().endsWith(".pdf")
                                        ? <FileText size={12} color="#10b981" />
                                        : <ImageIcon size={12} color="#10b981" />}
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
                                    title="Upload file bukti (PDF/PNG/JPG)"
                                    style={{
                                      flexShrink: 0, display: "flex", padding: 5, borderRadius: 6,
                                      border: "1px solid #e5e7eb", background: "#fff",
                                      cursor: isUploadingThis ? "not-allowed" : "pointer",
                                    }}>
                                    {isUploadingThis ? <Loader2 size={12} color="#9ca3af" className="spin" /> : <Upload size={12} color="#9ca3af" />}
                                  </button>
                                )}

                                <div style={{ flexShrink: 0 }}>
                                  <StatusBadge status={item.status} editable onChange={s => handleToggleChecklistStatus(item, s)} />
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

                      {/* Quick add row */}
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

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.deadline}
                  style={{
                    width: "100%", padding: "12px", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
                    background: submitting || !form.title.trim() || !form.deadline
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                  }}>
                  {submitting
                    ? <><div className="spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%" }} /> Menyimpan...</>
                    : <><Check size={14} /> {editing ? "Perbarui Kegiatan" : "Simpan Kegiatan"}</>
                  }
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
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Kegiatan?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Data kegiatan dan semua lampirannya akan dihapus permanen.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Batal
                </button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(deleteId)}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Trash2 size={13} /> Hapus
                </motion.button>
              </div>
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
            }}>
            {toast.ok ? <Check size={14} /> : <X size={14} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
