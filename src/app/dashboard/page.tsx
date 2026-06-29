import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/getUser";
import DashboardHome from "./DashboardHome";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { user, userId } = await getUser();
  if (!user || !userId) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split("T")[0];
  })();
  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  })();

  const supabase = await createClient();

  const [
    { count: taskCount },
    { count: progressCount },
    { count: announceCount },
    { count: eventCount },
    { data: recentTasks },
    { data: recentAnnouncements },
  ] = await Promise.all([
    supabase.from("tasks").select("*", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
    supabase.from("daily_progress").select("*", { count: "exact", head: true }).eq("date", today),
    supabase.from("announcements").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }).gte("start_date", weekStart).lte("start_date", weekEnd),
    supabase.from("tasks")
      .select("id, title, assigned_to, status, due_date, priority, assignee:profiles!tasks_assigned_to_fkey(full_name, role)")
      .in("status", ["pending", "in_progress", "review", "done"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("announcements")
      .select("id, title, created_at, priority")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <DashboardHome
      user={user}
      stats={{
        activeTasks: taskCount ?? 0,
        progressToday: progressCount ?? 0,
        announcements: announceCount ?? 0,
        eventsThisWeek: eventCount ?? 0,
      }}
      recentTasks={recentTasks ?? []}
      recentAnnouncements={recentAnnouncements ?? []}
    />
  );
}
