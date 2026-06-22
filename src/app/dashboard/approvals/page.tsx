import { createClient } from "@/lib/supabase/server";
import ApprovalsBoard from "./ApprovalsBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  if (!["super_admin", "manager", "kep_finance"].includes(currentUser.role)) redirect("/dashboard");

  const [{ data: reimbursements }, { data: tasks }] = await Promise.all([
    supabase
      .from("reimbursements")
      .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assigned_to_fkey(full_name), creator:profiles!tasks_created_by_fkey(full_name)")
      .eq("status", "review")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ApprovalsBoard
      currentUser={currentUser}
      pendingReimbursements={reimbursements ?? []}
      reviewTasks={tasks ?? []}
    />
  );
}
