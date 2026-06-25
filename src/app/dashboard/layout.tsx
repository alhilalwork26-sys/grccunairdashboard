import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/layout/DashboardShell";
import type { UserProfile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // getSession() reads from cookie — no network call to Supabase Auth.
  // The middleware already guards /dashboard routes, so this is safe here.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userProfile: UserProfile | null = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? user.email ?? "",
    role: "super_admin",
    created_at: user.created_at,
  };

  return (
    <DashboardShell user={userProfile}>
      {children}
    </DashboardShell>
  );
}
