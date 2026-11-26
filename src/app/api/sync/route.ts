import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { syncUser } from "@/lib/sync";

export const maxDuration = 60;

const MIN_INTERVAL_MS = 5 * 60 * 1000;
const FRIEND_STALE = "15 minutes";

// Called by the app on open/foreground. Syncs the viewer, plus any friends whose data is
// stale, so leaderboards are current whenever someone looks. Activity webhooks are ignored
// (see the webhook route), so this is the main path for fresh steps/AZM during the day.
export async function POST(request: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { timeZone, force } = await request.json().catch(() => ({}));
  if (typeof timeZone === "string" && timeZone.length < 64) {
    await sql`UPDATE users SET timezone = ${timeZone} WHERE id = ${uid} AND timezone IS DISTINCT FROM ${timeZone}`;
  }

  const [u] = await sql`SELECT last_synced_at FROM users WHERE id = ${uid}`;
  const last = u?.last_synced_at ? new Date(u.last_synced_at).getTime() : 0;
  const selfDue = force || Date.now() - last >= MIN_INTERVAL_MS;

  const mates = await sql`
    SELECT u.id FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ${uid}
      AND u.refresh_token_enc IS NOT NULL
      AND (u.last_synced_at IS NULL OR u.last_synced_at < now() - ${FRIEND_STALE}::interval)`;

  if (!selfDue && !mates.length) return NextResponse.json({ synced: false });

  const [self, ...others] = await Promise.all([
    selfDue ? syncUser(uid) : null,
    ...mates.map((m) => syncUser(m.id).catch(() => null)),
  ]);
  const anyOk = !!self?.ok || others.some((r) => r?.ok);
  return NextResponse.json({
    synced: anyOk,
    error: self && !self.ok ? self.error : undefined,
  });
}
