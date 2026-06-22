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

export default function DashboardShell() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
      <Sidebar user={MOCK_USER} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashboardHome user={MOCK_USER} />
      </div>
    </div>
  );
}
