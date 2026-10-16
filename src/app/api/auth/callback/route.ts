import { cookies } from "next/headers";
import { after, NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { exchangeCode, fetchProfile, HEALTH_SCOPES, storeTokens } from "@/lib/google";
import { getIdentity } from "@/lib/health";
import { createSession } from "@/lib/session";
import { syncUser } from "@/lib/sync";

export async function GET(request: NextRequest) {
  const app = process.env.APP_URL!;
  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const saved = jar.get("rested_oauth")?.value;
  jar.delete("rested_oauth");

  let next = "/";
  try {
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed || parsed.state !== params.get("state")) {
      return NextResponse.redirect(`${app}/?error=state`);
    }
    next = parsed.next;
  } catch {
    return NextResponse.redirect(`${app}/?error=state`);
  }

  const code = params.get("code");
  if (!code) return NextResponse.redirect(`${app}/?error=${params.get("error") ?? "denied"}`);

  const tokens = await exchangeCode(code);
  const granted = tokens.scope.split(" ");
  const profile = await fetchProfile(tokens.access_token);
  const t = storeTokens(tokens);
  const hasHealth = HEALTH_SCOPES.every((s) => granted.includes(s));

  let healthUserId: string | null = null;
  if (hasHealth) {
    try {
      healthUserId = (await getIdentity(tokens.access_token)).healthUserId;
    } catch (e) {
      console.error("getIdentity failed", e);
    }
  }

  const [user] = await sql`
    INSERT INTO users (google_sub, email, name, avatar_url, health_user_id,
      access_token_enc, access_token_expires_at, refresh_token_enc, granted_scopes)
    VALUES (${profile.sub}, ${profile.email}, ${profile.name}, ${profile.picture ?? null},
      ${healthUserId}, ${t.accessEnc}, ${t.expiresAt},
      ${hasHealth ? t.refreshEnc : null}, ${tokens.scope})
    ON CONFLICT (google_sub) DO UPDATE SET
      email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
      health_user_id = COALESCE(EXCLUDED.health_user_id, users.health_user_id),
      access_token_enc = EXCLUDED.access_token_enc,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      refresh_token_enc = CASE WHEN ${hasHealth}
        THEN COALESCE(EXCLUDED.refresh_token_enc, users.refresh_token_enc) ELSE NULL END,
      granted_scopes = EXCLUDED.granted_scopes,
      sync_error = NULL
    RETURNING id, last_synced_at`;

  await createSession(user.id);

  if (!hasHealth) return NextResponse.redirect(`${app}/connect?missing=1`);

  if (!user.last_synced_at) after(() => syncUser(user.id));
  return NextResponse.redirect(`${app}${next}`);
}
