import { cache } from "react";
import { createClient } from "./server";
import type { UserProfile } from "@/types";

// React.cache deduplicates this across layout + page within the same render tree.
// If both layout.tsx and page.tsx call getUser(), Supabase is only hit once.
export const getUser = cache(async (): Promise<{ user: UserProfile | null; userId: string | null }> => {
  const supabase = await createClient();

  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) return { user: null, userId: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (!profile) return { user: null, userId: null };

    return { user: profile as UserProfile, userId: authUser.id };
  } catch {
    return { user: null, userId: null };
  }
});
