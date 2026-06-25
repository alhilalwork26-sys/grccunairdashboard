import { createClient } from "@/lib/supabase/server";
import ChatBoard from "./ChatBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const currentUser: UserProfile = profile ?? {
    id: user.id, email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? "",
    role: "staff_marketing", created_at: user.created_at,
  };

  // All other users for DM list
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, created_at, avatar_url")
    .neq("id", user.id)
    .order("full_name");

  // DM rooms where current user is a member
  const { data: memberships } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", user.id);

  const myRoomIds = memberships?.map(m => m.room_id) ?? [];

  // Filter to only 'direct' type rooms
  let dmRooms: { room_id: string; other_user: UserProfile }[] = [];

  if (myRoomIds.length > 0) {
    const { data: directRooms } = await supabase
      .from("chat_rooms")
      .select("id")
      .in("id", myRoomIds)
      .eq("type", "direct");

    const directIds = directRooms?.map(r => r.id) ?? [];

    if (directIds.length > 0) {
      const { data: others } = await supabase
        .from("chat_room_members")
        .select("room_id, profile:profiles(id, full_name, role, email, created_at, avatar_url)")
        .in("room_id", directIds)
        .neq("user_id", user.id);

      dmRooms = (others ?? []).map(o => ({
        room_id: o.room_id,
        other_user: o.profile as unknown as UserProfile,
      }));
    }
  }

  return (
    <ChatBoard
      currentUser={currentUser}
      allUsers={allUsers ?? []}
      dmRooms={dmRooms}
    />
  );
}
