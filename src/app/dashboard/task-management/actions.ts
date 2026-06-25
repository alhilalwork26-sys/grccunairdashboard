"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const APPROVE_ROLES = ["super_admin", "manager", "kep_trainer"];

async function requireApprover(): Promise<{ userId: string } | { error: string }> {
  const cookieStore = await cookies();
  const session = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi." };
  const { data: profile } = await session
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !APPROVE_ROLES.includes(profile.role)) return { error: "Akses ditolak." };
  return { userId: user.id };
}

export async function approveTaskAction(taskId: string): Promise<{ error: string | null }> {
  const auth = await requireApprover();
  if ("error" in auth) return auth;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("tasks")
    .update({ status: "done", approved_by: auth.userId, approved_at: now })
    .eq("id", taskId);
  if (error) return { error: error.message };
  await admin.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "approved", from_status: "review", to_status: "done",
  });
  return { error: null };
}

export async function rejectTaskAction(
  taskId: string,
  note: string | null,
): Promise<{ error: string | null }> {
  const auth = await requireApprover();
  if ("error" in auth) return auth;
  const admin = createAdminClient();
  const { error } = await admin.from("tasks")
    .update({ status: "in_progress", rejected_note: note })
    .eq("id", taskId);
  if (error) return { error: error.message };
  await admin.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "rejected", from_status: "review", to_status: "in_progress",
    note,
  });
  return { error: null };
}
