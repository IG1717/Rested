import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { sql } from "./db";

export type NotifyType = "reactions" | "passed" | "weekly" | "friends";
export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  setVapidDetails(VAPID_SUBJECT || "https://rested-tau.vercel.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

const PREF_COLUMN: Record<NotifyType, string> = {
  reactions: "notify_reactions",
  passed: "notify_passed",
  weekly: "notify_weekly",
  friends: "notify_friends",
};

/**
 * Sends a push to every device the user subscribed, if they allow this type. With a dedupe key,
 * sends at most once per key per user. Never throws: notifications are best-effort.
 */
export async function notify(userId: string, type: NotifyType, payload: PushPayload, dedupeKey?: string) {
  try {
    if (!configure()) return;
    const [u] = await sql`
      SELECT notify_reactions, notify_passed, notify_weekly, notify_friends FROM users WHERE id = ${userId}`;
    if (!u?.[PREF_COLUMN[type]]) return;
    const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;
    if (!subs.length) return;
    if (dedupeKey) {
      const [fresh] = await sql`
        INSERT INTO notification_log (user_id, key) VALUES (${userId}, ${dedupeKey})
        ON CONFLICT DO NOTHING RETURNING 1 AS ok`;
      if (!fresh) return;
    }
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 12, urgency: type === "weekly" ? "low" : "normal" },
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Gone or invalid: the browser dropped this subscription.
          if (status === 404 || status === 410) {
            await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
          } else {
            console.error("push failed", status, (e as Error).message);
          }
        }
      }),
    );
  } catch (e) {
    console.error("notify failed", e);
  }
}
