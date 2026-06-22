"use client";

import { motion } from "framer-motion";
import { CheckSquare, TrendingUp, Bell, CalendarDays, ArrowUpRight, Clock, CircleDot } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import CalendarPanel from "@/components/layout/CalendarPanel";
import type { UserProfile } from "@/types";

const STATS = [
  { label: "Task Aktif",        value: "24",   sub: "+3 hari ini",    icon: CheckSquare,  color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
  { label: "Progress Hari Ini", value: "8/12", sub: "anggota submit", icon: TrendingUp,   color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe" },
  { label: "Pengumuman",        value: "3",    sub: "belum dibaca",   icon: Bell,          color: "#f59e0b", bg: "#fffbeb", border: "#fef3c7" },
  { label: "Event Minggu Ini",  value: "5",    sub: "terjadwal",      icon: CalendarDays,  color: "#8b5cf6", bg: "#f5f3ff", border: "#ede9fe" },
];

const RECENT_TASKS = [
  { name: "Revisi materi training Q3",      assign: "Kep. Trainer",  status: "in_progress", due: "Hari ini" },
  { name: "Laporan keuangan Juni",           assign: "Staff Finance", status: "pending",     due: "Besok" },
  { name: "Konten Instagram minggu ini",     assign: "Staff Kreatif", status: "done",        due: "Selesai" },
  { name: "Onboarding klien PT. Maju Jaya", assign: "Program Admin", status: "pending",     due: "23 Jun" },
  { name: "Rekap progres mingguan tim",      assign: "Super Admin",   status: "in_progress", due: "Hari ini" },
];

const STATUS_CFG = {
  done:        { label: "Selesai",    color: "#10b981", bg: "#f0fdf4" },
  in_progress: { label: "Dikerjakan", color: "#3b82f6", bg: "#eff6ff" },
  pending:     { label: "Pending",    color: "#f59e0b", bg: "#fffbeb" },
};

const ANNOUNCEMENTS = [
  { title: "Rapat koordinasi tim — Senin 25 Jun 09.00", time: "2j lalu", urgent: true },
  { title: "Deadline RAB program Q3 diperpanjang",       time: "5j lalu", urgent: false },
  { title: "Update SOP pengarsipan dokumen baru",        time: "1h lalu", urgent: false },
];

interface Props { user: UserProfile }

export default function DashboardHome({ user }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const name = user.full_name?.split(" ")[0] || "Admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar user={user} title="Dashboard" />

      <main style={{ flex: 1, padding: "24px 24px 40px", overflowY: "auto", background: "#f9fafb" }}>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            {greeting}, {name} 👋
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
            Ringkasan aktivitas tim GRCC hari ini.
          </p>
        </motion.div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>


            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {STATS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.4 }}
                    whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.07)" }}
                    style={{
                      background: "#ffffff", border: "1px solid #f3f4f6",
                      borderRadius: 14, padding: "16px 16px 14px",
                      cursor: "default", transition: "box-shadow 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: s.bg, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} color={s.color} strokeWidth={1.8} />
                      </div>
                      <ArrowUpRight size={13} style={{ color: "#e5e7eb" }} />
                    </div>
                    <p style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 4 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{s.sub}</p>
                  </motion.div>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 14 }}>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45 }}
                style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}
              >
                <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <CheckSquare size={15} color="#10b981" strokeWidth={2} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Task Terbaru</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600, cursor: "pointer" }}>Lihat semua →</span>
                </div>
                {RECENT_TASKS.map((task, i) => {
                  const s = STATUS_CFG[task.status as keyof typeof STATUS_CFG];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      whileHover={{ background: "#fafafa" }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 18px",
                        borderBottom: i < RECENT_TASKS.length - 1 ? "1px solid #f9fafb" : "none",
                        transition: "background 0.15s", cursor: "pointer",
                      }}
                    >
                      <CircleDot size={13} style={{ color: s.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</p>
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{task.assign}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#9ca3af" }}>
                          <Clock size={9} /> {task.due}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.36, duration: 0.45 }}
                style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}
              >
                <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Bell size={15} color="#f59e0b" strokeWidth={2} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Pengumuman</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600, cursor: "pointer" }}>Semua →</span>
                </div>
                {ANNOUNCEMENTS.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    whileHover={{ background: "#fafafa" }}
                    style={{ padding: "11px 16px", borderBottom: i < ANNOUNCEMENTS.length - 1 ? "1px solid #f9fafb" : "none", cursor: "pointer", transition: "background 0.15s" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      {a.urgent && <span style={{ marginTop: 3, flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />}
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", lineHeight: 1.45, flex: 1 }}>{a.title}</p>
                    </div>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: a.urgent ? 12 : 0 }}>{a.time}</p>
                  </motion.div>
                ))}

                <div style={{ padding: "12px 16px 14px", borderTop: "1px solid #f9fafb" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Tim Online</p>
                  <div style={{ display: "flex" }}>
                    {["SA", "PM", "SK", "SM", "KF"].map((init, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.55 + i * 0.05 }}
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: `hsl(${160 + i * 30}, 65%, 45%)`,
                          border: "2px solid white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "white",
                          marginLeft: i === 0 ? 0 : -7,
                        }}
                      >{init}</motion.div>
                    ))}
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f3f4f6", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#6b7280", marginLeft: -7 }}>+4</div>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 260, flexShrink: 0 }}
          >
            <CalendarPanel />
          </motion.div>

        </div>
      </main>
    </div>
  );
}
