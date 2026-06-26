"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Task, UserProfile } from "@/types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function createAdminClient() {
  return createServerClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function createSessionClient(cookieStore: CookieStore) {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

function createMutationClient(cookieStore: CookieStore) {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : createSessionClient(cookieStore);
}

const APPROVE_ROLES = ["super_admin", "manager", "kep_trainer"];
const STATUS_EDITOR_ROLES: UserProfile["role"][] = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"];
const TASK_STATUSES: Task["status"][] = ["pending", "in_progress", "review", "done"];

type AuthProfile = { userId: string; role: UserProfile["role"]; cookieStore: CookieStore };
type StatusTask = Pick<Task, "id" | "status" | "assigned_to" | "created_by" | "requires_proof">;

function canChangeTaskStatus(
  task: StatusTask,
  userId: string,
  role: UserProfile["role"],
  nextStatus?: Task["status"],
) {
  const canEditAnyStatus = STATUS_EDITOR_ROLES.includes(role);
  const canApprove = APPROVE_ROLES.includes(role);
  const isTaskOwner = task.assigned_to === userId || task.created_by === userId;
  if (task.status === "done" && !canApprove) return false;
  if (nextStatus === "done") return canApprove;
  return canEditAnyStatus || isTaskOwner;
}

async function requireProfile(): Promise<AuthProfile | { error: string }> {
  const cookieStore = await cookies();
  const session = createSessionClient(cookieStore);
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi." };
  const { data: profile } = await session
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role) return { error: "Profil tidak ditemukan." };
  return { userId: user.id, role: profile.role as UserProfile["role"], cookieStore };
}

async function requireApprover(): Promise<{ userId: string } | { error: string }> {
  const auth = await requireProfile();
  if ("error" in auth) return auth;
  if (!APPROVE_ROLES.includes(auth.role)) return { error: "Akses ditolak." };
  return { userId: auth.userId };
}

export async function changeTaskStatusAction(
  taskId: string,
  status: Task["status"],
): Promise<{ error: string | null; task?: Partial<Task> }> {
  if (!TASK_STATUSES.includes(status)) return { error: "Status tidak valid." };
  const auth = await requireProfile();
  if ("error" in auth) return { error: auth.error };

  const db = createMutationClient(auth.cookieStore);
  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id,status,assigned_to,created_by,requires_proof")
    .eq("id", taskId)
    .single();
  if (taskError || !task) return { error: "Task tidak ditemukan." };

  const currentTask = task as StatusTask;
  if (!canChangeTaskStatus(currentTask, auth.userId, auth.role, status)) {
    return { error: "Akses mengubah status task ditolak." };
  }
  if (currentTask.status === status) return { error: null, task: { status } };

  const approvedAt = status === "done" ? new Date().toISOString() : null;
  const updates: Partial<Task> = status === "done"
    ? { status, approved_by: auth.userId, approved_at: approvedAt }
    : { status };
  const { error } = await db.from("tasks").update(updates).eq("id", taskId);
  if (error) return { error: error.message };
  await db.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "status_changed", from_status: currentTask.status, to_status: status,
  });
  return { error: null, task: updates };
}

export async function submitTaskReviewAction(
  taskId: string,
  note: string | null,
  proofUrl: string | null,
): Promise<{ error: string | null; task?: Partial<Task> }> {
  const auth = await requireProfile();
  if ("error" in auth) return { error: auth.error };

  const db = createMutationClient(auth.cookieStore);
  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id,status,assigned_to,created_by,requires_proof")
    .eq("id", taskId)
    .single();
  if (taskError || !task) return { error: "Task tidak ditemukan." };

  const currentTask = task as StatusTask;
  if (!canChangeTaskStatus(currentTask, auth.userId, auth.role, "review")) {
    return { error: "Akses mengubah status task ditolak." };
  }
  const cleanProofUrl = proofUrl?.trim() || null;
  const cleanNote = note?.trim() || null;
  if (currentTask.requires_proof && !cleanProofUrl) {
    return { error: "Link bukti wajib diisi karena diminta oleh pembuat task." };
  }

  const updates: Partial<Task> = { status: "review", completion_note: cleanNote, proof_url: cleanProofUrl };
  const { error } = await db.from("tasks").update(updates).eq("id", taskId);
  if (error) return { error: error.message };
  await db.from("task_logs").insert({
    task_id: taskId, actor_id: auth.userId,
    action: "submitted_review", from_status: currentTask.status, to_status: "review",
    note: cleanNote, proof_url: cleanProofUrl,
  });
  return { error: null, task: updates };
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
