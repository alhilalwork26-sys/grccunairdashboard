"use client";

import { motion } from "framer-motion";
import {
  Clock, ClipboardCheck, Megaphone, GraduationCap,
  AlertCircle, BellRing, ImageIcon, Pencil,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import Link from "next/link";
import type { UserProfile } from "@/types";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  low:    { color: "#9ca3af", bg: "#f3f4f6" },
  medium: { color: "#3b82f6", bg: "#eff6ff" },
  high:   { color: "#f59e0b", bg: "#fffbeb" },
  urgent: { color: "#ef4444", bg: "#fef2f2" },
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtRupiah(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
function daysOverdue(dateStr: string) {
  const diff = Date.now() - new Date(dateStr + "T00:00:00").getTime();
  return Math.floor(diff / 86400000);
}

interface Props {
  user: UserProfile;
  overdueTasks:      any[];
  pendingReimbs:     any[];
  announcements:     any[];
  upcomingTrainings: any[];
  reviewTasks:       any[];
  pendingKonten:     any[];
  openBriefs:        any[];
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  empty: string;
  delay?: number;
}

function Section({ title, icon, color, count, href, linkLabel, children, empty, delay = 0 }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden" }}
    >
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
          {count > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: color + "15", color }}>
              {count}
            </span>
          )}
        </div>
        <Link href={href} style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{linkLabel} →</span>
        </Link>
      </div>
      {count === 0 ? (
        <div style={{ padding: "28px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>{empty}</p>
        </div>
      ) : children}
    </motion.div>
  );
}

