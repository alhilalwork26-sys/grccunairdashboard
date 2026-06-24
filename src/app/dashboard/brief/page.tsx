import { createClient } from "@/lib/supabase/server";
import BriefBoard from "./BriefBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function BriefPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const [{ data: briefs }, { data: kreatifProfiles }] = await Promise.all([
    supabase.from("creative_briefs")
      .select("*, requester:profiles!creative_briefs_requested_by_fkey(full_name, role), assignee:profiles!creative_briefs_assigned_to_fkey(full_name, role)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "staff_kreatif").order("full_name"),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "", role: "super_admin", created_at: user!.created_at,
  };

  return <BriefBoard initialBriefs={briefs ?? []} kreatifProfiles={kreatifProfiles ?? []} currentUser={currentUser} />;
}
