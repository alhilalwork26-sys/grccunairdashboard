"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserProfile, Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import { updateUserRole, inviteUser, deleteUser } from "./actions";
import {
  Settings, Users, Plus, X, Check, Search,
  Edit2, Trash2, Shield, Mail, UserCircle,
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
};


function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_INVITE = { email: "", full_name: "", role: "staff_marketing" as Role };

interface Props {
  currentUser: UserProfile;
  initialProfiles: UserProfile[];
}

export default function SettingsBoard({ currentUser, initialProfiles }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfiles);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<Role>("staff_marketing");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateRole = () => {
    if (!editingUser) return;
    startTransition(async () => {
      const { error } = await updateUserRole(editingUser.id, editRole);
      if (error) { showToast(error, false); return; }
      setProfiles(prev => prev.map(p => p.id === editingUser.id ? { ...p, role: editRole } : p));
      showToast("Role berhasil diperbarui");
      setEditingUser(null);
    });
  };

  const handleInvite = () => {
    if (!inviteForm.email || !inviteForm.full_name) return;
    startTransition(async () => {
      const { error, userId } = await inviteUser(inviteForm.email, inviteForm.full_name, inviteForm.role) as any;
      if (error) { showToast(error, false); return; }
      setProfiles(prev => [...prev, {
        id: userId!, email: inviteForm.email,
        full_name: inviteForm.full_name, role: inviteForm.role,
        created_at: new Date().toISOString(),
      }].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      showToast(`${inviteForm.full_name} berhasil diundang`);
      setInviteForm(EMPTY_INVITE);
      setShowInvite(false);
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
          onClick={() => { setShowInvite(true); setInviteForm(EMPTY_INVITE); }}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
          }}
        >
          <Plus size={15} />
          Undang Anggota
        </motion.button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
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
                <span style={{ fontSize: 12, fontWeight: 700, color: col.text }}>
                  {r.count}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: col.text }}>
                  {ROLE_LABELS[r.role]}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
          padding: "14px 18px",
        }}>
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
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#6366f1")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>
        </div>

        {/* User table */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 100px",
            padding: "11px 20px", background: "#f9fafb",
            borderBottom: "1px solid #f3f4f6",
          }}>
            {["Nama", "Email", "Role", "Bergabung", "Aksi"].map(h => (
              <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {h}
              </p>
            ))}
          </div>

          {/* Rows */}
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
                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.03, duration: 0.22 }}
                    style={{
                      display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 100px",
                      padding: "14px 20px", alignItems: "center",
                      borderBottom: "1px solid #f9fafb",
                      background: isMe ? "#f9fafb" : "#fff",
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar id={user.id} name={user.full_name || "?"} avatarUrl={user.avatar_url} size={34} ringColor="#f3f4f6" />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{user.full_name || "—"}</p>
                          {isMe && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: "#6366f1",
                              background: "#eef2ff", border: "1px solid #c7d2fe",
                              borderRadius: 20, padding: "1px 6px",
                            }}>Kamu</span>
                          )}
                        </div>
                        {isSuperAdmin && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                            <Shield size={10} color="#f59e0b" />
                            <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Super Admin</span>
                          </div>
                        )}
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

                    {/* Date */}
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>{fmtDate(user.created_at)}</p>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {!isMe && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                            onClick={() => { setEditingUser(user); setEditRole(user.role); }}
                            style={{
                              padding: 7, border: "1px solid #e5e7eb", background: "#fff",
                              borderRadius: 8, cursor: "pointer", display: "flex",
                            }}
                            title="Edit role"
                          >
                            <Edit2 size={13} color="#6b7280" />
                          </motion.button>
                          {currentUser.role === "super_admin" && !isSuperAdmin && (
                            <motion.button
                              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                              onClick={() => setDeleteId(user.id)}
                              style={{
                                padding: 7, border: "1px solid #fee2e2", background: "#fff",
                                borderRadius: 8, cursor: "pointer", display: "flex",
                              }}
                              title="Hapus user"
                            >
                              <Trash2 size={13} color="#ef4444" />
                            </motion.button>
                          )}
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

      {/* Edit Role Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar id={editingUser.id} name={editingUser.full_name || "?"} avatarUrl={editingUser.avatar_url} size={36} ringColor="#e5e7eb" />
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Ubah Role</h2>
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>{editingUser.full_name}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setEditingUser(null)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}
                >
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px 24px" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 10 }}>
                  Pilih Role
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflow: "auto" }}>
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => {
                    const col = ROLE_COLOR[r];
                    return (
                      <motion.button
                        key={r}
                        whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
                        onClick={() => setEditRole(r)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                          border: editRole === r ? `1.5px solid ${col.text}` : "1.5px solid #e5e7eb",
                          background: editRole === r ? col.bg : "#f9fafb",
                          transition: "all 0.12s",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: editRole === r ? col.text : "#374151" }}>
                          {label}
                        </span>
                        {editRole === r && <Check size={14} color={col.text} />}
                      </motion.button>
                    );
                  })}
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateRole}
                  disabled={isPending || editRole === editingUser.role}
                  style={{
                    marginTop: 16, width: "100%", padding: "12px",
                    background: isPending || editRole === editingUser.role ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: isPending || editRole === editingUser.role ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setShowInvite(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Undang Anggota Baru</h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    Link akses akan dikirim ke email
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowInvite(false)}
                  style={{ padding: 6, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer" }}
                >
                  <X size={16} color="#6b7280" />
                </motion.button>
              </div>

              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Nama Lengkap", key: "full_name", placeholder: "Contoh: Ahmad Fauzi", icon: <UserCircle size={14} /> },
                  { label: "Email", key: "email", placeholder: "contoh@grcc.id", icon: <Mail size={14} /> },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      {f.label} <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                        {f.icon}
                      </span>
                      <input
                        type={f.key === "email" ? "email" : "text"}
                        placeholder={f.placeholder}
                        value={(inviteForm as any)[f.key]}
                        onChange={e => setInviteForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{
                          width: "100%", padding: "10px 12px 10px 36px",
                          border: "1.5px solid #e5e7eb", borderRadius: 10,
                          fontSize: 13, color: "#111827", outline: "none",
                          fontFamily: "inherit", boxSizing: "border-box",
                          transition: "border-color 0.15s",
                        }}
                        onFocus={e => (e.target.style.borderColor = "#6366f1")}
                        onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as Role }))}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      fontSize: 13, color: "#111827", outline: "none",
                      background: "#f9fafb", cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                      <option key={r} value={r}>{label}</option>
                    ))}
                  </select>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleInvite}
                  disabled={isPending || !inviteForm.email || !inviteForm.full_name}
                  style={{
                    marginTop: 4, width: "100%", padding: "12px",
                    background: isPending || !inviteForm.email || !inviteForm.full_name
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff", border: "none", borderRadius: 12,
                    fontSize: 14, fontWeight: 700,
                    cursor: isPending || !inviteForm.email || !inviteForm.full_name ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {isPending ? "Mengundang..." : "Kirim Undangan"}
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
                background: "#fff", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%",
                boxShadow: "0 25px 50px rgba(0,0,0,0.2)", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Hapus Pengguna?</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                <strong>{deleteTarget?.full_name}</strong> akan dihapus permanen dari sistem.
              </p>
              <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 20 }}>
                Semua data terkait akan ikut terhapus.
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
                  disabled={isPending}
                  style={{
                    flex: 1, padding: "10px", border: "none", borderRadius: 10,
                    background: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff",
                  }}
                >
                  {isPending ? "Menghapus..." : "Hapus"}
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
              maxWidth: 360,
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
