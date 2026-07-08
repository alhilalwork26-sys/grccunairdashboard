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

const CAN_EDIT = ["super_admin", "manager", "kep_trainer"];

async function requireTrainingAuth(): Promise<{ userId: string; role: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { error: "Sesi habis, silakan login ulang." };
    const admin = adminClient();
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !CAN_EDIT.includes(profile.role)) return { error: "Akses ditolak." };
    return { userId: user.id, role: profile.role };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
}

export async function createTrainingSessionAction(payload: {
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  max_participants: number | null;
  status: "upcoming" | "ongoing" | "done" | "cancelled";
  trainer_id: string;
  materials: string | null;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const auth = await requireTrainingAuth();
  if ("error" in auth) return { data: null, error: auth.error };

  const admin = adminClient();
  const { data, error } = await admin
    .from("training_sessions")
    .insert(payload)
    .select("*, trainer:profiles!training_sessions_trainer_id_fkey(full_name), participants:training_participants(count)")
    .single();

  if (error) return { data: null, error: error.message };

  await sendPushToAll({
    title: `🎓 Training baru: ${payload.title}`,
    body: `${new Date(payload.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}${payload.location ? ` di ${payload.location}` : ""}`,
    url: "/dashboard/training",
    tag: `training-new-${data.id}`,
  });

  return { data: data as Record<string, unknown>, error: null };
}

export async function updateTrainingStatusAction(
  sessionId: string,
  status: "upcoming" | "ongoing" | "done" | "cancelled",
  title: string,
): Promise<{ error: string | null }> {
  const auth = await requireTrainingAuth();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("training_sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  if (status === "ongoing" || status === "cancelled") {
    await sendPushToAll({
      title: status === "ongoing" ? `▶️ Training dimulai: ${title}` : `❌ Training dibatalkan: ${title}`,
      body: status === "ongoing"
        ? `Sesi "${title}" sedang berlangsung sekarang`
        : `Sesi "${title}" telah dibatalkan`,
      url: "/dashboard/training",
      tag: `training-status-${sessionId}`,
    });
  }

  return { error: null };
}

export async function blastTrainingAction(announcement: {
  title: string;
  content: string;
  createdBy: string;
}): Promise<{ error: string | null }> {
  const auth = await requireTrainingAuth();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin.from("announcements").insert({
    title: announcement.title,
    content: announcement.content,
    type: "info",
    pinned: false,
    created_by: announcement.createdBy,
  });

  if (error) return { error: error.message };

  await sendPushToAll({
    title: announcement.title,
    body: announcement.content.length > 80
      ? announcement.content.slice(0, 80) + "…"
      : announcement.content,
    url: "/dashboard/training",
    tag: `training-blast-${Date.now()}`,
  });

  return { error: null };
}
