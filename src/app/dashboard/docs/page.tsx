import { createClient } from "@/lib/supabase/server";
import DocsBoard from "./DocsBoard";
import type { UserProfile } from "@/types";

export default async function DocsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("documents")
      .select("*, profiles(full_name, role)")
      .order("created_at", { ascending: false }),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  return <DocsBoard currentUser={currentUser} initialDocs={documents ?? []} />;
}
