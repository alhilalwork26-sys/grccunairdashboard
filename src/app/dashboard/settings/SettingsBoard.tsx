"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserProfile, Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import { updateUserRole, createUser, updateUserModules, deleteUser, toggleUserStatus } from "./actions";
import {
  Settings, Users, Plus, X, Check, Search,
  Edit2, Trash2, Shield, Mail, UserCircle, Power, Eye, EyeOff, Lock,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";

const ROLE_COLOR: Record<Role, { bg: string; text: string; border: string }> = {
  super_admin:     { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  manager:         { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  program_admin:   { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" },
  kep_marketing:   { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
  staff_kreatif:   { bg: "#f0fdf4", text: "#14532d", border: "#bbf7d0" },
  staff_marketing: { bg: "#fff7ed", text: "#7c2d12", border: "#fed7aa" },
  kep_finance:     { bg: "#ecfdf5", text: "#064e3b", border: "#a7f3d0" },
  staff_finance:   { bg: "#f0fdfa", text: "#134e4a", border: "#99f6e4" },
  staff_dokumen:   { bg: "#eff6ff", text: "#1e3a8a", border: "#bfdbfe" },
  kep_trainer:     { bg: "#fdf4ff", text: "#581c87", border: "#f0abfc" },
  tim_riset:       { bg: "#f0f9ff", text: "#075985", border: "#bae6fd" },
};

const MODULES = [
  { id: "dashboard",       label: "Dashboard" },
  { id: "chat",            label: "Chat" },
  { id: "progress",        label: "Daily Progress" },
  { id: "task-management", label: "Task Management" },
  { id: "announce",        label: "Announcement" },
  { id: "kampanye",        label: "Kampanye" },
  { id: "konten",          label: "Konten Plan" },
  { id: "brief",           label: "Brief Kreatif" },
  { id: "calendar",        label: "Kalender" },
  { id: "docs",            label: "Dokumen" },
  { id: "finance",         label: "Finance" },
  { id: "rab",             label: "RAB" },
  { id: "training",        label: "Training" },
  { id: "approvals",       label: "Approval Center" },
  { id: "report",          label: "Laporan" },
  { id: "notifications",   label: "Notifikasi" },
  { id: "settings",        label: "Pengaturan" },
  { id: "profile",         label: "Profil" },
];

const ALL_MODULE_IDS = MODULES.map(m => m.id);

function toggleModuleInList(id: string, list: string[]) {
  return list.includes(id) ? list.filter(m => m !== id) : [...list, id];
}

function ModuleChecklist({
  selected, onChange, compact = false,
}: { selected: string[]; onChange: (next: string[]) => void; compact?: boolean }) {
  const allOn = selected.length === ALL_MODULE_IDS.length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {allOn ? "Semua modul aktif" : `${selected.length} dari ${ALL_MODULE_IDS.length} modul dipilih`}
        </span>
        <button
          onClick={() => onChange(allOn ? [] : [...ALL_MODULE_IDS])}
          style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          {allOn ? "Hapus Semua" : "Pilih Semua"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr 1fr" : "1fr 1fr", gap: 5 }}>
        {MODULES.map(m => {
          const on = selected.includes(m.id);
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onChange(toggleModuleInList(m.id, selected))}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${on ? "#6366f1" : "#e5e7eb"}`,
                background: on ? "#eef2ff" : "#f9fafb",
                transition: "all 0.12s",
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                background: on ? "#6366f1" : "#fff",
                border: `1.5px solid ${on ? "#6366f1" : "#d1d5db"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {on && <Check size={8} color="#fff" />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: on ? "#4f46e5" : "#6b7280" }}>
                {m.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_CREATE = {
  email: "", full_name: "", role: "staff_marketing" as Role,
  password: "", modules: ALL_MODULE_IDS,
};

interface Props {
  currentUser: UserProfile;
  initialProfiles: UserProfile[];
}

export default function SettingsBoard({ currentUser, initialProfiles }: Props) {
  const [profiles, setProfiles]       = useState<UserProfile[]>(initialProfiles);
  const [search, setSearch]           = useState("");
  const [roleFilter, setRoleFilter]   = useState<Role | "all">("all");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole]       = useState<Role>("staff_marketing");
  const [editModules, setEditModules] = useState<string[] | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_CREATE);
  const [showPw, setShowPw]           = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition]  = useTransition();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditModules(user.allowed_modules ?? null);
  };

  const handleUpdateRole = () => {
    if (!editingUser) return;
    startTransition(async () => {
      const [roleRes, modRes] = await Promise.all([
        updateUserRole(editingUser.id, editRole),
        updateUserModules(editingUser.id, editModules),
      ]);
      if (roleRes.error) { showToast(roleRes.error, false); return; }
      if (modRes.error)  { showToast(modRes.error,  false); return; }
      setProfiles(prev => prev.map(p =>
        p.id === editingUser.id ? { ...p, role: editRole, allowed_modules: editModules } : p
      ));
      showToast("Role dan akses modul berhasil diperbarui");
      setEditingUser(null);
    });
  };

  const handleCreate = () => {
    if (!createForm.email || !createForm.full_name || createForm.password.length < 8) return;
    startTransition(async () => {
      const modules = createForm.modules.length === ALL_MODULE_IDS.length ? null : createForm.modules;
      const { error, userId } = await createUser(
        createForm.email, createForm.full_name, createForm.role, createForm.password, modules
      ) as any;
      if (error) { showToast(error, false); return; }
      setProfiles(prev => [...prev, {
        id: userId!, email: createForm.email, full_name: createForm.full_name,
        role: createForm.role, created_at: new Date().toISOString(),
        is_active: true, allowed_modules: modules,
      }].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      showToast(`Akun ${createForm.full_name} berhasil dibuat`);
      setCreateForm(EMPTY_CREATE);
      setShowCreate(false);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const { error } = await deleteUser(id);
      if (error) { showToast(error, false); setDeleteId(null); return; }
      setProfiles(prev => prev.filter(p => p.id !== id));
      showToast("User berhasil dihapus");
      setDeleteId(null);
    });
  };

  const handleToggleStatus = (userId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_active: newActive } : p));
    startTransition(async () => {
      const { error } = await toggleUserStatus(userId, newActive);
      if (error) {
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_active: currentActive } : p));
        showToast(error, false);
        return;
      }
      showToast(newActive ? "User berhasil diaktifkan" : "User berhasil dinonaktifkan");
    });
  };

  const filtered = profiles.filter(p => {
    const matchSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || p.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleStats = (Object.keys(ROLE_LABELS) as Role[]).map(r => ({
    role: r, count: profiles.filter(p => p.role === r).length,
  })).filter(r => r.count > 0);

  const deleteTarget = profiles.find(p => p.id === deleteId);

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
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
          }}>
            <Settings size={17} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Pengaturan</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
              Manajemen pengguna & akses · {profiles.length} anggota tim
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setShowCreate(true); setCreateForm(EMPTY_CREATE); setShowPw(false); }}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
          }}
        >
          <Plus size={15} />
          Buat Akun
        </motion.button>
      </div>

      <div className="board-main" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Role distribution */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {roleStats.map((r, i) => {
            const col = ROLE_COLOR[r.role];
            return (
              <motion.button
                key={r.role}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setRoleFilter(roleFilter === r.role ? "all" : r.role)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 20,
                  border: `1.5px solid ${roleFilter === r.role ? col.text : col.border}`,
                  background: roleFilter === r.role ? col.bg : "#fff",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: col.text }}>{r.count}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: col.text }}>{ROLE_LABELS[r.role]}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 18px" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 36px",
                border: "1.5px solid #e5e7eb", borderRadius: 10,
                fontSize: 13, color: "#111827", outline: "none",
                boxSizing: "border-box", background: "#f9fafb",
              }}
              onFocus={e => (e.target.style.borderColor = "#6366f1")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>
        </div>

        {/* User table */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 90px 1fr 140px",
            padding: "11px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
          }}>
            {["Nama", "Email", "Role", "Status", "Bergabung", "Aksi"].map(h => (
              <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {h}
              </p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Users size={28} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "#9ca3af" }}>Tidak ada pengguna ditemukan</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((user, i) => {
                const col = ROLE_COLOR[user.role] ?? ROLE_COLOR.staff_dokumen;
                const isMe = user.id === currentUser.id;
                const isSuperAdmin = user.role === "super_admin";
                const isActive = user.is_active !== false;
                const moduleCount = user.allowed_modules?.length ?? ALL_MODULE_IDS.length;
                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.03, duration: 0.22 }}
                    style={{
                      display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 90px 1fr 140px",
                      padding: "14px 20px", alignItems: "center",
                      borderBottom: "1px solid #f9fafb",
                      background: isMe ? "#f9fafb" : "#fff",
                      opacity: isActive ? 1 : 0.55,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar id={user.id} name={user.full_name || "?"} avatarUrl={user.avatar_url} size={34} ringColor="#f3f4f6" />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{user.full_name || "—"}</p>
                          {isMe && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "1px 6px" }}>
                              Kamu
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                          {isSuperAdmin && (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <Shield size={10} color="#f59e0b" />
                              <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Super Admin</span>
                            </div>
                          )}
                          {!isSuperAdmin && user.allowed_modules && (
                            <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 500 }}>
                              {moduleCount} modul
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Mail size={12} color="#9ca3af" />
                      <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user.email}
                      </span>
                    </div>

                    {/* Role */}
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                        background: col.bg, color: col.text, border: `1px solid ${col.border}`,
                      }}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      {isActive ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                          Aktif
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                          Nonaktif
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>{fmtDate(user.created_at)}</p>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {!isMe && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                            onClick={() => openEdit(user)}
                            style={{ padding: 7, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}
                            title="Edit role & modul"
                          >
                            <Edit2 size={13} color="#6b7280" />
                          </motion.button>
                          {currentUser.role === "super_admin" && !isSuperAdmin && (<>
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              onClick={() => handleToggleStatus(user.id, isActive)}
                              title={isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
                              style={{ padding: 7, border: `1px solid ${isActive ? "#fde68a" : "#bbf7d0"}`, background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}
                            >
                              <Power size={13} color={isActive ? "#f59e0b" : "#16a34a"} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              onClick={() => setDeleteId(user.id)}
                              style={{ padding: 7, border: "1px solid #fee2e2", background: "#fff", borderRadius: 8, cursor: "pointer", display: "flex" }}
                              title="Hapus user"
                            >
                              <Trash2 size={13} color="#ef4444" />
                            </motion.button>
                          </>)}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Edit Role & Modul Modal ── */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar id={editingUser.id} name={editingUser.full_name || "?"} avatarUrl={editingUser.avatar_url} size={36} ringColor="#e5e7eb" />
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Edit Akses</h2>
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>{editingUser.full_name}</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setEditingUser(null)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Role picker */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 10 }}>Role</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => {
                      const col = ROLE_COLOR[r];
                      return (
                        <motion.button key={r} whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
                          onClick={() => setEditRole(r)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 10, cursor: "pointer", border: editRole === r ? `1.5px solid ${col.text}` : "1.5px solid #e5e7eb", background: editRole === r ? col.bg : "#f9fafb", transition: "all 0.12s" }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 500, color: editRole === r ? col.text : "#374151" }}>{label}</span>
                          {editRole === r && <Check size={14} color={col.text} />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Module access */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                      Modul yang Dapat Diakses
                    </label>
                    <button
                      onClick={() => setEditModules(editModules === null ? [...ALL_MODULE_IDS] : null)}
                      style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      {editModules === null ? "Batasi Akses" : "Akses Penuh"}
                    </button>
                  </div>
                  {editModules === null ? (
                    <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 10 }}>
                      <p style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Akses penuh ke semua modul</p>
                      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Klik &quot;Batasi Akses&quot; untuk memilih modul tertentu</p>
                    </div>
                  ) : (
                    <ModuleChecklist
                      selected={editModules}
                      onChange={setEditModules}
                    />
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateRole}
                  disabled={isPending}
                  style={{
                    width: "100%", padding: "12px",
                    background: isPending ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                  }}
                >
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Buat Akun Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Buat Akun Anggota</h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Akun langsung aktif, tidak perlu konfirmasi email</p>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}>
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Nama Lengkap <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <UserCircle size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type="text"
                      placeholder="Contoh: Ahmad Fauzi"
                      value={createForm.full_name}
                      onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")}
                      onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Email <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type="email"
                      placeholder="ahmad@grcc.id"
                      value={createForm.email}
                      onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")}
                      onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Password Awal <span style={{ color: "#ef4444" }}>*</span>
                    <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>min. 8 karakter</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={createForm.password}
                      onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                      style={{ width: "100%", padding: "10px 40px 10px 36px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "#6366f1")}
                      onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {createForm.password.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                      {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: createForm.password.length > i * 2 + 1 ? (createForm.password.length < 8 ? "#f59e0b" : "#10b981") : "#f3f4f6" }} />
                      ))}
                      <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {createForm.password.length < 8 ? "Terlalu pendek" : "OK"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Role</label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as Role }))}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb", cursor: "pointer", boxSizing: "border-box" }}
                  >
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                      <option key={r} value={r}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Modules */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
                    Modul yang Dapat Diakses
                  </label>
                  <ModuleChecklist
                    selected={createForm.modules}
                    onChange={modules => setCreateForm(f => ({ ...f, modules }))}
                    compact
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={isPending || !createForm.email || !createForm.full_name || createForm.password.length < 8}
                  style={{
                    marginTop: 4, width: "100%", padding: "12px",
                    background: isPending || !createForm.email || !createForm.full_name || createForm.password.length < 8
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: isPending || !createForm.email || !createForm.full_name || createForm.password.length < 8 ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                  }}
                >
                  {isPending ? "Membuat Akun..." : "Buat Akun"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.2)", textAlign: "center" }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Pengguna?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                <strong>{deleteTarget?.full_name}</strong> akan dihapus permanen.
              </p>
              <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 20 }}>Semua data terkait akan ikut terhapus.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Batal
                </button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(deleteId)} disabled={isPending}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  {isPending ? "Menghapus..." : "Hapus"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, background: toast.ok ? "#111827" : "#ef4444", color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}
          >
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
