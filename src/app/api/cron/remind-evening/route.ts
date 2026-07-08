import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { sendPushToUsers } from "@/lib/webpush";

function adminClient() {
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = adminClient();

  // Today's date in WIB (UTC+7) — cron fires at 10:30 UTC = 17:30 WIB
  const todayWIB = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: allUsers } = await admin
    .from("profiles")
    .select("id")
    .neq("is_active", false);

  if (!allUsers?.length) return NextResponse.json({ sent: 0 });

  // Users who already filled activities (Update Sore) today
  const { data: submitted } = await admin
    .from("daily_progress")
    .select("user_id")
    .eq("date", todayWIB)
    .not("activities", "is", null);

  const submittedIds = new Set((submitted ?? []).map((r: { user_id: string }) => r.user_id));
  const pendingIds = allUsers
    .map((u: { id: string }) => u.id)
    .filter((id: string) => !submittedIds.has(id));

  if (!pendingIds.length) return NextResponse.json({ sent: 0 });

  await sendPushToUsers(pendingIds, {
    title: "⏰ Jangan lupa Update Sore!",
    body: "Isi Update Sore sebelum jam 18:00 WIB. Tinggal 30 menit lagi!",
    url: "/dashboard/progress",
    tag: "remind-evening",
  });

  return NextResponse.json({ sent: pendingIds.length });
}
