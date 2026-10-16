import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { syncUser } from "@/lib/sync";

const MIN_INTERVAL_MS = 5 * 60 * 1000;

// Called by the app on open/foreground. Webhooks keep data fresh; this catches anything missed.
export async function POST(request: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { timeZone, force } = await request.json().catch(() => ({}));
  if (typeof timeZone === "string" && timeZone.length < 64) {
    await sql`UPDATE users SET timezone = ${timeZone} WHERE id = ${uid} AND timezone IS DISTINCT FROM ${timeZone}`;
  }

  const [u] = await sql`SELECT last_synced_at FROM users WHERE id = ${uid}`;
  const last = u?.last_synced_at ? new Date(u.last_synced_at).getTime() : 0;
  if (!force && Date.now() - last < MIN_INTERVAL_MS) {
    return NextResponse.json({ synced: false });
  }
  const result = await syncUser(uid);
  return NextResponse.json({ synced: result.ok, error: result.ok ? undefined : result.error });
}
