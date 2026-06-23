"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Role } from "@/types";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function updateUserRole(userId: string, role: Role) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function inviteUser(email: string, fullName: string, role: Role) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey === "PASTE_SERVICE_ROLE_KEY_HERE") {
    return { error: "Service role key belum dikonfigurasi. Isi SUPABASE_SERVICE_ROLE_KEY di .env.local." };
  }
  const admin = createAdminClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Kirim email undangan resmi — user akan terima link untuk set password
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/dashboard`,
  });
  if (error) return { error: error.message };

  // Buat profil langsung dengan role yang ditentukan
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name: fullName, role });
  if (profileError) return { error: profileError.message };

  return { error: null, userId: data.user.id };
}

export async function deleteUser(userId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || serviceKey === "PASTE_SERVICE_ROLE_KEY_HERE") {
    return { error: "Service role key belum dikonfigurasi." };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { error: null };
}
