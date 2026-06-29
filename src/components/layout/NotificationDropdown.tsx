"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellRing, Clock, Megaphone, GraduationCap,
  ClipboardCheck, X, ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";

interface VirtualNotif {
  id: string;
  type: "overdue" | "announce" | "training" | "approval";
  title: string;
  body: string;
  href: string;
  time: string;
}

const TYPE_CFG = {
  overdue:  { color: "#ef4444", bg: "#fef2f2", Icon: Clock        },
  announce: { color: "#f59e0b", bg: "#fffbeb", Icon: Megaphone    },
  training: { color: "#3b82f6", bg: "#eff6ff", Icon: GraduationCap },
  approval: { color: "#8b5cf6", bg: "#f5f3ff", Icon: ClipboardCheck },
};

const REIMB_ROLES = ["super_admin", "manager", "kep_finance"];

export default function NotificationDropdown({ userRole }: { userRole?: string }) {
  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState<VirtualNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const supabaseRef = useRef(createClient());

  const fetchBadge = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const canSeeReimbs = !userRole || REIMB_ROLES.includes(userRole);
    const [{ count: overdue }, { count: pending }, { count: newAnn }] = await Promise.all([
      supabaseRef.current.from("tasks").select("*", { count: "exact", head: true })
        .lt("due_date", today).not("status", "eq", "done"),
      canSeeReimbs
        ? supabaseRef.current.from("reimbursements").select("*", { count: "exact", head: true }).eq("status", "pending")
        : Promise.resolve({ count: 0, error: null }),
      supabaseRef.current.from("announcements").select("*", { count: "exact", head: true })
        .order("created_at", { ascending: false }).limit(3),
    ]);
    setBadgeCount((overdue ?? 0) + (pending ?? 0) + Math.min(newAnn ?? 0, 3));
  }, [userRole]);

  const fetchNotifs = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const canSeeReimbs = !userRole || REIMB_ROLES.includes(userRole);
    const [
      { data: overdue },
      { data: announces },
      { data: trainings },
      { data: reimbs },
    ] = await Promise.all([
      supabaseRef.current.from("tasks").select("id, title, due_date")
        .lt("due_date", today).not("status", "eq", "done").limit(5),
      supabaseRef.current.from("announcements").select("id, title, created_at")
        .order("created_at", { ascending: false }).limit(3),
      supabaseRef.current.from("training_sessions").select("id, title, date")
        .eq("status", "upcoming").gte("date", today).lte("date", in7).limit(3),
      canSeeReimbs
        ? supabaseRef.current.from("reimbursements").select("id, title, amount").eq("status", "pending").limit(3)
        : Promise.resolve({ data: [] }),
    ]);

    const result: VirtualNotif[] = [];
    (overdue ?? []).forEach(t => result.push({
      id: `overdue-${t.id}`, type: "overdue",
      title: "Task Melewati Deadline", body: t.title,
      href: "/dashboard/task-management", time: t.due_date,
    }));
    (reimbs ?? []).forEach(r => result.push({
      id: `reimb-${r.id}`, type: "approval",
      title: "Reimbursement Menunggu Review",
      body: `${r.title} — Rp ${(r.amount ?? 0).toLocaleString("id-ID")}`,
      href: "/dashboard/approvals", time: new Date().toISOString(),
    }));
    (trainings ?? []).forEach(t => result.push({
      id: `training-${t.id}`, type: "training",
      title: "Training Akan Datang", body: `${t.title} · ${t.date}`,
      href: "/dashboard/training", time: t.date,
    }));
    (announces ?? []).forEach(a => result.push({
      id: `ann-${a.id}`, type: "announce",
      title: "Pengumuman Terbaru", body: a.title,
      href: "/dashboard/announce", time: a.created_at,
    }));
    setNotifs(result);
  }, [userRole]);

  // Single always-on subscription — updates badge instantly, updates list if dropdown is open
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    fetchBadge();
    const handleChange = () => {
      fetchBadge();
      if (openRef.current) fetchNotifs();
    };
    const channel = supabaseRef.current
      .channel("notif-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, handleChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements" }, handleChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, handleChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_sessions" }, handleChange)
      .subscribe();
    return () => { supabaseRef.current.removeChannel(channel); };
  }, [fetchBadge, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    await fetchNotifs();
    setLoading(false);
    setBadgeCount(0);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: open
            ? (isDark ? "#052e16" : "#f0fdf4")
            : (isDark ? "#0f172a" : "#f9fafb"),
          border: `1px solid ${open
            ? (isDark ? "#065f46" : "#d1fae5")
            : (isDark ? "#334155" : "#e5e7eb")}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative",
        }}
      >
        {badgeCount > 0
          ? <BellRing size={16} style={{ color: "#10b981" }} />
          : <Bell size={16} style={{ color: "#6b7280" }} />
        }
        {badgeCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 17, height: 17, borderRadius: 9,
            background: "#ef4444", border: "2px solid white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "white", padding: "0 3px",
          }}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              width: 340,
              background: isDark ? "#1e293b" : "#ffffff",
              border: `1px solid ${isDark ? "#334155" : "#e5e7eb"}`,
              borderRadius: 14,
              boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.4)" : "0 12px 40px rgba(0,0,0,0.1)",
              zIndex: 100, overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${isDark ? "#334155" : "#f3f4f6"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Bell size={14} color="#10b981" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f1f5f9" : "#111827" }}>Notifikasi</span>
                <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  live
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#9ca3af" }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "32px", textAlign: "center" }}>
                  <div className="spin" style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#10b981", margin: "0 auto" }} />
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>Memuat...</p>
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: "36px 16px", textAlign: "center" }}>
                  <Bell size={28} style={{ color: "#e5e7eb", margin: "0 auto 8px", display: "block" }} />
                  <p style={{ fontSize: 13, color: "#9ca3af" }}>Semua clear!</p>
                  <p style={{ fontSize: 11, color: "#d1d5db", marginTop: 2 }}>Tidak ada notifikasi aktif</p>
                </div>
              ) : notifs.map((n, i) => {
                const cfg = TYPE_CFG[n.type];
                return (
                  <Link key={n.id} href={n.href} style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ background: isDark ? "#0f172a" : "#fafafa" }}
                      style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        borderBottom: i < notifs.length - 1 ? `1px solid ${isDark ? "#334155" : "#f9fafb"}` : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, background: cfg.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, color: cfg.color,
                      }}>
                        <cfg.Icon size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {n.title}
                        </p>
                        <p style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.body}
                        </p>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 16px 12px", borderTop: `1px solid ${isDark ? "#334155" : "#f3f4f6"}` }}>
              <Link href="/dashboard/notifications" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#10b981" }}>
                  Lihat semua notifikasi <ArrowRight size={12} />
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
