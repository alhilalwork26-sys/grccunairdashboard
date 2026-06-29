import { createClient } from "@/lib/supabase/server";
import CalendarBoard from "./CalendarBoard";
import type { UserProfile } from "@/types";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

  const [{ data: profile }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("events")
      .select("*, profiles(full_name)")
      .gte("start_date", startOfMonth)
      .lte("start_date", endOfMonth)
      .order("start_date"),
  ]);

  const currentUser: UserProfile = profile ?? {
    id: user!.id, email: user!.email ?? "",
    full_name: user!.user_metadata?.full_name ?? "",
    role: "super_admin", created_at: user!.created_at,
  };

  const reqHeaders = await headers();
  const host  = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "localhost:3000";
  const proto = reqHeaders.get("x-forwarded-proto") ?? "http";
  const calendarUrl = `${proto}://${host}/api/calendar/events?token=${process.env.CALENDAR_SECRET ?? ""}`;

  return <CalendarBoard currentUser={currentUser} initialEvents={events ?? []} calendarUrl={calendarUrl} />;
}
