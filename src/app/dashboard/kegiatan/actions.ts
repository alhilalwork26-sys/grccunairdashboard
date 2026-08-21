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

const CAN_EDIT = ["super_admin", "manager", "kep_trainer", "staff_dokumen"];
const SELECT_WITH_RELATIONS =
  "*, pic:profiles!kegiatan_pic_id_fkey(full_name), creator:profiles!kegiatan_created_by_fkey(full_name), lampiran:kegiatan_lampiran(count), checklist:kegiatan_checklist(status)";

interface KegiatanLinks {
  virtual_background_url: string | null;
  absensi_url: string | null;
  materi_url: string | null;
  record_zoom_url: string | null;
  ujian_url: string | null;
  dokumentasi_url: string | null;
  modul_url: string | null;
  rundown_url: string | null;
}

async function requireKegiatanAuth(): Promise<{ userId: string; role: string } | { error: string }> {
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

export async function createKegiatanAction(payload: {
  title: string;
  description: string | null;
  deadline: string;
  status: "belum" | "sudah";
  pic_id: string | null;
} & KegiatanLinks): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const auth = await requireKegiatanAuth();
  if ("error" in auth) return { data: null, error: auth.error };

  const admin = adminClient();
  const { data, error } = await admin
    .from("kegiatan")
    .insert({ ...payload, created_by: auth.userId })
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) return { data: null, error: error.message };

  await sendPushToAll({
    title: `🗂️ Kegiatan baru: ${payload.title}`,
    body: `Deadline ${new Date(payload.deadline + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`,
    url: "/dashboard/kegiatan",
    tag: `kegiatan-new-${data.id}`,
  });

  return { data: data as Record<string, unknown>, error: null };
}

export async function updateKegiatanAction(
  id: string,
  payload: {
    title: string;
    description: string | null;
    deadline: string;
    status: "belum" | "sudah";
    pic_id: string | null;
  } & KegiatanLinks,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const auth = await requireKegiatanAuth();
  if ("error" in auth) return { data: null, error: auth.error };

  const admin = adminClient();
  const { data, error } = await admin
    .from("kegiatan")
    .update(payload)
    .eq("id", id)
    .select(SELECT_WITH_RELATIONS)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Record<string, unknown>, error: null };
}

export async function deleteKegiatanAction(id: string): Promise<{ error: string | null }> {
  const auth = await requireKegiatanAuth();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin.from("kegiatan").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function blastKegiatanAction(announcement: {
  title: string;
  content: string;
}): Promise<{ error: string | null }> {
  const auth = await requireKegiatanAuth();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin.from("announcements").insert({
    title: announcement.title,
    content: announcement.content,
    type: "info",
    pinned: false,
    created_by: auth.userId,
  });

  if (error) return { error: error.message };

  await sendPushToAll({
    title: announcement.title,
    body: announcement.content.length > 80
      ? announcement.content.slice(0, 80) + "…"
      : announcement.content,
    url: "/dashboard/kegiatan",
    tag: `kegiatan-blast-${Date.now()}`,
  });

  return { error: null };
}
