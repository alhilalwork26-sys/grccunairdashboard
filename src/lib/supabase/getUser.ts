import { cache } from "react";
import { createClient } from "./server";
import type { UserProfile } from "@/types";

// React.cache deduplicates this across layout + page within the same render tree.
// If both layout.tsx and page.tsx call getUser(), Supabase is only hit once.
export const getUser = cache(async (): Promise<{ user: UserProfile | null; userId: string | null }> => {
  const supabase = await createClient();
  let session;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { user: null, userId: null };
    session = data.session;
  } catch {
    return { user: null, userId: null };
  }
  if (!session) return { user: null, userId: null };

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (!profile) return { user: null, userId: null };

    return { user: profile as UserProfile, userId: session.user.id };
  } catch {
    return { user: null, userId: null };
  }
});
