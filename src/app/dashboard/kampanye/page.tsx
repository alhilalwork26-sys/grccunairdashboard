import { createClient } from "@/lib/supabase/server";
import KampanyeBoard from "./KampanyeBoard";
import type { UserProfile } from "@/types";

export default async function KampanyePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, creator:profiles!campaigns_created_by_fkey(full_name)")
    .order("created_at", { ascending: false });

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "", role: "super_admin", created_at: user!.created_at,
  };

  return <KampanyeBoard initialCampaigns={campaigns ?? []} currentUser={currentUser} />;
}
