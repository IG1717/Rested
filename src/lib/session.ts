import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "./db";

const COOKIE = "rested_session";
const MAX_AGE = 60 * 60 * 24 * 365;

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  connected: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const rows = await sql`
    SELECT id, name, email, avatar_url, refresh_token_enc IS NOT NULL AS connected,
           last_synced_at, sync_error
    FROM users WHERE id = ${uid}`;
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url,
    connected: u.connected,
    lastSyncedAt: u.last_synced_at ? new Date(u.last_synced_at).toISOString() : null,
    syncError: u.sync_error,
  };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
  return user;
}
