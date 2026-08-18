import { createClient } from "@/lib/supabase/server";
import KegiatanBoard from "./KegiatanBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["super_admin", "manager", "kep_trainer", "staff_dokumen"];

export default async function KegiatanPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const currentUser: UserProfile = profile ?? {
    id: user.id, email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user.created_at,
  };

  if (!ALLOWED_ROLES.includes(currentUser.role)) redirect("/dashboard");

  const [{ data: items }, { data: profiles }] = await Promise.all([
    supabase
      .from("kegiatan")
      .select("*, pic:profiles!kegiatan_pic_id_fkey(full_name), creator:profiles!kegiatan_created_by_fkey(full_name), lampiran:kegiatan_lampiran(count), checklist:kegiatan_checklist(status)")
      .order("deadline", { ascending: true }),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  return (
    <KegiatanBoard
      currentUser={currentUser}
      initialItems={items ?? []}
      profiles={profiles ?? []}
    />
  );
}
