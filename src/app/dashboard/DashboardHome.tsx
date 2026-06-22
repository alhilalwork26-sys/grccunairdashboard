"use client";

import { motion } from "framer-motion";
import { CheckSquare, TrendingUp, Bell, CalendarDays, ArrowUpRight, Clock, CircleDot } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import CalendarPanel from "@/components/layout/CalendarPanel";
import type { UserProfile } from "@/types";
import Link from "next/link";

const STATUS_CFG = {
  done:        { label: "Selesai",    color: "#10b981", bg: "#f0fdf4" },
  in_progress: { label: "Dikerjakan", color: "#3b82f6", bg: "#eff6ff" },
  pending:     { label: "Pending",    color: "#f59e0b", bg: "#fffbeb" },
  review:      { label: "Review",     color: "#8b5cf6", bg: "#f5f3ff" },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#9ca3af",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

function fmtDue(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: "Lewat", overdue: true };
  if (diff === 0) return { text: "Hari ini", overdue: false };
  if (diff === 1) return { text: "Besok", overdue: false };
  return { text: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), overdue: false };
}

interface Props {
  user: UserProfile;
  stats: { activeTasks: number; progressToday: number; announcements: number; eventsThisWeek: number };
  recentTasks: any[];
  recentAnnouncements: any[];
}

export default function DashboardHome({ user, stats, recentTasks, recentAnnouncements }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const name = user.full_name?.split(" ")[0] || "Admin";

  const STAT_CARDS = [
    { label: "Task Aktif",        value: stats.activeTasks,      sub: "pending + dikerjakan", icon: CheckSquare,  color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", href: "/dashboard/task-management" },
    { label: "Progress Hari Ini", value: stats.progressToday,    sub: "anggota submit",       icon: TrendingUp,   color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe", href: "/dashboard/progress" },
    { label: "Pengumuman",        value: stats.announcements,    sub: "total tersimpan",      icon: Bell,         color: "#f59e0b", bg: "#fffbeb", border: "#fef3c7", href: "/dashboard/announce" },
    { label: "Event Minggu Ini",  value: stats.eventsThisWeek,   sub: "terjadwal",            icon: CalendarDays, color: "#8b5cf6", bg: "#f5f3ff", border: "#ede9fe", href: "/dashboard/calendar" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar user={user} title="Dashboard" />

      <main style={{ flex: 1, padding: "24px 24px 40px", overflowY: "auto", background: "#f9fafb" }}>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            {greeting}, {name} 👋
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Ringkasan aktivitas tim GRCC hari ini.</p>
        </motion.div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {STAT_CARDS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
                    <motion.div
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.4 }}
                      whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.07)" }}
                      style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 16px 14px", cursor: "pointer", transition: "box-shadow 0.2s" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: s.bg, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} color={s.color} strokeWidth={1.8} />
                        </div>
                        <ArrowUpRight size={13} style={{ color: "#e5e7eb" }} />
                      </div>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 4 }}>{s.label}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{s.sub}</p>
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* Recent tasks + announcements */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 14 }}>

              {/* Tasks */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <CheckSquare size={15} color="#10b981" strokeWidth={2} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Task Terbaru</span>
                  </div>
                  <Link href="/dashboard/task-management" style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Lihat semua →</span>
                  </Link>
                </div>
                {recentTasks.length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada task</p>
                    <Link href="/dashboard/task-management" style={{ textDecoration: "none" }}>
                      <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>+ Buat task pertama</span>
                    </Link>
                  </div>
                ) : recentTasks.map((task, i) => {
                  const s = STATUS_CFG[task.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
                  const due = fmtDue(task.due_date);
                  const assigneeName = (task.assignee as any)?.full_name;
                  return (
                    <motion.div key={task.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      whileHover={{ background: "#fafafa" }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < recentTasks.length - 1 ? "1px solid #f9fafb" : "none", transition: "background 0.15s" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] ?? "#9ca3af", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</p>
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{assigneeName ?? "—"}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                        {due && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: due.overdue ? "#ef4444" : "#9ca3af" }}>
                            <Clock size={9} /> {due.text}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Announcements */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
                style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Bell size={15} color="#f59e0b" strokeWidth={2} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Pengumuman</span>
                  </div>
                  <Link href="/dashboard/announce" style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Semua →</span>
                  </Link>
                </div>
                {recentAnnouncements.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada pengumuman</p>
                  </div>
                ) : recentAnnouncements.map((a, i) => (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    whileHover={{ background: "#fafafa" }}
                    style={{ padding: "11px 16px", borderBottom: i < recentAnnouncements.length - 1 ? "1px solid #f9fafb" : "none", cursor: "pointer", transition: "background 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      {a.priority === "urgent" && <span style={{ marginTop: 3, flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />}
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", lineHeight: 1.45, flex: 1 }}>{a.title}</p>
                    </div>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: a.priority === "urgent" ? 12 : 0 }}>{timeAgo(a.created_at)}</p>
                  </motion.div>
                ))}

                <div style={{ padding: "12px 16px 14px", borderTop: "1px solid #f9fafb" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Akses Cepat</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { label: "Finance", href: "/dashboard/finance", color: "#10b981" },
                      { label: "Training", href: "/dashboard/training", color: "#f59e0b" },
                      { label: "Dokumen", href: "/dashboard/docs", color: "#6366f1" },
                    ].map(l => (
                      <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: l.color, padding: "4px 0" }}>→ {l.label}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>

            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 260, flexShrink: 0 }}>
            <CalendarPanel />
          </motion.div>

        </div>
      </main>
    </div>
  );
}
