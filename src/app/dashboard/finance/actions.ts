"use server";

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/webpush";

function createAdminClient() {
  return createServerClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function requireFinanceAuth(): Promise<{ userId: string; role: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Sesi habis, silakan login ulang." };
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (!profile) return { error: "Sesi habis, silakan login ulang." };
    return { userId: user.id, role: profile.role };
  } catch {
    return { error: "Sesi habis, silakan login ulang." };
  }
}

const CAN_PAY_ROLES = ["kep_finance", "manager", "super_admin"];

export async function uploadPayProofAction(
  reimbursementId: string,
  paymentProofUrl: string,
): Promise<{ error: string | null }> {
  const auth = await requireFinanceAuth();
  if ("error" in auth) return auth;
  if (!CAN_PAY_ROLES.includes(auth.role)) return { error: "Akses ditolak." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("reimbursements")
    .update({
      payment_proof_url: paymentProofUrl,
      paid_at: new Date().toISOString(),
      paid_by: auth.userId,
    })
    .eq("id", reimbursementId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function uploadGroupPayProofAction(
  reimbursementIds: string[],
  paymentProofUrl: string,
): Promise<{ error: string | null }> {
  const auth = await requireFinanceAuth();
  if ("error" in auth) return auth;
  if (!CAN_PAY_ROLES.includes(auth.role)) return { error: "Akses ditolak." };
  if (!reimbursementIds.length) return { error: null };

  const admin = createAdminClient();
  const { error } = await admin
    .from("reimbursements")
    .update({
      payment_proof_url: paymentProofUrl,
      paid_at: new Date().toISOString(),
      paid_by: auth.userId,
    })
    .in("id", reimbursementIds);

  if (error) return { error: error.message };
  return { error: null };
}

export async function reviewReimbursementAction(
  reimbursementId: string,
  status: "approved" | "rejected" | "pending",
  reviewNote?: string,
): Promise<{ error: string | null }> {
  const auth = await requireFinanceAuth();
  if ("error" in auth) return auth;
  if (!CAN_PAY_ROLES.includes(auth.role)) return { error: "Akses ditolak." };

  const admin = createAdminClient();
  const { data: reimb } = await admin
    .from("reimbursements")
    .select("user_id, title")
    .eq("id", reimbursementId)
    .single();

  const payload: Record<string, unknown> = { status };
  if (status !== "pending") {
    payload.reviewed_by = auth.userId;
    payload.reviewed_at = new Date().toISOString();
    if (reviewNote !== undefined) payload.review_note = reviewNote;
  } else {
    payload.reviewed_by = null;
    payload.reviewed_at = null;
    payload.review_note = null;
  }

  const { error } = await admin
    .from("reimbursements")
    .update(payload)
    .eq("id", reimbursementId);

  if (error) return { error: error.message };

  if (reimb?.user_id && reimb.user_id !== auth.userId && status !== "pending") {
    const isApproved = status === "approved";
    sendPushToUser(reimb.user_id, {
      title: isApproved ? "Reimb disetujui!" : "Reimb ditolak",
      body: isApproved
        ? `Pengajuan reimb "${reimb.title}" kamu disetujui`
        : `Pengajuan reimb "${reimb.title}" ditolak${reviewNote ? `: ${reviewNote}` : ""}`,
      url: "/dashboard/finance",
      tag: `reimb-${status}-${reimbursementId}`,
    });
  }

  return { error: null };
}
