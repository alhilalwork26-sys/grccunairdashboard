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
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron-job-uid") !== null;
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (!isVercelCron) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = adminClient();

  // Today's date in WIB (UTC+7) — cron fires at 10:00 UTC = 17:00 WIB
  const todayWIB = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: allUsers, error: usersError } = await admin
    .from("profiles")
    .select("id")
    .neq("is_active", false);

  if (usersError) {
    console.error("[cron/remind-evening] profiles query failed:", usersError.message);
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }
  if (!allUsers?.length) return NextResponse.json({ sent: 0 });

  const { data: submitted, error: progressError } = await admin
    .from("daily_progress")
    .select("user_id")
    .eq("date", todayWIB)
    .not("activities", "is", null);

  if (progressError) {
    console.error("[cron/remind-evening] daily_progress query failed:", progressError.message);
    return NextResponse.json({ error: progressError.message }, { status: 500 });
  }

  const submittedIds = new Set((submitted ?? []).map((r: { user_id: string }) => r.user_id));
  const pendingIds = allUsers
    .map((u: { id: string }) => u.id)
    .filter((id: string) => !submittedIds.has(id));

  if (!pendingIds.length) return NextResponse.json({ sent: 0 });

  await sendPushToUsers(pendingIds, {
    title: "⏰ Jangan lupa Update Sore!",
    body: "Isi Update Sore sebelum jam 18:00 WIB. Masih ada 1 jam lagi!",
    url: "/dashboard/progress",
    tag: "remind-evening",
  });

  console.info(`[cron/remind-evening] sent to ${pendingIds.length} users`);
  return NextResponse.json({ sent: pendingIds.length });
}
