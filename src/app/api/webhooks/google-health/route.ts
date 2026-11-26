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

// Steps/distance/floors/AZM notifications arrive every few minutes per user, all day. Handling
// them kept the Neon compute from ever scaling to zero and exhausted the free-plan compute quota
// (Nov 2026). Only sleep and workouts sync from webhooks; activity totals refresh when anyone
// opens the app (see /api/sync) and in the daily cron.
const REALTIME_TYPES = ["sleep", "exercise"];
const isRealtime = (dataType?: string) =>
  !!dataType && REALTIME_TYPES.some((t) => dataType.toLowerCase().includes(t));

export async function POST(request: Request) {
  if (!process.env.WEBHOOK_SECRET || !authorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (body?.type === "verification") return new Response(null, { status: 201 });

  // A single notification arrives as { data: {...} }; batches as an array.
  const items: Notification[] = (Array.isArray(body) ? body : [body])
    .map((b) => b?.data ?? b)
    .filter((n): n is Notification => !!n?.healthUserId && isRealtime(n.dataType));
  // Acknowledge without touching the database so the compute can stay asleep.
  if (!items.length) return new Response(null, { status: 204 });

  // Collect the civil dates each user's changes touch, then re-sync just that span.
  const spans = new Map<string, { from: string; to: string }>();
  for (const n of items) {
    const dates: string[] = JSON.stringify(n.intervals ?? []).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    if (!dates.length) continue;
    const prev = spans.get(n.healthUserId!);
    if (prev) dates.push(prev.from, prev.to);
    dates.sort();
    spans.set(n.healthUserId!, { from: dates[0]!, to: dates[dates.length - 1]! });
  }

  after(async () => {
    for (const [healthUserId, span] of spans) {
      const [u] = await sql`SELECT id FROM users WHERE health_user_id = ${healthUserId}`;
      if (u) await syncUser(u.id, span);
    }
  });

  return new Response(null, { status: 204 });
}
