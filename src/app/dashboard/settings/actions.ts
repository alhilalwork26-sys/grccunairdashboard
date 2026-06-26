"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Role } from "@/types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

function createAdminClient() {
  return createServerClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Reads the caller's session and verifies they are super_admin.
// Returns an error string if denied, or null if allowed.
async function requireSuperAdmin(): Promise<string | null> {
  const cookieStore = await cookies();
  // Use anon client only to verify the JWT (getUser makes a network call to Auth).
  const userClient = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return "Tidak terautentikasi.";

  // Use admin client to read the profile — bypasses RLS so it always works.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return "Akses ditolak.";
  return null;
}

export async function updateUserRole(userId: string, role: Role) {
  const denied = await requireSuperAdmin();
  if (denied) return { error: denied };
  // Use admin client so this is not subject to row-level RLS
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function createUser(
  email: string,
  fullName: string,
  role: Role,
  password: string,
  allowedModules: string[] | null,
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey === "PASTE_SERVICE_ROLE_KEY_HERE") {
    return { error: "Service role key belum dikonfigurasi." };
  }
  const denied = await requireSuperAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: error.message };
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name: fullName, role, is_active: true, allowed_modules: allowedModules });
  if (profileError) return { error: profileError.message };
  return { error: null, userId: data.user.id };
}

export async function updateUserModules(userId: string, allowedModules: string[] | null) {
  const denied = await requireSuperAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ allowed_modules: allowedModules })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteUser(userId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey === "PASTE_SERVICE_ROLE_KEY_HERE") {
    return { error: "Service role key belum dikonfigurasi." };
  }
  const denied = await requireSuperAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function toggleUserStatus(userId: string, activate: boolean) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey === "PASTE_SERVICE_ROLE_KEY_HERE") {
    return { error: "Service role key belum dikonfigurasi." };
  }
  const denied = await requireSuperAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: activate ? "none" : "876000h",
  });
  if (authError) return { error: authError.message };
  const { error: dbError } = await admin
    .from("profiles")
    .update({ is_active: activate })
    .eq("id", userId);
  if (dbError) return { error: dbError.message };
  return { error: null };
}
