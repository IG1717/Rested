import "server-only";
import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";

export const HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
];
const SCOPES = ["openid", "email", "profile", ...HEALTH_SCOPES];

export function redirectUri() {
  return `${process.env.APP_URL}/api/auth/callback`;
}

export function authorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Always re-prompt so Google returns a refresh token, even for returning users.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`Google token error: ${json.error ?? res.status}`);
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return json;
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

export type GoogleProfile = { sub: string; email: string; name: string; picture?: string };

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json();
}

export function storeTokens(tokens: TokenResponse) {
  return {
    accessEnc: encrypt(tokens.access_token),
    refreshEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
  };
}

export class NotConnectedError extends Error {}

/** Returns a valid access token for the user, refreshing it if needed. */
export async function getAccessToken(userId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token_enc, access_token_expires_at, refresh_token_enc
    FROM users WHERE id = ${userId}`;
  const u = rows[0];
  if (!u?.refresh_token_enc) throw new NotConnectedError("Google Health not connected");
  if (u.access_token_enc && new Date(u.access_token_expires_at) > new Date()) {
    return decrypt(u.access_token_enc);
  }
  try {
    const tokens = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: decrypt(u.refresh_token_enc),
    });
    const t = storeTokens(tokens);
    await sql`
      UPDATE users SET access_token_enc = ${t.accessEnc}, access_token_expires_at = ${t.expiresAt},
        refresh_token_enc = COALESCE(${t.refreshEnc}, refresh_token_enc)
      WHERE id = ${userId}`;
    return tokens.access_token;
  } catch (e) {
    if ((e as { code?: string }).code === "invalid_grant") {
      // Access was revoked or expired; the user has to reconnect.
      await sql`
        UPDATE users SET refresh_token_enc = NULL, access_token_enc = NULL,
          sync_error = 'Google access expired. Reconnect to keep syncing.'
        WHERE id = ${userId}`;
      throw new NotConnectedError("Google access revoked");
    }
    throw e;
  }
}