export default function NotificationsBoard({ user, overdueTasks, pendingReimbs, announcements, upcomingTrainings, reviewTasks, pendingKonten, openBriefs }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("notifications-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },           () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" },   () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements" },  () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "training_sessions"},() => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "content_posts" },   () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "creative_briefs" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [router]);

  const totalAlerts = overdueTasks.length + pendingReimbs.length + reviewTasks.length + pendingKonten.length + openBriefs.length;

  return (
    <div className="board-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Topbar user={user} title="Notifikasi" />

      <main style={{ flex: 1, padding: "24px 24px 40px", background: "#f9fafb", overflowY: "auto" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <BellRing size={20} color="#10b981" strokeWidth={2} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Pusat Notifikasi</h2>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            {totalAlerts > 0
              ? `${totalAlerts} item memerlukan perhatian Anda.`
              : "Semua beres! Tidak ada item yang memerlukan tindakan."}
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Overdue Tasks */}
          <Section
            title="Task Melewati Deadline" icon={<Clock size={15} color="#ef4444" strokeWidth={2} />}
            color="#ef4444" count={overdueTasks.length}
            href="/dashboard/task-management" linkLabel="Kelola task" empty="Tidak ada task overdue" delay={0.05}
          >
            {overdueTasks.map((t, i) => {
              const pc = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
              const days = daysOverdue(t.due_date);
              return (
                <motion.div key={t.id}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < overdueTasks.length - 1 ? "1px solid #f9fafb" : "none" }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{(t.assignee as any)?.full_name ?? "—"}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#fef2f2", padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>
                    +{days}h
                  </span>
                </motion.div>
              );
            })}
          </Section>

          {/* Pending Reimbursements */}
          <Section
            title="Reimbursement Menunggu" icon={<ClipboardCheck size={15} color="#8b5cf6" strokeWidth={2} />}
            color="#8b5cf6" count={pendingReimbs.length}
            href="/dashboard/approvals" linkLabel="Tinjau" empty="Tidak ada reimbursement pending" delay={0.1}
          >
            {pendingReimbs.map((r, i) => (
              <motion.div key={r.id}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < pendingReimbs.length - 1 ? "1px solid #f9fafb" : "none" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                  <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{(r.requester as any)?.full_name ?? "—"}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", flexShrink: 0 }}>
                  {fmtRupiah(r.amount ?? 0)}
                </span>
              </motion.div>
            ))}
          </Section>

          {/* Tasks in Review */}
          <Section
            title="Task Menunggu Review" icon={<AlertCircle size={15} color="#f59e0b" strokeWidth={2} />}
            color="#f59e0b" count={reviewTasks.length}
            href="/dashboard/task-management" linkLabel="Lihat task" empty="Tidak ada task dalam review" delay={0.15}
          >
            {reviewTasks.map((t, i) => {
              const pc = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
              return (
                <motion.div key={t.id}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < reviewTasks.length - 1 ? "1px solid #f9fafb" : "none" }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{(t.assignee as any)?.full_name ?? "—"}</p>
                  </div>
                  {t.due_date && (
                    <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{fmtDate(t.due_date)}</span>
                  )}
                </motion.div>
              );
            })}
          </Section>

          {/* Upcoming Training */}
          <Section
            title="Training Minggu Ini" icon={<GraduationCap size={15} color="#3b82f6" strokeWidth={2} />}
            color="#3b82f6" count={upcomingTrainings.length}
            href="/dashboard/training" linkLabel="Lihat jadwal" empty="Tidak ada training dalam 7 hari ke depan" delay={0.2}
          >
            {upcomingTrainings.map((t, i) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < upcomingTrainings.length - 1 ? "1px solid #f9fafb" : "none" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
                  <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{t.location ?? "—"}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#3b82f6", flexShrink: 0 }}>{fmtDate(t.date)}</span>
              </motion.div>
            ))}
          </Section>

          {/* Konten pending review */}
          {pendingKonten.length > 0 && (
            <Section
              title="Konten Menunggu Approval" icon={<ImageIcon size={15} color="#ec4899" strokeWidth={2} />}
              color="#ec4899" count={pendingKonten.length}
              href="/dashboard/konten" linkLabel="Review konten" empty="" delay={0.25}
            >
              {pendingKonten.map((p, i) => (
                <motion.div key={p.id}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < pendingKonten.length - 1 ? "1px solid #f9fafb" : "none" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.judul}</p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{(p.creator as any)?.full_name ?? "—"} · {p.platform}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ec4899", background: "#fdf2f8", padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>Review</span>
                </motion.div>
              ))}
            </Section>
          )}

          {/* Open / revision briefs */}
          {openBriefs.length > 0 && (
            <Section
              title="Brief Menunggu Dikerjakan" icon={<Pencil size={15} color="#7c3aed" strokeWidth={2} />}
              color="#7c3aed" count={openBriefs.length}
              href="/dashboard/brief" linkLabel="Lihat brief" empty="" delay={0.3}
            >
              {openBriefs.map((b, i) => (
                <motion.div key={b.id}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.04 }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < openBriefs.length - 1 ? "1px solid #f9fafb" : "none" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.judul}</p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{(b.requester as any)?.full_name ?? "—"}{b.deadline ? ` · deadline ${fmtDate(b.deadline)}` : ""}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: b.status === "revision" ? "#f59e0b" : "#7c3aed", background: b.status === "revision" ? "#fffbeb" : "#f5f3ff", padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>
                    {b.status === "revision" ? "Revisi" : "Open"}
                  </span>
                </motion.div>
              ))}
            </Section>
          )}

        </div>

        {/* Announcements — full width */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}
          style={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: 14, overflow: "hidden", marginTop: 16 }}
        >
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f9fafb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Megaphone size={15} color="#f59e0b" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Pengumuman Terbaru</span>
            </div>
            <Link href="/dashboard/announce" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Semua →</span>
            </Link>
          </div>
          {announcements.length === 0 ? (
            <div style={{ padding: "28px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>Belum ada pengumuman</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {announcements.map((a, i) => (
                <motion.div key={a.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                  style={{ padding: "14px 18px", borderRight: "1px solid #f9fafb", borderBottom: "1px solid #f9fafb" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    {a.pinned && <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "#f0fdf4", padding: "1px 6px", borderRadius: 20 }}>PIN</span>}
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>
                      {new Date(a.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{a.title}</p>
                  <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {a.content}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </main>
    </div>
  );
}
