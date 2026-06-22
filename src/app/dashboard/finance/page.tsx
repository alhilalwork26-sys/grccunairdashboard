import { createClient } from "@/lib/supabase/server";
import FinanceBoard from "./FinanceBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

const FINANCE_ROLES = ["super_admin", "manager", "kep_finance", "staff_finance", "staff_dokumen"];

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user!.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  if (!FINANCE_ROLES.includes(currentUser.role)) redirect("/dashboard");

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: transactions }, { data: reimbursements }] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("*, profiles(full_name)")
      .order("date", { ascending: false })
      .limit(100),
    supabase
      .from("reimbursements")
      .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role), reviewer:profiles!reimbursements_reviewed_by_fkey(full_name)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <FinanceBoard
      currentUser={currentUser}
      initialTransactions={transactions ?? []}
      initialReimbursements={reimbursements ?? []}
    />
  );
}
