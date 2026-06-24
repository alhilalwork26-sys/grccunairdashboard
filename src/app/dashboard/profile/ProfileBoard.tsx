"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Shield, Calendar, Key,
  Check, X, Loader2, Eye, EyeOff,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";
import { ROLE_LABELS } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";

export default function ProfileBoard({ user }: { user: UserProfile }) {
  const supabase = createClient();

  // Name edit
  const [name, setName]         = useState(user.full_name || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  // Password
  const [pwForm, setPwForm]     = useState({ next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [pwVisible, setPwVisible] = useState(false);

  async function saveName() {
    if (!name.trim()) return;
    setNameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    setNameSaving(false);
    setNameMsg(error
      ? { ok: false, text: "Gagal menyimpan: " + error.message }
      : { ok: true,  text: "Nama berhasil diperbarui" }
    );
    setTimeout(() => setNameMsg(null), 3000);
  }

  async function changePassword() {
    if (!pwForm.next || !pwForm.confirm) {
      setPwMsg({ ok: false, text: "Isi semua field password" });
      setTimeout(() => setPwMsg(null), 3000);
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ ok: false, text: "Password baru dan konfirmasi tidak cocok" });
      setTimeout(() => setPwMsg(null), 3000);
      return;
    }
    if (pwForm.next.length < 8) {
      setPwMsg({ ok: false, text: "Password minimal 8 karakter" });
      setTimeout(() => setPwMsg(null), 3000);
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setPwSaving(false);
    if (error) {
      setPwMsg({ ok: false, text: "Gagal: " + error.message });
    } else {
      setPwMsg({ ok: true, text: "Password berhasil diubah" });
      setPwForm({ next: "", confirm: "" });
    }
    setTimeout(() => setPwMsg(null), 4000);
  }

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar user={user} title="Profil Saya" />

      <main style={{ flex: 1, padding: "24px 24px 40px", background: "#f9fafb", overflowY: "auto" }}>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <User size={20} color="#10b981" strokeWidth={2} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Profil Saya</h2>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Kelola informasi akun dan keamanan Anda.</p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 860 }}>

          {/* Identity & Name edit */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", padding: "24px" }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Informasi Akun</h3>

            {/* Avatar display */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, padding: "14px 16px", background: "#f9fafb", borderRadius: 12, border: "1px solid #f3f4f6" }}>
              <Avatar id={user.id} name={user.full_name || user.email} avatarUrl={user.avatar_url ?? null} size={52} ringColor="#d1fae5" />
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{user.full_name || "—"}</p>
                <p style={{ fontSize: 12, color: "#10b981", fontWeight: 600, marginTop: 1 }}>
                  {user.role ? ROLE_LABELS[user.role] : user.role}
                </p>
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Ganti foto melalui ikon di topbar kanan atas</p>
              </div>
            </div>

            {/* Read-only info */}
            {[
              { icon: Mail,     label: "Email",    value: user.email },
              { icon: Shield,   label: "Role",     value: user.role?.replace(/_/g, " ") },
              { icon: Calendar, label: "Bergabung", value: joinDate },
            ].map(row => {
              const Icon = row.icon;
              return (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f9fafb" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={13} color="#10b981" />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>{row.label}</p>
                    <p style={{ fontSize: 13, color: "#374151" }}>{row.value}</p>
                  </div>
                </div>
              );
            })}

            {/* Name edit */}
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Ubah Nama Tampilan
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveName()}
                  className="clean-input"
                  style={{ flex: 1, padding: "10px 14px", fontSize: 13, borderRadius: 10 }}
                  placeholder="Nama lengkap..."
                />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={saveName}
                  disabled={nameSaving || !name.trim()}
                  style={{
                    padding: "10px 16px", borderRadius: 10,
                    background: nameSaving || !name.trim() ? "#e5e7eb" : "#10b981",
                    color: nameSaving || !name.trim() ? "#9ca3af" : "#fff",
                    border: "none", cursor: nameSaving || !name.trim() ? "not-allowed" : "pointer",
                    fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  }}
                >
                  {nameSaving
                    ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
                    : <Check size={13} />
                  }
                  Simpan
                </motion.button>
              </div>
              <AnimatePresence>
                {nameMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ fontSize: 12, color: nameMsg.ok ? "#10b981" : "#ef4444", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {nameMsg.ok ? <Check size={11} /> : <X size={11} />} {nameMsg.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Password change */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", padding: "24px" }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Ubah Password</h3>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>Minimal 8 karakter. Semua sesi lain akan logout otomatis.</p>

            {[
              { key: "next" as const,    label: "Password Baru",         placeholder: "Masukkan password baru..." },
              { key: "confirm" as const, label: "Konfirmasi Password",    placeholder: "Ulangi password baru..." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  {f.label}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={pwVisible ? "text" : "password"}
                    value={pwForm[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && changePassword()}
                    className="clean-input"
                    style={{ fontSize: 13, padding: "10px 42px 10px 14px", borderRadius: 10 }}
                    placeholder={f.placeholder}
                  />
                  {f.key === "next" && (
                    <button
                      type="button"
                      onClick={() => setPwVisible(v => !v)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "#9ca3af", display: "flex", alignItems: "center",
                      }}
                    >
                      {pwVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Strength hint */}
            {pwForm.next.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", gap: 4 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{
                    height: 3, flex: 1, borderRadius: 2,
                    background: pwForm.next.length > i * 2 + 1
                      ? (pwForm.next.length < 8 ? "#f59e0b" : pwForm.next.length < 12 ? "#10b981" : "#059669")
                      : "#f3f4f6",
                    transition: "background 0.2s",
                  }} />
                ))}
                <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", alignSelf: "center" }}>
                  {pwForm.next.length < 8 ? "Lemah" : pwForm.next.length < 12 ? "Cukup" : "Kuat"}
                </span>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={changePassword}
              disabled={pwSaving}
              style={{
                width: "100%", marginTop: 4,
                padding: "11px 16px", borderRadius: 11,
                background: pwSaving ? "#e5e7eb" : "#111827",
                color: pwSaving ? "#9ca3af" : "#fff",
                border: "none", cursor: pwSaving ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {pwSaving
                ? <><Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> Mengubah...</>
                : <><Key size={13} /> Ubah Password</>
              }
            </motion.button>

            <AnimatePresence>
              {pwMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 12, color: pwMsg.ok ? "#10b981" : "#ef4444", marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}
                >
                  {pwMsg.ok ? <Check size={11} /> : <X size={11} />} {pwMsg.text}
                </motion.p>
              )}
            </AnimatePresence>

            <div style={{ marginTop: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 3 }}>Catatan Keamanan</p>
              <p style={{ fontSize: 11, color: "#b45309", lineHeight: 1.6 }}>
                Password baru berlaku langsung. Gunakan kombinasi huruf, angka, dan simbol untuk keamanan lebih baik.
              </p>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
