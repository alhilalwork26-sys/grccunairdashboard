import { createClient } from "@/lib/supabase/server";
import TaskBoard from "./TaskBoard";
import type { UserProfile } from "@/types";

export default async function TaskManagementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: tasks }, { data: profiles }, { data: profile }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role, avatar_url").order("full_name"),
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  return (
    <TaskBoard
      initialTasks={tasks ?? []}
      profiles={profiles ?? []}
      currentUser={currentUser}
    />
  );
}
