"use server";

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/types";

function createAdminClient() {
  return createServerClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const APPROVE_ROLES = ["super_admin", "manager", "kep_trainer"];
const MANAGE_ROLES  = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"];

async function requireAuth(): Promise<{ userId: string; role: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return { error: "Sesi habis, silakan login ulang." };
    if (!session?.user) return { error: "Sesi habis, silakan login ulang." };
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", session.user.id).single();
    return { userId: session.user.id, role: profile?.role ?? "" };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
}

// ── CREATE ─────────────────────────────────────────────────────────────────

export async function createTaskAction(payload: {
  title: string;
  description: string | null;
  status: Task["status"];
  priority: Task["priority"];
  assigned_to: string | null;
  due_date: string | null;
  requires_proof: boolean;
}): Promise<{ data: Task | null; error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return { ...auth, data: null };
  if (!MANAGE_ROLES.includes(auth.role)) return { error: "Akses ditolak.", data: null };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .insert({ ...payload, created_by: auth.userId })
    .select()
    .single();
  if (error) return { error: error.message, data: null };

  await admin.from("task_logs").insert({
    task_id: data.id, actor_id: auth.userId,
    action: "created", to_status: data.status,
  });
  return { data, error: null };
}

// ── UPDATE (full edit) ──────────────────────────────────────────────────────

export async function updateTaskAction(
  taskId: string,
  payload: {
    title: string;
    description: string | null;
    status: Task["status"];
    priority: Task["priority"];
    assigned_to: string | null;
    due_date: string | null;
    requires_proof: boolean;
  }
): Promise<{ data: Task | null; error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return { ...auth, data: null };

  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks").select("assigned_to, created_by").eq("id", taskId).single();
  if (!task) return { error: "Task tidak ditemukan.", data: null };

  const canManage  = MANAGE_ROLES.includes(auth.role);
  const isAssignee = task.assigned_to === auth.userId;
  const isCreator  = task.created_by === auth.userId;
  if (!canManage && !isAssignee && !isCreator) return { error: "Akses ditolak.", data: null };

  const { data, error } = await admin
    .from("tasks").update(payload).eq("id", taskId).select().single();
  if (error) return { error: error.message, data: null };

  await admin.from("task_logs").insert({ task_id: taskId, actor_id: auth.userId, action: "edited" });
  return { data, error: null };
}

// ── QUICK STATUS ────────────────────────────────────────────────────────────

export async function quickStatusAction(
  taskId: string,
  status: Task["status"],
  fromStatus: Task["status"],
): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks").select("assigned_to, created_by").eq("id", taskId).single();
  if (!task) return { error: "Task tidak ditemukan." };

  const canManage  = MANAGE_ROLES.includes(auth.role);
  const isAssignee = task.assigned_to === auth.userId;
  const isCreator  = task.created_by === auth.userId;
  if (!canManage && !isAssignee && !isCreator) return { error: "Akses ditolak." };

  const { error } = await admin.from("tasks").update({ status }).eq("id", taskId);
  if (error) return { error: error.message };

  await admin.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "status_changed", from_status: fromStatus, to_status: status,
  });
  return { error: null };
}

// ── SUBMIT FOR REVIEW ───────────────────────────────────────────────────────

export async function submitForReviewAction(
  taskId: string,
  fromStatus: Task["status"],
  note: string | null,
  proofUrl: string | null,
): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks").select("assigned_to, created_by, requires_proof").eq("id", taskId).single();
  if (!task) return { error: "Task tidak ditemukan." };

  if (task.requires_proof && !proofUrl?.trim()) {
    return { error: "Link bukti wajib diisi karena diminta oleh pembuat task." };
  }

  const canManage  = MANAGE_ROLES.includes(auth.role);
  const isAssignee = task.assigned_to === auth.userId;
  const isCreator  = task.created_by === auth.userId;
  if (!canManage && !isAssignee && !isCreator) return { error: "Akses ditolak." };

  const updates = {
    status: "review" as Task["status"],
    completion_note: note || null,
    proof_url: proofUrl || null,
  };
  const { error } = await admin.from("tasks").update(updates).eq("id", taskId);
  if (error) return { error: error.message };

  await admin.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "submitted_review", from_status: fromStatus, to_status: "review",
    note: note || null, proof_url: proofUrl || null,
  });
  return { error: null };
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function deleteTaskAction(taskId: string): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;
  if (!MANAGE_ROLES.includes(auth.role)) return { error: "Akses ditolak." };

  const admin = createAdminClient();
  const { error } = await admin.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── APPROVE / REJECT ────────────────────────────────────────────────────────

async function requireApprover(): Promise<{ userId: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.user) return { error: "Sesi habis, silakan login ulang." };
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", data.session.user.id).single();
    if (!profile || !APPROVE_ROLES.includes(profile.role)) return { error: "Akses ditolak." };
    return { userId: data.session.user.id };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
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
