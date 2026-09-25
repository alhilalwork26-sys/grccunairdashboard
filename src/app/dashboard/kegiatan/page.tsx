import { createClient } from "@/lib/supabase/server";
import KegiatanBoard from "./KegiatanBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

export default async function KegiatanPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/dashboard");
  const currentUser: UserProfile = profile;

  const [{ data: items }, { data: profiles }] = await Promise.all([
    supabase
      .from("kegiatan")
      .select("*, pic:profiles!kegiatan_pic_id_fkey(full_name), creator:profiles!kegiatan_created_by_fkey(full_name), lampiran:kegiatan_lampiran(count), checklist:kegiatan_checklist(status), sesi:kegiatan_sesi(id, sesi_ke, tanggal, waktu_mulai, waktu_selesai, pembicara, topik)")
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
