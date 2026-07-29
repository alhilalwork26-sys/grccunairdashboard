"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/types";
import { sendPushToUser } from "@/lib/webpush";

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key === "PASTE_SERVICE_ROLE_KEY_HERE" || key.toLowerCase().includes("placeholder")) return null;
  return key;
}

function createAdminClient() {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return null;
  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const APPROVE_ROLES = ["super_admin", "manager", "kep_trainer"];
const MANAGE_ROLES = ["super_admin", "manager", "program_admin", "kep_finance", "kep_trainer"];

async function requireAuth(): Promise<{ userId: string; role: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Sesi habis, silakan login ulang." };

    const admin = createAdminClient();
    if (!admin) return { error: "Service role key belum dikonfigurasi." };

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return { userId: user.id, role: profile?.role ?? "" };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
}

function canAccessTask(
  task: Pick<Task, "assigned_to" | "created_by">,
  auth: { userId: string; role: string },
) {
  return (
    MANAGE_ROLES.includes(auth.role) ||
    task.assigned_to === auth.userId ||
    task.created_by === auth.userId
  );
}

async function insertTaskLog(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  payload: Record<string, string | null>,
) {
  await admin.from("task_logs").insert(payload);
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
  if (!admin) return { error: "Service role key belum dikonfigurasi.", data: null };

  const { data, error } = await admin
    .from("tasks")
    .insert({ ...payload, created_by: auth.userId })
    .select()
    .single();
  if (error) return { error: error.message, data: null };

  await insertTaskLog(admin, {
    task_id: data.id,
    actor_id: auth.userId,
    action: "created",
    from_status: null,
    to_status: data.status,
    note: null,
    proof_url: null,
  });

  if (payload.assigned_to && payload.assigned_to !== auth.userId) {
    const { data: actor } = await admin.from("profiles").select("full_name").eq("id", auth.userId).single();
    await sendPushToUser(payload.assigned_to, {
      title: "Task baru di-assign",
      body: `${actor?.full_name ?? "Manager"} memberimu task: "${payload.title}"`,
      url: "/dashboard/task-management",
      tag: `task-assign-${data.id}`,
    });
  }

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
  },
): Promise<{ data: Task | null; error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return { ...auth, data: null };

  const admin = createAdminClient();
  if (!admin) return { error: "Service role key belum dikonfigurasi.", data: null };

  const { data: task } = await admin
    .from("tasks")
    .select("assigned_to, created_by")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "Task tidak ditemukan.", data: null };
  if (!canAccessTask(task, auth)) return { error: "Akses ditolak.", data: null };

  const { data, error } = await admin
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select()
    .single();
  if (error) return { error: error.message, data: null };

  await insertTaskLog(admin, {
    task_id: taskId,
    actor_id: auth.userId,
    action: "edited",
    from_status: null,
    to_status: null,
    note: null,
    proof_url: null,
  });
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
  if (!admin) return { error: "Service role key belum dikonfigurasi." };

  const { data: task } = await admin
    .from("tasks")
    .select("assigned_to, created_by, status")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "Task tidak ditemukan." };
  if (!canAccessTask(task, auth)) return { error: "Akses ditolak." };
  if (task.status === status) return { error: null };
  if (status === "done" && !APPROVE_ROLES.includes(auth.role)) return { error: "Akses ditolak." };

  const updates: Partial<Task> = status === "done"
    ? { status, approved_by: auth.userId, approved_at: new Date().toISOString() }
    : { status };
  const { error } = await admin.from("tasks").update(updates).eq("id", taskId);
  if (error) return { error: error.message };

  await insertTaskLog(admin, {
    task_id: taskId,
    actor_id: auth.userId,
    action: "status_changed",
    from_status: fromStatus,
    to_status: status,
    note: null,
    proof_url: null,
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
  if (!admin) return { error: "Service role key belum dikonfigurasi." };

  const { data: task } = await admin
    .from("tasks")
    .select("assigned_to, created_by, requires_proof")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "Task tidak ditemukan." };
  if (!canAccessTask(task, auth)) return { error: "Akses ditolak." };

  const cleanProofUrl = proofUrl?.trim() || null;
  const cleanNote = note?.trim() || null;
  if (task.requires_proof && !cleanProofUrl) {
    return { error: "Link bukti wajib diisi karena diminta oleh pembuat task." };
  }

  const updates = {
    status: "review" as Task["status"],
    completion_note: cleanNote,
    proof_url: cleanProofUrl,
  };
  const { error } = await admin.from("tasks").update(updates).eq("id", taskId);
  if (error) return { error: error.message };

  await insertTaskLog(admin, {
    task_id: taskId,
    actor_id: auth.userId,
    action: "submitted_review",
    from_status: fromStatus,
    to_status: "review",
    note: cleanNote,
    proof_url: cleanProofUrl,
  });

  if (task.created_by && task.created_by !== auth.userId) {
    const { data: actor } = await admin.from("profiles").select("full_name").eq("id", auth.userId).single();
    const { data: taskData } = await admin.from("tasks").select("title").eq("id", taskId).single();
    await sendPushToUser(task.created_by, {
      title: "Task siap direview",
      body: `${actor?.full_name ?? "Anggota"} mengajukan task "${taskData?.title ?? ""}" untuk direview`,
      url: "/dashboard/task-management",
      tag: `task-review-${taskId}`,
    });
  }

  return { error: null };
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function deleteTaskAction(taskId: string): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ("error" in auth) return auth;
  if (!MANAGE_ROLES.includes(auth.role)) return { error: "Akses ditolak." };

  const admin = createAdminClient();
  if (!admin) return { error: "Service role key belum dikonfigurasi." };

  const { error } = await admin.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── APPROVE / REJECT ────────────────────────────────────────────────────────

async function requireApprover(): Promise<{ userId: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Sesi habis, silakan login ulang." };
    const admin = createAdminClient();
    if (!admin) return { error: "Service role key belum dikonfigurasi." };

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !APPROVE_ROLES.includes(profile.role)) return { error: "Akses ditolak." };
    return { userId: user.id };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
}

