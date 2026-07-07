"use server";

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/webpush";

function adminClient() {
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function sendChatMessageAction(
  roomId: string,
  content: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const admin = adminClient();

    // Insert message
    const { data: msg, error: insertErr } = await admin
      .from("chat_messages")
      .insert({ room_id: roomId, sender_id: user.id, content })
      .select("*, sender:profiles(id, full_name, role, avatar_url)")
      .single();

    if (insertErr) return { data: null, error: insertErr.message };

    // Get sender name for push payload
    const senderName = (msg.sender as { full_name?: string } | null)?.full_name ?? "Seseorang";

    // Get other room members to notify
    const { data: members } = await admin
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .neq("user_id", user.id);

    const recipientIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

    if (recipientIds.length > 0) {
      // Fire-and-forget push — don't await to keep response fast
      sendPushToUsers(recipientIds, {
        title: `Pesan dari ${senderName}`,
        body: content.length > 80 ? content.slice(0, 80) + "…" : content,
        url: "/dashboard/chat",
        tag: `chat-${roomId}`,
      });
    }

    return { data: msg as Record<string, unknown>, error: null };
  } catch {
    return { data: null, error: "Server error" };
  }
}
