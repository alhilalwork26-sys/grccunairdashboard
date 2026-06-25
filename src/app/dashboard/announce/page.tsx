import { createClient } from "@/lib/supabase/server";
import AnnouncementBoard from "./AnnouncementBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function AnnouncementPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: announcements }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("announcements")
      .select("*, profiles(full_name, role)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id,
    email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: user!.created_at,
  };

  return (
    <AnnouncementBoard
      currentUser={currentUser}
      initialAnnouncements={announcements ?? []}
    />
  );
}
