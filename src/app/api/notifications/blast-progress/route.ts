import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/getUser";
import { sendPushToUsers } from "@/lib/webpush";

function adminClient() {
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function POST() {
  const { user } = await getUser();
  if (!user || !["super_admin", "manager"].includes(user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = adminClient();

  // WIB = UTC+7
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayWIB = nowWIB.toISOString().slice(0, 10);
  const hourWIB = nowWIB.getUTCHours() + nowWIB.getUTCMinutes() / 60;

  // Determine which phase to remind based on current WIB time
  // Morning: before 11:00 WIB | Evening: 12:00–18:00 WIB
  // Outside active windows → nothing to remind
  const isMorningPhase = hourWIB < 11;
  const isEveningPhase = hourWIB >= 12 && hourWIB < 18;
  if (!isMorningPhase && !isEveningPhase) {
    return NextResponse.json({ sent: 0, phase: "off_hours" });
  }
  const column = isEveningPhase ? "activities" : "morning_plan";
  const phase = isEveningPhase ? "evening" : "morning";

  const { data: allUsers, error: usersError } = await admin
    .from("profiles")
    .select("id")
    .neq("is_active", false);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }
  if (!allUsers?.length) return NextResponse.json({ sent: 0, phase });

  const { data: submitted, error: progressError } = await admin
    .from("daily_progress")
    .select("user_id")
    .eq("date", todayWIB)
    .not(column, "is", null);

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 });
  }

  const submittedIds = new Set((submitted ?? []).map((r: { user_id: string }) => r.user_id));
  const pendingIds = allUsers
    .map((u: { id: string }) => u.id)
    .filter((id: string) => !submittedIds.has(id) && id !== user.id);

  if (!pendingIds.length) return NextResponse.json({ sent: 0, phase });

  const payload = isEveningPhase
    ? { title: "⏰ Jangan lupa Update Sore!", body: "Manager memintamu mengisi Update Sore sekarang.", url: "/dashboard/progress", tag: "blast-evening" }
    : { title: "⏰ Jangan lupa Rencana Pagi!", body: "Manager memintamu mengisi Rencana Pagi sekarang.", url: "/dashboard/progress", tag: "blast-morning" };

  await sendPushToUsers(pendingIds, payload);

  return NextResponse.json({ sent: pendingIds.length, phase });
}
