import { createClient } from "@/lib/supabase/server";
import DocsBoard from "./DocsBoard";
import type { UserProfile } from "@/types";

export const PAGE_SIZE = 20;

export default async function DocsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: documents, count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("documents")
      .select("*, profiles(full_name, role)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  return (
    <DocsBoard
      currentUser={currentUser}
      initialDocs={documents ?? []}
      totalCount={count ?? 0}
      pageSize={PAGE_SIZE}
    />
  );
}
