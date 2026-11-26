import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { syncUser } from "@/lib/sync";

// Google Health webhook receiver. The subscriber is registered with
// endpointAuthorization.secret = "Bearer <WEBHOOK_SECRET>", which Google echoes in the
// Authorization header of every call (including the two-step endpoint verification).

export const maxDuration = 60;

function authorized(header: string | null) {
  const expected = Buffer.from(`Bearer ${process.env.WEBHOOK_SECRET}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type Notification = { healthUserId?: string; dataType?: string; intervals?: unknown[] };

// Sleep and workouts sync as soon as Google tells us. Steps/distance/floors/AZM notifications
// arrive every few minutes per user all day, so those are debounced per user: at most one
// activity sync every ACTIVITY_DEBOUNCE. That keeps leaderboards (and "you got passed" pushes)
// close to real time without syncing on every ping.
const IMMEDIATE_TYPES = ["sleep", "exercise"];
const ACTIVITY_DEBOUNCE = "10 minutes";
const isImmediate = (dataType?: string) =>
  !!dataType && IMMEDIATE_TYPES.some((t) => dataType.toLowerCase().includes(t));

export async function POST(request: Request) {
  if (!process.env.WEBHOOK_SECRET || !authorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (body?.type === "verification") return new Response(null, { status: 201 });

  // A single notification arrives as { data: {...} }; batches as an array.
  const items: Notification[] = (Array.isArray(body) ? body : [body])
    .map((b) => b?.data ?? b)
    .filter((n): n is Notification => !!n?.healthUserId);
  if (!items.length) return new Response(null, { status: 204 });

  // Collect the civil dates each user's changes touch, then re-sync just that span.
  const spans = new Map<string, { from: string; to: string; immediate: boolean }>();
  for (const n of items) {
    const dates: string[] = JSON.stringify(n.intervals ?? []).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    if (!dates.length) continue;
    const prev = spans.get(n.healthUserId!);
    if (prev) dates.push(prev.from, prev.to);
    dates.sort();
    spans.set(n.healthUserId!, {
      from: dates[0]!,
      to: dates[dates.length - 1]!,
      immediate: (prev?.immediate ?? false) || isImmediate(n.dataType),
    });
  }

  after(async () => {
    for (const [healthUserId, { from, to, immediate }] of spans) {
      const [u] = await sql`
        SELECT id, last_activity_sync_at IS NULL
          OR last_activity_sync_at < now() - ${ACTIVITY_DEBOUNCE}::interval AS due
        FROM users WHERE health_user_id = ${healthUserId}`;
      if (u && (immediate || u.due)) await syncUser(u.id, { from, to });
    }
  });

  return new Response(null, { status: 204 });
}
