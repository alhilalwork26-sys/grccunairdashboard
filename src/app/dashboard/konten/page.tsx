import { createClient } from "@/lib/supabase/server";
import KontenBoard from "./KontenBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function KontenPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const [{ data: posts }, { data: campaigns }] = await Promise.all([
    supabase.from("content_posts")
      .select("*, creator:profiles!content_posts_created_by_fkey(full_name, role), campaign:campaigns!content_posts_campaign_id_fkey(nama)")
      .order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, nama").in("status", ["planning", "active"]).order("nama"),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "", role: "super_admin", created_at: user!.created_at,
  };

  // Build calendar subscribe URL server-side so CALENDAR_SECRET never reaches client bundle
  const reqHeaders = await headers();
  const host  = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "localhost:3000";
  const proto = reqHeaders.get("x-forwarded-proto") ?? "http";
  const calendarUrl = `${proto}://${host}/api/calendar?token=${process.env.CALENDAR_SECRET ?? ""}`;

  return (
    <KontenBoard
      initialPosts={posts ?? []}
      campaigns={campaigns ?? []}
      currentUser={currentUser}
      calendarUrl={calendarUrl}
    />
  );
}
