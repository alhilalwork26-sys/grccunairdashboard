"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Camera, Loader2, Check, X, Moon, Sun } from "lucide-react";
import type { UserProfile } from "@/types";
import { ROLE_LABELS } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import NotificationDropdown from "./NotificationDropdown";
import SearchModal from "./SearchModal";
import { useTheme } from "@/context/ThemeContext";

interface TopbarProps {
  user: UserProfile | null;
  title: string;
}

export default function Topbar({ user, title }: TopbarProps) {
  const [searchOpen, setSearchOpen]     = useState(false);
  const [avatarMenu, setAvatarMenu]     = useState(false);
  const [avatarUrl, setAvatarUrl]       = useState(user?.avatar_url ?? null);
  const [uploading, setUploading]       = useState(false);
  const [uploadMsg, setUploadMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { isDark, toggle } = useTheme();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAvatarMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setUploadMsg(null);

    const ext  = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      setUploading(false);
      setUploadMsg({ ok: false, text: "Gagal upload foto" });
      setTimeout(() => setUploadMsg(null), 3000);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const url = `${publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);

    setAvatarUrl(url);
    setUploading(false);
    setAvatarMenu(false);
    setUploadMsg({ ok: true, text: "Foto berhasil diperbarui" });
    setTimeout(() => setUploadMsg(null), 3000);

    if (fileRef.current) fileRef.current.value = "";
  }

  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";

  // theme tokens
  const topbarBg     = isDark ? "#1e293b" : "#ffffff";
  const topbarBorder = isDark ? "#334155" : "#f3f4f6";
  const textPrimary  = isDark ? "#f1f5f9" : "#111827";
  const textMuted    = isDark ? "#94a3b8" : "#9ca3af";
  const searchBg     = isDark ? "#0f172a" : "#f9fafb";
  const searchBorder = isDark ? "#334155" : "#e5e7eb";
  const kbdBg        = isDark ? "#1e293b" : "#f3f4f6";

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          height: 60,
          background: topbarBg,
          borderBottom: `1px solid ${topbarBorder}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px 0 60px",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 20,
          transition: "background 0.2s, border-color 0.2s",
        }}
        className="dashboard-topbar"
      >
        {/* Title */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: textPrimary, letterSpacing: "-0.02em" }}>
            {title}
          </h1>
        </div>

        {/* Search trigger */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSearchOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: searchBg, border: `1px solid ${searchBorder}`,
            borderRadius: 10, padding: "7px 12px",
            width: 220, cursor: "text",
          }}
        >
          <Search size={14} style={{ color: textMuted, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: textMuted, flex: 1, textAlign: "left" }}>Cari...</span>
          <kbd style={{ fontSize: 9, color: textMuted, background: kbdBg, border: `1px solid ${searchBorder}`, borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>
            ⌘K
          </kbd>
        </motion.button>

        {/* Dark mode toggle */}
        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          onClick={toggle}
          title={isDark ? "Mode Terang" : "Mode Gelap"}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: isDark ? "#0f172a" : "#f9fafb",
            border: `1px solid ${searchBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          {isDark
            ? <Sun size={15} style={{ color: "#fbbf24" }} />
            : <Moon size={15} style={{ color: "#6b7280" }} />
          }
        </motion.button>

        {/* Notification bell */}
        <NotificationDropdown userRole={user?.role} />

        {/* User avatar + upload popover */}
        <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: textPrimary, lineHeight: 1.2 }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>
              {user?.role ? ROLE_LABELS[user.role] : ""}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAvatarMenu(v => !v)}
            style={{
              position: "relative", cursor: "pointer",
              background: "none", border: "none", padding: 0,
              borderRadius: "50%",
            }}
            title="Ganti foto profil"
          >
            {user ? (
              <Avatar id={user.id} name={displayName} avatarUrl={avatarUrl} size={34} ringColor="#e5e7eb" />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #047857)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "white",
              }}>?</div>
            )}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: avatarMenu ? 1 : 0,
              transition: "opacity 0.15s",
              pointerEvents: "none",
            }}>
              <Camera size={12} color="white" />
            </div>
          </motion.button>

          {/* Upload popover */}
          <AnimatePresence>
            {avatarMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: -6 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  background: isDark ? "#1e293b" : "#fff",
                  border: `1px solid ${isDark ? "#334155" : "#e5e7eb"}`,
                  borderRadius: 14, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
                  width: 220, padding: 14, zIndex: 100,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  {user && (
                    <Avatar id={user.id} name={displayName} avatarUrl={avatarUrl} size={44} ringColor="#e5e7eb" />
                  )}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: textMuted }}>Foto Profil</p>
                  </div>
                </div>

                <div style={{ height: 1, background: isDark ? "#334155" : "#f3f4f6", marginBottom: 12 }} />

                <motion.button
                  whileHover={{ background: isDark ? "#0f172a" : "#f9fafb" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", borderRadius: 10,
                    border: `1.5px solid ${isDark ? "#334155" : "#e5e7eb"}`,
                    background: isDark ? "#1e293b" : "#fff",
                    cursor: uploading ? "not-allowed" : "pointer",
                    fontSize: 13, fontWeight: 600, color: textPrimary,
                    transition: "background 0.12s",
                  }}
                >
                  {uploading
                    ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Mengupload...</>
                    : <><Camera size={14} color="#6b7280" /> Ganti Foto</>
                  }
                </motion.button>

                {avatarUrl && !uploading && (
                  <motion.button
                    whileHover={{ background: "#fef2f2" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (!user) return;
                      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
                      setAvatarUrl(null);
                      setAvatarMenu(false);
                    }}
                    style={{
                      marginTop: 6, width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 12px", borderRadius: 10,
                      border: "1.5px solid #fecaca", background: "transparent",
                      cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#ef4444",
                      transition: "background 0.12s",
                    }}
                  >
                    <X size={14} /> Hapus Foto
                  </motion.button>
                )}

                <p style={{ fontSize: 10, color: textMuted, marginTop: 10, textAlign: "center" }}>
                  JPG, PNG, WebP · maks 5MB
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Upload toast */}
      <AnimatePresence>
        {uploadMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 200,
              background: uploadMsg.ok ? "#111827" : "#ef4444",
              color: "#fff", borderRadius: 12, padding: "11px 16px",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploadMsg.ok ? <Check size={14} /> : <X size={14} />}
            {uploadMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
