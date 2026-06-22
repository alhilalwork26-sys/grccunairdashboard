import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./DashboardHome";
import type { UserProfile } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const userProfile: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  return <DashboardHome user={userProfile} />;
}
