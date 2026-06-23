import { createClient } from "@/lib/supabase/server";
import ProgressBoard from "./ProgressBoard";
import type { UserProfile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DailyProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date().toISOString().split("T")[0];

  const [{ data: profile }, { data: entries }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("daily_progress")
      .select("*, profiles(full_name, role)")
      .eq("date", today)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  return (
    <ProgressBoard
      currentUser={currentUser}
      initialEntries={entries ?? []}
      profiles={profiles ?? []}
      today={today}
    />
  );
}
