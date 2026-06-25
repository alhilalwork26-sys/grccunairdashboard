import { createClient } from "@/lib/supabase/server";
import NotificationsBoard from "./NotificationsBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const canSeeAllReimbs = ["super_admin", "manager", "kep_finance"].includes(profile?.role ?? "");
  const canApproveKonten = ["super_admin"].includes(profile?.role ?? "");
  const canSeeOpenBriefs = ["super_admin", "manager", "kep_marketing"].includes(profile?.role ?? "");

  const [
    { data: overdueTasks },
    { data: pendingReimbs },
    { data: announcements },
    { data: upcomingTrainings },
    { data: reviewTasks },
    { data: pendingKonten },
    { data: openBriefs },
  ] = await Promise.all([
    supabase.from("tasks")
      .select("id, title, due_date, priority, status, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name)")
      .lt("due_date", today)
      .not("status", "eq", "done")
      .order("due_date", { ascending: true })
      .limit(20),
    canSeeAllReimbs
      ? supabase.from("reimbursements")
          .select("id, title, amount, created_at, requester:profiles!reimbursements_requested_by_fkey(full_name, role)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase.from("announcements")
      .select("id, title, content, type, created_at, pinned")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("training_sessions")
      .select("id, title, date, start_time, location, status")
      .eq("status", "upcoming")
      .gte("date", today)
      .lte("date", in7)
      .order("date", { ascending: true })
      .limit(5),
    supabase.from("tasks")
      .select("id, title, priority, due_date, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name)")
      .eq("status", "review")
      .order("created_at", { ascending: false })
      .limit(10),
    canApproveKonten
      ? supabase.from("content_posts")
          .select("id, judul, platform, created_at, creator:profiles!content_posts_created_by_fkey(full_name)")
          .eq("status", "review")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    canSeeOpenBriefs
      ? supabase.from("creative_briefs")
          .select("id, judul, platform, deadline, status, requester:profiles!creative_briefs_requested_by_fkey(full_name)")
          .in("status", ["open", "revision"])
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const userProfile: UserProfile = profile ?? {
    id: user.id, email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? user.email ?? "",
    role: "super_admin", created_at: user.created_at,
  };

  return (
    <NotificationsBoard
      user={userProfile}
      overdueTasks={overdueTasks ?? []}
      pendingReimbs={pendingReimbs ?? []}
      announcements={announcements ?? []}
      upcomingTrainings={upcomingTrainings ?? []}
      reviewTasks={reviewTasks ?? []}
      pendingKonten={pendingKonten ?? []}
      openBriefs={openBriefs ?? []}
    />
  );
}
