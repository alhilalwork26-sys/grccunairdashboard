import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import ProfileBoard from "./ProfileBoard";
import type { UserProfile } from "@/types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return <ProfileBoard user={profile as UserProfile} />;
}
