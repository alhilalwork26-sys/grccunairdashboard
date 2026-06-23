"use client";

import Sidebar from "@/components/layout/Sidebar";
import DashboardHome from "@/app/dashboard/DashboardHome";
import type { UserProfile } from "@/types";

const MOCK_USER: UserProfile = {
  id: "demo",
  email: "superadmin@grcc.id",
  full_name: "Super Admin",
  role: "super_admin",
  created_at: new Date().toISOString(),
};

const MOCK_STATS = {
  activeTasks: 12,
  progressToday: 8,
  announcements: 4,
  eventsThisWeek: 3,
};

const MOCK_TASKS = [
  {
    id: "demo-task-1",
    title: "Review laporan mingguan",
    status: "in_progress",
    priority: "high",
    due_date: new Date().toISOString().split("T")[0],
    assignee: { full_name: "Tim Operasional" },
  },
  {
    id: "demo-task-2",
    title: "Siapkan materi training",
    status: "pending",
    priority: "medium",
    due_date: null,
    assignee: { full_name: "Kepala Trainer" },
  },
];

const MOCK_ANNOUNCEMENTS = [
  {
    id: "demo-announcement-1",
    title: "Briefing koordinasi dimulai pukul 09.00",
    priority: "urgent",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-announcement-2",
    title: "Dokumen evaluasi sudah tersedia",
    priority: "normal",
    created_at: new Date().toISOString(),
  },
];

export default function DashboardShell() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
      <Sidebar user={MOCK_USER} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashboardHome
          user={MOCK_USER}
          stats={MOCK_STATS}
          recentTasks={MOCK_TASKS}
          recentAnnouncements={MOCK_ANNOUNCEMENTS}
        />
      </div>
    </div>
  );
}
