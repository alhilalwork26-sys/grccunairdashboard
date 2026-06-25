import { createClient } from "@/lib/supabase/server";
import SettingsBoard from "./SettingsBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  const [{ data: profile }, { data: allProfiles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  if (!["super_admin", "manager"].includes(currentUser.role)) {
    redirect("/dashboard");
  }

  return (
    <SettingsBoard
      currentUser={currentUser}
      initialProfiles={(allProfiles ?? []) as UserProfile[]}
    />
  );
}
