import { createClient } from "@/lib/supabase/server";
import FinanceBoard from "./FinanceBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";

// Roles that can see full Finance module (overview + transactions + all reimbursements)
const FINANCE_ROLES = ["super_admin", "manager", "kep_finance", "staff_finance", "staff_dokumen"];

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const currentUser: UserProfile = profile ?? {
    id: user.id, email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user.created_at,
  };

  // All authenticated users can access Finance to submit reimbursements
  // Only finance roles get full access (overview, transactions, all reimbs)

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const isFinanceRole = FINANCE_ROLES.includes(currentUser.role);
  const canSeeAll    = ["super_admin", "manager", "kep_finance"].includes(currentUser.role);

  const reimbQuery = supabase
    .from("reimbursements")
    .select("*, requester:profiles!reimbursements_requested_by_fkey(full_name, role), reviewer:profiles!reimbursements_reviewed_by_fkey(full_name)")
    .order("created_at", { ascending: false });

  // Non-finance roles only need reimbursements (their own)
  const [{ data: transactions }, { data: reimbursements }] = await Promise.all([
    isFinanceRole
      ? supabase.from("finance_transactions").select("*, profiles(full_name)").order("date", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    canSeeAll ? reimbQuery : reimbQuery.eq("requested_by", user.id),
  ]);

  return (
    <FinanceBoard
      currentUser={currentUser}
      initialTransactions={transactions ?? []}
      initialReimbursements={reimbursements ?? []}
    />
  );
}
