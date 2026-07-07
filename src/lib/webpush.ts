import webpush from "web-push";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/config";

let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  const subject = process.env.VAPID_SUBJECT;
  const pubKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pubKey || !privKey) return;
  webpush.setVapidDetails(subject, pubKey, privKey);
  vapidInitialized = true;
}

function adminClient() {
  return createServerClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureVapid();
  if (!vapidInitialized) return; // VAPID keys missing — skip silently

  const admin = adminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const message = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      })
    )
  );
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
}
