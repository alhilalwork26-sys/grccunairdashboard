import { createClient } from "@/lib/supabase/server";
import TaskBoard from "./TaskBoard";
import type { UserProfile } from "@/types";

// Roles that can see all tasks from all members
const CAN_SEE_ALL_ROLES = ["super_admin", "manager", "kep_trainer"];

export default async function TaskManagementPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user!.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  const canSeeAll = CAN_SEE_ALL_ROLES.includes(currentUser.role);

  const taskQuery = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    canSeeAll
      ? taskQuery
      : taskQuery.or(`assigned_to.eq.${user!.id},created_by.eq.${user!.id}`),
    supabase.from("profiles").select("id, full_name, role, avatar_url").order("full_name"),
  ]);

  return (
    <TaskBoard
      initialTasks={tasks ?? []}
      profiles={profiles ?? []}
      currentUser={currentUser}
      canSeeAll={canSeeAll}
    />
  );
}
