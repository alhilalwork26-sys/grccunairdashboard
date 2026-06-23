"use client";

import { motion } from "framer-motion";
import {
  BarChart2, CheckSquare, Wallet, TrendingUp,
  GraduationCap, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import type { UserProfile } from "@/types";

function fmtRupiah(n: number) {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}

function fmtRupiahFull(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

// Animated horizontal bar chart
function BarChart({ data }: { data: { label: string; value: number; color: string; sub?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 86, fontSize: 11, color: "#6b7280", textAlign: "right", flexShrink: 0, lineHeight: 1.3 }}>
            {d.label}
            {d.sub && <div style={{ fontSize: 9, color: "#9ca3af" }}>{d.sub}</div>}
          </div>
          <div style={{ flex: 1, height: 22, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: "100%", background: d.color, borderRadius: 6 }}
            />
          </div>
          <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: "#111827", textAlign: "right" }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// SVG ring / completion circle
function RingChart({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = total > 0 ? value / total : 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">
          {Math.round(pct * 100)}%
        </text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#9ca3af">{label}</text>
      </svg>
    </div>
  );
}

interface Props {
  user: UserProfile;
  taskByStatus: { pending: number; in_progress: number; review: number; done: number };
  overdueCount: number;
  completionRate: number;
  totalTasks: number;
  taskMemberRows: { name: string; total: number; done: number }[];
  totalIncome: number;
  totalExpense: number;
  topExpenseCategories: { cat: string; amount: number }[];
  progressRows: { name: string; role: string; count: number; avgMood: number }[];
  trainingStats: { upcoming: number; ongoing: number; done: number; cancelled: number };
  currentMonth: string;
}

const MOOD_EMOJI = ["", "😢", "😕", "😐", "😊", "😁"];

export default function ReportBoard({
  user, taskByStatus, overdueCount, completionRate, totalTasks,
  taskMemberRows, totalIncome, totalExpense, topExpenseCategories,
  progressRows, trainingStats, currentMonth,
}: Props) {
  const balance = totalIncome - totalExpense;

  const SUMMARY_CARDS = [
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      sub: `${taskByStatus.done} dari ${totalTasks} task`,
      icon: CheckSquare, color: "#10b981", bg: "#f0fdf4", border: "#d1fae5",
    },
    {
      label: "Overdue Tasks",
      value: overdueCount,
      sub: "melewati deadline",
      icon: AlertTriangle, color: "#ef4444", bg: "#fef2f2", border: "#fecaca",
    },
    {
      label: "Saldo Bulan Ini",
      value: fmtRupiah(Math.abs(balance)),
      sub: balance >= 0 ? "surplus" : "defisit",
      icon: Wallet, color: balance >= 0 ? "#10b981" : "#ef4444", bg: balance >= 0 ? "#f0fdf4" : "#fef2f2", border: balance >= 0 ? "#d1fae5" : "#fecaca",
    },
    {
      label: "Progress Aktif",
      value: progressRows.length,
      sub: `anggota submit — ${currentMonth}`,
      icon: TrendingUp, color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe",
    },
    {
      label: "Total Training",
      value: trainingStats.upcoming + trainingStats.ongoing + trainingStats.done,
      sub: `${trainingStats.upcoming} upcoming`,
      icon: GraduationCap, color: "#8b5cf6", bg: "#f5f3ff", border: "#ede9fe",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar user={user} title="Laporan & Rekap" />

      <main style={{ flex: 1, padding: "24px 24px 40px", background: "#f9fafb", overflowY: "auto" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <BarChart2 size={20} color="#10b981" strokeWidth={2} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Laporan & Rekap</h2>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Rekap performa tim GRCC — data real-time dari semua modul.</p>
        </motion.div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
          {SUMMARY_CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div key={c.label}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.07)" }}
                style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, padding: "16px 16px 14px", transition: "box-shadow 0.2s" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: c.bg, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} color={c.color} strokeWidth={1.8} />
                  </div>
                  <ArrowUpRight size={13} style={{ color: "#e5e7eb" }} />
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>{c.value}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 4 }}>{c.label}</p>
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{c.sub}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Row 1: Task chart + Task by member */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Task by status */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", padding: "18px 20px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckSquare size={15} color="#10b981" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Task per Status</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <RingChart value={taskByStatus.done} total={totalTasks} color="#10b981" label="selesai" />
              </div>
            </div>
            <BarChart data={[
              { label: "Selesai",    value: taskByStatus.done,        color: "#10b981" },
              { label: "Dikerjakan", value: taskByStatus.in_progress, color: "#3b82f6" },
              { label: "Review",     value: taskByStatus.review,      color: "#8b5cf6" },
              { label: "Pending",    value: taskByStatus.pending,     color: "#f59e0b" },
            ]} />
          </motion.div>

          {/* Task per member */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}
          >
            <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", gap: 7 }}>
              <CheckSquare size={15} color="#10b981" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Task per Anggota</span>
            </div>
            {taskMemberRows.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada data task terassign</p>
              </div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {taskMemberRows.map((m, i) => {
                  const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                  return (
                    <motion.div key={m.name}
                      initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: i < taskMemberRows.length - 1 ? "1px solid #f9fafb" : "none" }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #047857)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {m.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <div style={{ flex: 1, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, delay: 0.4 + i * 0.05 }}
                              style={{ height: "100%", background: "#10b981", borderRadius: 2 }}
                            />
                          </div>
                          <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{m.done}/{m.total}</p>
                        <p style={{ fontSize: 9, color: "#9ca3af" }}>selesai</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>

        {/* Row 2: Finance + Progress */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Finance overview */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", padding: "18px 20px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
              <Wallet size={15} color="#10b981" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Keuangan — Transaksi Confirmed</span>
            </div>

            {/* Income vs Expense summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Pemasukan", value: totalIncome,  color: "#10b981", bg: "#f0fdf4" },
                { label: "Total Pengeluaran", value: totalExpense, color: "#ef4444", bg: "#fef2f2" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{fmtRupiah(s.value)}</p>
                </div>
              ))}
            </div>

            {/* Saldo */}
            <div style={{ background: balance >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Saldo</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: balance >= 0 ? "#10b981" : "#ef4444" }}>
                {balance >= 0 ? "+" : "-"}{fmtRupiahFull(Math.abs(balance))}
              </span>
            </div>

            {/* Top expense categories */}
            {topExpenseCategories.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Top Pengeluaran</p>
                <BarChart data={topExpenseCategories.map(c => ({
                  label: c.cat,
                  value: c.amount,
                  color: "#3b82f6",
                  sub: fmtRupiah(c.amount),
                }))} />
              </>
            )}
          </motion.div>

          {/* Progress per member */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", overflow: "hidden" }}
          >
            <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <TrendingUp size={15} color="#3b82f6" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Daily Progress — {currentMonth}</span>
              </div>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>{progressRows.length} anggota</span>
            </div>
            {progressRows.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada progress bulan ini</p>
              </div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "#f9fafb" }}>
                  <div style={{ background: "#f9fafb", padding: "8px 14px" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Anggota</p>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "8px 0" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Submit</p>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "8px 0" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Avg Mood</p>
                  </div>
                </div>
                {progressRows.map((m, i) => (
                  <motion.div key={m.name}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.03 }}
                    style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: i < progressRows.length - 1 ? "1px solid #f9fafb" : "none" }}
                  >
                    <div style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af" }}>{m.role?.replace(/_/g, " ")}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>{m.count}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 2 }}>hari</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: 14 }}>{MOOD_EMOJI[Math.round(m.avgMood)] ?? "😐"}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{m.avgMood}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

        </div>

        {/* Training stats — full width footer */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #f3f4f6", padding: "18px 20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
            <GraduationCap size={15} color="#8b5cf6" strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Rekap Training</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Akan Datang", value: trainingStats.upcoming,  color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
              { label: "Berlangsung", value: trainingStats.ongoing,   color: "#10b981", bg: "#f0fdf4", border: "#d1fae5" },
              { label: "Selesai",     value: trainingStats.done,      color: "#9ca3af", bg: "#f3f4f6", border: "#e5e7eb" },
              { label: "Dibatalkan",  value: trainingStats.cancelled, color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.06 }}
                style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 16px" }}
              >
                <p style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 4 }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </main>
    </div>
  );
}
