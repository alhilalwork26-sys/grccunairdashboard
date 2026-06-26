import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SECRET       = process.env.CALENDAR_SECRET!;

function escapeIcs(str: string) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function foldLine(line: string): string {
  // ICS RFC 5545: lines must be max 75 octets, fold with CRLF + SPACE
  const out: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    out.push(remaining.slice(0, 75));
    remaining = " " + remaining.slice(75);
  }
  out.push(remaining);
  return out.join("\r\n");
}

function toIcsDate(dateStr: string): string {
  // All-day event: YYYYMMDD
  return dateStr.replace(/-/g, "").slice(0, 8);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function nowUtc(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

const STATUS_MAP: Record<string, string> = {
  draft:    "TENTATIVE",
  review:   "TENTATIVE",
  approved: "CONFIRMED",
  posted:   "CONFIRMED",
  rejected: "CANCELLED",
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: posts, error } = await supabase
    .from("content_posts")
    .select("id, judul, caption, platform, hashtags, scheduled_date, status, visual_url, campaign:campaigns!content_posts_campaign_id_fkey(nama)")
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true });

  if (error) {
    return new NextResponse("Database error", { status: 500 });
  }

  const dtstamp = nowUtc();
  const baseUrl = req.nextUrl.origin;

  const events = (posts ?? []).map(p => {
    const dtstart  = toIcsDate(p.scheduled_date!);
    const dtend    = addDays(p.scheduled_date!, 1);
    const status   = STATUS_MAP[p.status] ?? "TENTATIVE";
    const campaign = (p as any).campaign?.nama ? `[${(p as any).campaign.nama}] ` : "";

    const summary = `${campaign}${p.judul} (${p.platform})`;
    const descParts = [
      `Platform: ${p.platform}`,
      `Status: ${p.status.toUpperCase()}`,
      p.caption ? `Caption: ${p.caption}` : "",
      p.hashtags ? `Hashtag: ${p.hashtags}` : "",
      p.visual_url ? `Aset Visual: ${p.visual_url}` : "",
      `Dashboard: ${baseUrl}/dashboard/konten`,
    ].filter(Boolean);

    return [
      "BEGIN:VEVENT",
      foldLine(`UID:grcc-konten-${p.id}@grccunairdashboard`),
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      foldLine(`SUMMARY:${escapeIcs(summary)}`),
      foldLine(`DESCRIPTION:${escapeIcs(descParts.join("\\n"))}`),
      `STATUS:${status}`,
      foldLine(`CATEGORIES:${escapeIcs(p.platform)}`),
      p.visual_url ? foldLine(`URL:${p.visual_url}`) : "",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GRCC UNAIR//Konten Plan//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GRCC UNAIR — Konten Plan",
    "X-WR-TIMEZONE:Asia/Jakarta",
    "X-WR-CALDESC:Jadwal konten media sosial GRCC UNAIR",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="grcc-konten.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
