import { createClient } from "@/lib/supabase/server";
import ReportBoard from "./ReportBoard";
import type { UserProfile } from "@/types";

export default async function ReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now   = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [
    { data: profile },
    { data: tasks },
    { data: transactions },
    { data: progresses },
    { data: trainings },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("tasks").select("id, status, priority, due_date, assigned_to, created_at, assignee:profiles!tasks_assigned_to_fkey(full_name)"),
    supabase.from("finance_transactions").select("id, amount, type, category, date, status").eq("status", "confirmed"),
    supabase.from("daily_progress").select("id, user_id, date, mood, profiles(full_name, role)").gte("date", monthStart),
    supabase.from("training_sessions").select("id, status"),
    supabase.from("profiles").select("id, full_name, role"),
  ]);

  const userProfile: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? user!.email ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  // --- Aggregate task stats ---
  const allTasks = tasks ?? [];
  const taskByStatus = {
    pending:     allTasks.filter(t => t.status === "pending").length,
    in_progress: allTasks.filter(t => t.status === "in_progress").length,
    review:      allTasks.filter(t => t.status === "review").length,
    done:        allTasks.filter(t => t.status === "done").length,
  };
  const overdueCount = allTasks.filter(t => t.due_date && t.due_date < today && t.status !== "done").length;
  const completionRate = allTasks.length > 0 ? Math.round((taskByStatus.done / allTasks.length) * 100) : 0;

  // Tasks per member (top 8)
  const taskByMember: Record<string, { name: string; total: number; done: number }> = {};
  allTasks.forEach(t => {
    const assignee = t.assigned_to as string | null;
    if (!assignee) return;
    const name = (t.assignee as any)?.full_name ?? assignee;
    if (!taskByMember[assignee]) taskByMember[assignee] = { name, total: 0, done: 0 };
    taskByMember[assignee].total++;
    if (t.status === "done") taskByMember[assignee].done++;
  });
  const taskMemberRows = Object.values(taskByMember)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // --- Finance stats ---
  const allTrx = transactions ?? [];
  const totalIncome  = allTrx.filter(t => t.type === "income").reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalExpense = allTrx.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount ?? 0), 0);

  const expByCategory: Record<string, number> = {};
  allTrx.filter(t => t.type === "expense").forEach(t => {
    expByCategory[t.category] = (expByCategory[t.category] ?? 0) + (t.amount ?? 0);
  });
  const topExpenseCategories = Object.entries(expByCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([cat, amount]) => ({ cat, amount }));

  // --- Progress stats (current month) ---
  const allProgress = progresses ?? [];
  const progressByMember: Record<string, { name: string; role: string; count: number; avgMood: number }> = {};
  allProgress.forEach(p => {
    const uid = p.user_id as string;
    const name = (p.profiles as any)?.full_name ?? uid;
    const role = (p.profiles as any)?.role ?? "";
    if (!progressByMember[uid]) progressByMember[uid] = { name, role, count: 0, avgMood: 0 };
    progressByMember[uid].count++;
    progressByMember[uid].avgMood += p.mood ?? 0;
  });
  const progressRows = Object.values(progressByMember).map(m => ({
    ...m, avgMood: m.count > 0 ? Math.round((m.avgMood / m.count) * 10) / 10 : 0,
  })).sort((a, b) => b.count - a.count);

  // --- Training stats ---
  const allTrainings = trainings ?? [];
  const trainingStats = {
    upcoming:  allTrainings.filter(t => t.status === "upcoming").length,
    ongoing:   allTrainings.filter(t => t.status === "ongoing").length,
    done:      allTrainings.filter(t => t.status === "done").length,
    cancelled: allTrainings.filter(t => t.status === "cancelled").length,
  };

  return (
    <ReportBoard
      user={userProfile}
      taskByStatus={taskByStatus}
      overdueCount={overdueCount}
      completionRate={completionRate}
      totalTasks={allTasks.length}
      taskMemberRows={taskMemberRows}
      totalIncome={totalIncome}
      totalExpense={totalExpense}
      topExpenseCategories={topExpenseCategories}
      progressRows={progressRows}
      trainingStats={trainingStats}
      currentMonth={now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
    />
  );
}
