import { cache } from "react";
import { createClient } from "./server";
import type { UserProfile } from "@/types";

// React.cache deduplicates this across layout + page within the same render tree.
// If both layout.tsx and page.tsx call getUser(), Supabase is only hit once.
export const getUser = cache(async (): Promise<{ user: UserProfile | null; userId: string | null }> => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { user: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  const user: UserProfile = profile ?? {
    id: session.user.id,
    email: session.user.email ?? "",
    full_name: session.user.user_metadata?.full_name ?? "",
    role: "super_admin",
    created_at: session.user.created_at,
  };

  return { user, userId: session.user.id };
});
