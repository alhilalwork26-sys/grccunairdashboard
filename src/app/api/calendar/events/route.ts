import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SECRET       = process.env.CALENDAR_SECRET!;

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/\r/g, "");
}

function fold(line: string): string {
  const out: string[] = [];
  let r = line;
  while (r.length > 75) { out.push(r.slice(0, 75)); r = " " + r.slice(75); }
  out.push(r);
  return out.join("\r\n");
}

function toDate(d: string) { return d.replace(/-/g, "").slice(0, 8); }
function addDay(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}
function toDateTime(date: string, time?: string | null): string {
  if (!time) return `${toDate(date)}`;
  // Convert WIB (UTC+7) time to UTC
  const [h, m] = time.split(":").map(Number);
  const dt = new Date(`${date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+07:00`);
  return dt.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

const TYPE_CATEGORY: Record<string, string> = {
  meeting: "Meeting", deadline: "Deadline", event: "Event",
  holiday: "Libur", training: "Training",
};
const TYPE_STATUS: Record<string, string> = {
  meeting: "CONFIRMED", deadline: "CONFIRMED", event: "CONFIRMED",
  holiday: "CONFIRMED", training: "CONFIRMED",
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== SECRET) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, description, type, start_date, end_date, start_time, end_time")
    .order("start_date", { ascending: true });

  if (error) return new NextResponse("Database error", { status: 500 });

  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const baseUrl = req.nextUrl.origin;

  const vevents = (events ?? []).map(e => {
    const hasTime   = !!e.start_time;
    const isAllDay  = !hasTime;
    const startVal  = hasTime ? toDateTime(e.start_date, e.start_time) : toDate(e.start_date);
    const endDate   = e.end_date ?? e.start_date;
    const endVal    = hasTime
      ? toDateTime(endDate, e.end_time ?? e.start_time)
      : addDay(endDate, 1);

    const dtstart   = isAllDay ? `DTSTART;VALUE=DATE:${startVal}` : `DTSTART:${startVal}`;
    const dtend     = isAllDay ? `DTEND;VALUE=DATE:${endVal}`     : `DTEND:${endVal}`;

    const descParts = [
      `Tipe: ${TYPE_CATEGORY[e.type] ?? e.type}`,
      e.description?.replace(/\[ts:[^\]]+\]/g, "").trim() ?? "",
      `Dashboard: ${baseUrl}/dashboard/calendar`,
    ].filter(Boolean);

    return [
      "BEGIN:VEVENT",
      fold(`UID:grcc-event-${e.id}@grccunairdashboard`),
      `DTSTAMP:${now}`,
      dtstart,
      dtend,
      fold(`SUMMARY:${escape(e.title)}`),
      fold(`DESCRIPTION:${escape(descParts.join("\\n"))}`),
      `STATUS:${TYPE_STATUS[e.type] ?? "CONFIRMED"}`,
      fold(`CATEGORIES:${escape(TYPE_CATEGORY[e.type] ?? e.type)}`),
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GRCC UNAIR//Kalender//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GRCC UNAIR — Kalender",
    "X-WR-TIMEZONE:Asia/Jakarta",
    "X-WR-CALDESC:Kalender event GRCC UNAIR (meeting, deadline, training, libur)",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="grcc-kalender.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
