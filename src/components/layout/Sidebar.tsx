"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CheckSquare, TrendingUp,
  Bell, CalendarDays, Settings, LogOut,
  ChevronLeft, ChevronRight, FolderOpen, Wallet,
  GraduationCap, ClipboardCheck, BarChart2, BellRing, User,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/types";
import { useTheme } from "@/context/ThemeContext";

const NAV = [
  { label: "Dashboard",         href: "/dashboard",                  icon: LayoutDashboard },
  { label: "Daily Progress",    href: "/dashboard/progress",         icon: TrendingUp      },
  { label: "Task Management",   href: "/dashboard/task-management",  icon: CheckSquare     },
  { label: "Announcement",      href: "/dashboard/announce",         icon: Bell            },
  { label: "Kalender",          href: "/dashboard/calendar",         icon: CalendarDays    },
  { label: "Dokumen",           href: "/dashboard/docs",             icon: FolderOpen      },
  { label: "Finance",           href: "/dashboard/finance",          icon: Wallet          },
  { label: "Training",          href: "/dashboard/training",         icon: GraduationCap   },
  { label: "Approval Center",   href: "/dashboard/approvals",        icon: ClipboardCheck  },
  { label: "Laporan",           href: "/dashboard/report",           icon: BarChart2       },
  { label: "Notifikasi",        href: "/dashboard/notifications",    icon: BellRing        },
  { label: "Pengaturan",        href: "/dashboard/settings",         icon: Settings        },
  { label: "Profil",            href: "/dashboard/profile",          icon: User            },
];

interface SidebarProps {
  user: UserProfile | null;
  onClose?: () => void;
}

export default function Sidebar({ user, onClose }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { isDark } = useTheme();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const w = collapsed ? 72 : 240;

  // theme tokens
  const bg          = isDark ? "#1e293b" : "#ffffff";
  const border      = isDark ? "#334155" : "#f3f4f6";
  const textPrimary = isDark ? "#f1f5f9" : "#111827";
  const textMuted   = isDark ? "#94a3b8" : "#9ca3af";
  const textSub     = isDark ? "#64748b" : "#9ca3af";
  const navActiveBg     = isDark ? "#052e16" : "#f0fdf4";
  const navActiveBorder = isDark ? "#065f46" : "#d1fae5";
  const navActiveColor  = isDark ? "#34d399" : "#059669";
  const navText         = isDark ? "#cbd5e1" : "#374151";
  const userCardBg      = isDark ? "#0f172a" : "#f9fafb";

  return (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: w, minWidth: w, height: "100vh",
        position: "sticky", top: 0,
        background: bg,
        borderRight: `1px solid ${border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        zIndex: 30,
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${border}`, justifyContent: "space-between" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, letterSpacing: "-0.02em", lineHeight: 1 }}>GRCC</p>
                <p style={{ fontSize: 10, color: textSub, fontFamily: "monospace", marginTop: 2 }}>UNAIR · v2.1.0</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {onClose && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", display: "flex", flexShrink: 0 }}>
            <ChevronLeft size={18} color={textMuted} />
          </motion.button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }} onClick={onClose}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: 10,
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: active ? navActiveBg : "transparent",
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
                      background: navActiveBg,
                      border: `1px solid ${navActiveBorder}`,
                    }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{ color: active ? navActiveColor : textMuted, flexShrink: 0, position: "relative" }}
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
                        color: active ? navActiveColor : navText,
                        position: "relative", whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div style={{ padding: "8px 8px 16px", borderTop: `1px solid ${border}` }}>
        {/* User card */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              style={{
                padding: "10px 12px", borderRadius: 10, marginBottom: 4,
                background: userCardBg, border: `1px solid ${border}`,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          <LogOut size={17} strokeWidth={1.7} style={{ color: textMuted, flexShrink: 0 }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: 13, fontWeight: 500, color: textMuted, whiteSpace: "nowrap" }}
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
            ? <ChevronRight size={14} style={{ color: textMuted }} />
            : <ChevronLeft size={14} style={{ color: textMuted }} />
          }
        </motion.button>
      </div>
    </motion.aside>
  );
}
