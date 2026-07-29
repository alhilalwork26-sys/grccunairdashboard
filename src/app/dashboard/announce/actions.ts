"use server";

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/webpush";

function adminClient() {
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function createAnnouncementAction(payload: {
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "event";
  pinned: boolean;
  image_urls?: string[];
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["super_admin", "manager", "program_admin"].includes(profile?.role ?? "")) {
    return { data: null, error: "Akses ditolak." };
  }

  const { data, error } = await admin
    .from("announcements")
    .insert({ ...payload, created_by: user.id })
    .select("*, profiles(full_name, role)")
    .single();

  if (error) return { data: null, error: error.message };

  await sendPushToAll({
    title: `📢 ${payload.title}`,
    body: payload.content.length > 80 ? payload.content.slice(0, 80) + "…" : payload.content,
    url: "/dashboard/announce",
    tag: `announce-${data.id}`,
  }, user.id);

  return { data: data as Record<string, unknown>, error: null };
}
