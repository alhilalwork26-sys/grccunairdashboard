"use client";

import { motion } from "framer-motion";
import { Bell, Search } from "lucide-react";
import type { UserProfile } from "@/types";
import { ROLE_LABELS } from "@/types";

interface TopbarProps {
  user: UserProfile | null;
  title: string;
}

export default function Topbar({ user, title }: TopbarProps) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        height: 60,
        background: "#ffffff",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Title */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: "7px 12px",
          width: 220,
        }}
      >
        <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
        <input
          placeholder="Cari..."
          style={{
            background: "transparent", border: "none", outline: "none",
            fontSize: 13, color: "#374151", width: "100%",
          }}
        />
      </div>

      {/* Notif */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative",
        }}
      >
        <Bell size={16} style={{ color: "#6b7280" }} />
        {/* Badge */}
        <span style={{
          position: "absolute", top: 7, right: 7,
          width: 7, height: 7, borderRadius: "50%",
          background: "#10b981", border: "1.5px solid white",
        }} />
      </motion.button>

      {/* User avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>
            {user?.full_name || user?.email?.split("@")[0] || "User"}
          </p>
          <p style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>
            {user?.role ? ROLE_LABELS[user.role] : ""}
          </p>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #047857)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "white",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
          }}
        >
          {(user?.full_name || user?.email || "U")[0].toUpperCase()}
        </motion.div>
      </div>
    </motion.header>
  );
}
