import { createClient } from "@/lib/supabase/server";
import TrainingBoard from "./TrainingBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

const TRAINING_ROLES = ["super_admin", "manager", "kep_trainer"];

export default async function TrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  if (!TRAINING_ROLES.includes(currentUser.role)) redirect("/dashboard");

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)")
      .order("date", { ascending: true }),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  return (
    <TrainingBoard
      currentUser={currentUser}
      initialSessions={sessions ?? []}
      profiles={profiles ?? []}
    />
  );
}
