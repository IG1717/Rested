import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Stores (POST) or removes (DELETE) this device's Web Push subscription.
export async function POST(request: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sub = await request.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  await sql`
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (${endpoint}, ${uid}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = await request.json().catch(() => ({}));
  if (typeof endpoint === "string") {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${uid}`;
  }
  return NextResponse.json({ ok: true });
}