export async function approveTaskAction(taskId: string): Promise<{ error: string | null }> {
  const auth = await requireApprover();
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  if (!admin) return { error: "Service role key belum dikonfigurasi." };

  const now = new Date().toISOString();
  const { data: task } = await admin.from("tasks").select("assigned_to, title").eq("id", taskId).single();
  const { error } = await admin.from("tasks")
    .update({ status: "done", approved_by: auth.userId, approved_at: now })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await insertTaskLog(admin, {
    task_id: taskId,
    actor_id: auth.userId,
    action: "approved",
    from_status: "review",
    to_status: "done",
    note: null,
    proof_url: null,
  });
  if (task?.assigned_to && task.assigned_to !== auth.userId) {
    await sendPushToUser(task.assigned_to, {
      title: "Task disetujui!",
      body: `Task "${task.title}" kamu sudah di-approve`,
      url: "/dashboard/task-management",
      tag: `task-approved-${taskId}`,
    });
  }
  return { error: null };
}

export async function rejectTaskAction(
  taskId: string,
  note: string | null,
): Promise<{ error: string | null }> {
  const auth = await requireApprover();
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  if (!admin) return { error: "Service role key belum dikonfigurasi." };

  const { data: task } = await admin.from("tasks").select("assigned_to, title").eq("id", taskId).single();
  const { error } = await admin.from("tasks")
    .update({ status: "in_progress", rejected_note: note })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await insertTaskLog(admin, {
    task_id: taskId,
    actor_id: auth.userId,
    action: "rejected",
    from_status: "review",
    to_status: "in_progress",
    note,
    proof_url: null,
  });
  if (task?.assigned_to && task.assigned_to !== auth.userId) {
    await sendPushToUser(task.assigned_to, {
      title: "Task perlu diperbaiki",
      body: `Task "${task.title}" dikembalikan${note ? `: ${note}` : ""}`,
      url: "/dashboard/task-management",
      tag: `task-rejected-${taskId}`,
    });
  }
  return { error: null };
}
