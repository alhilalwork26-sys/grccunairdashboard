import { createClient } from "@/lib/supabase/server";
import RABBoard from "./RABBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["super_admin", "manager"];

export default async function RABPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user.id, email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? "", role: "super_admin", created_at: user.created_at,
  };

  if (!ALLOWED_ROLES.includes(currentUser.role)) redirect("/dashboard");

  const { data: rabList } = await supabase
    .from("rab")
    .select("*, creator:profiles!rab_created_by_fkey(full_name), reviewer:profiles!rab_reviewed_by_fkey(full_name)")
    .order("created_at", { ascending: false });

  return <RABBoard currentUser={currentUser} initialRAB={rabList ?? []} />;
}
