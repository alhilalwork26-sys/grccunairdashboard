"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CheckSquare, TrendingUp,
  Bell, CalendarDays, Settings, LogOut,
  ChevronLeft, ChevronRight, FolderOpen, Wallet,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/types";

const NAV = [
  { label: "Dashboard",         href: "/dashboard",            icon: LayoutDashboard, phase: null },
  { label: "Daily Progress",    href: "/dashboard/progress",   icon: TrendingUp,      phase: 1 },
  { label: "Task Management",   href: "/dashboard/task-management", icon: CheckSquare, phase: 1 },
  { label: "Announcement",      href: "/dashboard/announce",   icon: Bell,            phase: 1 },
  { label: "Kalender",          href: "/dashboard/calendar",   icon: CalendarDays,    phase: 1 },
  { label: "Dokumen",           href: "/dashboard/docs",       icon: FolderOpen,      phase: 1 },
  { label: "Finance",           href: "/dashboard/finance",    icon: Wallet,          phase: 2 },
  { label: "Pengaturan",        href: "/dashboard/settings",   icon: Settings,        phase: 1 },
];

const PHASE_COLOR = { 1: "#10b981", 2: "#3b82f6", 3: "#f59e0b" } as const;

interface SidebarProps { user: UserProfile | null }

export default function Sidebar({ user }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const w = collapsed ? 72 : 240;

  return (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: w, minWidth: w, height: "100vh",
        position: "sticky", top: 0,
        background: "#ffffff",
        borderRight: "1px solid #f3f4f6",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f3f4f6" }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(145deg, #10b981, #047857)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M13 6.5C12.1 5.5 10.9 4.8 9.5 4.8C7.07 4.8 5.1 6.77 5.1 9.2C5.1 11.63 7.07 13.6 9.5 13.6C10.9 13.6 12.1 12.9 13 11.9" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="9.5" cy="9.2" r="1.6" fill="white"/>
          </svg>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: "hidden", whiteSpace: "nowrap" }}
            >
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1 }}>GRCC</p>
              <p style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", marginTop: 2 }}>UNAIR · v2.1.0</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: 10,
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: active ? "#f0fdf4" : "transparent",
                  transition: "background 0.15s ease",
                  position: "relative",
                }}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="active-pill"
                    style={{
                      position: "absolute", inset: 0, borderRadius: 10,
                      background: "#f0fdf4",
                      border: "1px solid #d1fae5",
                    }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{ color: active ? "#059669" : "#6b7280", flexShrink: 0, position: "relative" }}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        fontSize: 13, fontWeight: active ? 600 : 500,
                        color: active ? "#059669" : "#374151",
                        position: "relative", whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!collapsed && item.phase && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      marginLeft: "auto", fontSize: 9, fontWeight: 700,
                      padding: "2px 6px", borderRadius: 20,
                      background: `${PHASE_COLOR[item.phase as keyof typeof PHASE_COLOR]}18`,
                      color: PHASE_COLOR[item.phase as keyof typeof PHASE_COLOR],
                      letterSpacing: "0.04em", position: "relative",
                    }}
                  >
                    P{item.phase}
                  </motion.span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div style={{ padding: "8px 8px 16px", borderTop: "1px solid #f3f4f6" }}>
        {/* User card */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: 4,
                background: "#f9fafb", border: "1px solid #f3f4f6",
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.full_name || user.email}
              </p>
              <p style={{ fontSize: 11, color: "#10b981", fontWeight: 500, marginTop: 1 }}>
                {user.role?.replace(/_/g, " ")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logout */}
        <motion.button
          whileHover={{ x: collapsed ? 0 : 2 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            gap: 10, padding: collapsed ? "10px" : "10px 12px",
            borderRadius: 10, border: "none", background: "transparent",
            cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start",
          }}
          title={collapsed ? "Keluar" : undefined}
        >
          <LogOut size={17} strokeWidth={1.7} style={{ color: "#9ca3af", flexShrink: 0 }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", whiteSpace: "nowrap" }}
              >
                Keluar
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Collapse toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-end",
            padding: "6px 12px", border: "none",
            background: "transparent", cursor: "pointer",
          }}
        >
          {collapsed
            ? <ChevronRight size={14} style={{ color: "#d1d5db" }} />
            : <ChevronLeft size={14} style={{ color: "#d1d5db" }} />
          }
        </motion.button>
      </div>
    </motion.aside>
  );
}
