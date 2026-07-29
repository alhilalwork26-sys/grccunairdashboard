"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Camera, Loader2, Check, X, Moon, Sun } from "lucide-react";
import type { UserProfile } from "@/types";
import { ROLE_LABELS, PRESENCE_CFG } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import StatusDot from "@/components/ui/StatusDot";
import NotificationDropdown from "./NotificationDropdown";
import SearchModal from "./SearchModal";
import { useTheme } from "@/context/ThemeContext";
import { usePresence } from "@/context/PresenceContext";

interface TopbarProps {
  user: UserProfile | null;
  title: string;
}

export default function Topbar({ user, title }: TopbarProps) {
  const [searchOpen, setSearchOpen]   = useState(false);
  const [avatarMenu, setAvatarMenu]   = useState(false);
  const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url ?? null);
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { isDark, toggle } = useTheme();
  const { myStatus, setMyStatus } = usePresence();

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

    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({ ok: false, text: "Ukuran foto maksimal 10 MB" });
      setTimeout(() => setUploadMsg(null), 3000);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

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

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    setAvatarMenu(false);
    setUploadMsg({ ok: true, text: "Foto berhasil diperbarui" });
    setTimeout(() => setUploadMsg(null), 3000);
    if (fileRef.current) fileRef.current.value = "";
  }

  const displayName  = user?.full_name || user?.email?.split("@")[0] || "User";
  const currentCfg   = PRESENCE_CFG.find(c => c.key === myStatus) ?? PRESENCE_CFG[0];

  // theme tokens
  const topbarBg     = isDark ? "#1e293b" : "#ffffff";
  const topbarBorder = isDark ? "#334155" : "#f3f4f6";
  const textPrimary  = isDark ? "#f1f5f9" : "#111827";
  const textMuted    = isDark ? "#94a3b8" : "#9ca3af";
  const searchBg     = isDark ? "#0f172a" : "#f9fafb";
  const searchBorder = isDark ? "#334155" : "#e5e7eb";
  const kbdBg        = isDark ? "#1e293b" : "#f3f4f6";
  const popoverBg    = isDark ? "#1e293b" : "#fff";
  const popoverBorder = isDark ? "#334155" : "#e5e7eb";
  const dividerColor = isDark ? "#334155" : "#f3f4f6";
  const hoverBg      = isDark ? "#0f172a" : "#f9fafb";

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
          className="topbar-search"
          style={{
            background: searchBg, border: `1px solid ${searchBorder}`,
            borderRadius: 10, padding: "7px 12px",
            justifyContent: "center", overflow: "hidden",
          }}
        >
          <Search size={14} style={{ color: textMuted, flexShrink: 0 }} />
          <span className="topbar-search-text" style={{ fontSize: 13, color: textMuted, flex: 1, textAlign: "left" }}>Cari...</span>
          <kbd className="topbar-search-text" style={{ fontSize: 9, color: textMuted, background: kbdBg, border: `1px solid ${searchBorder}`, borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>
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

        {/* User avatar + profile popover */}
        <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="topbar-user-name">
            <p style={{ fontSize: 13, fontWeight: 600, color: textPrimary, lineHeight: 1.2 }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: currentCfg.color, fontWeight: 500 }}>
              {currentCfg.label}
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
            title="Profil & Status"
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

            {/* Camera overlay on hover */}
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

            {/* Status dot on avatar */}
            <div style={{ position: "absolute", bottom: 0, right: 0 }}>
              <StatusDot status={myStatus} size={11} borderColor={topbarBg} />
            </div>
          </motion.button>

          {/* Profile popover */}
          <AnimatePresence>
            {avatarMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: -6 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  background: popoverBg,
                  border: `1px solid ${popoverBorder}`,
                  borderRadius: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.16)",
                  width: 248, padding: 14, zIndex: 100,
                }}
              >
                {/* User header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {user && (
                      <Avatar id={user.id} name={displayName} avatarUrl={avatarUrl} size={42} ringColor={popoverBorder} />
                    )}
                    <div style={{ position: "absolute", bottom: 0, right: 0 }}>
                      <StatusDot status={myStatus} size={13} borderColor={popoverBg} />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: textPrimary, lineHeight: 1.2 }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                      {user?.role ? ROLE_LABELS[user.role] : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <StatusDot status={myStatus} size={7} borderColor={popoverBg} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: currentCfg.color }}>{currentCfg.label}</span>
                    </div>
                  </div>
                </div>

                {/* Status picker */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, paddingLeft: 4 }}>
                    Status
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {PRESENCE_CFG.map((cfg) => {
                      const isActive = myStatus === cfg.key;
                      return (
                        <motion.button
                          key={cfg.key}
                          whileTap={{ scale: 0.98 }}
                          onClick={async () => {
                            await setMyStatus(cfg.key as Parameters<typeof setMyStatus>[0]);
                          }}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "7px 10px", borderRadius: 9, border: "none",
                            cursor: "pointer", textAlign: "left",
                            background: isActive
                              ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)")
                              : "transparent",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          <StatusDot status={cfg.key as Parameters<typeof setMyStatus>[0]} size={10} borderColor={isActive ? (isDark ? "#1e293b" : "#f3f4f6") : popoverBg} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: textPrimary, lineHeight: 1.2 }}>
                              {cfg.label}
                            </p>
                            <p style={{ fontSize: 10, color: textMuted, lineHeight: 1.2 }}>{cfg.sub}</p>
                          </div>
                          {isActive && <Check size={13} color={cfg.color} strokeWidth={2.5} />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ height: 1, background: dividerColor, marginBottom: 10 }} />

                {/* Photo actions */}
                <motion.button
                  whileHover={{ background: hoverBg }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", borderRadius: 10,
                    border: `1.5px solid ${popoverBorder}`,
                    background: popoverBg,
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
                  JPG, PNG, WebP · maks 10MB
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
