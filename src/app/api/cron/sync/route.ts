import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { syncUser } from "@/lib/sync";

// Daily safety net in case webhooks were missed. Triggered by Vercel Cron (vercel.json).
export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(null, { status: 401 });
  }
  const users = await sql`SELECT id FROM users WHERE refresh_token_enc IS NOT NULL`;
  let ok = 0;
  for (const u of users) {
    const r = await syncUser(u.id);
    if (r.ok) ok++;
  }
  return NextResponse.json({ users: users.length, ok });
}
