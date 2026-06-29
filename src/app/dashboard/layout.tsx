import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/getUser";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}
