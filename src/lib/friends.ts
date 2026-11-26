import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import type { DayRow } from "./metrics";

export type Person = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Stable color slot: you are 0, friends follow in the order you added them. */
  slot: number;
  connected: boolean;
  lastSyncedAt: string | null;
  /** When you became friends; null for yourself. */
  since: string | null;
};

/** The viewer first, then their friends in the order they were added. */
export async function getCircle(userId: string): Promise<Person[]> {
  const rows = await sql`
    SELECT u.id, u.name, u.avatar_url, u.refresh_token_enc IS NOT NULL AS connected,
           u.last_synced_at, f.created_at AS since
    FROM users u
    LEFT JOIN friendships f ON f.user_id = ${userId} AND f.friend_id = u.id
    WHERE u.id = ${userId} OR f.friend_id IS NOT NULL
    ORDER BY (u.id = ${userId}) DESC, f.created_at, u.id`;
  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url,
    slot: i,
    connected: r.connected,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    since: r.since ? new Date(r.since).toISOString() : null,
  }));
}

export async function getMetrics(userIds: string[], since: string): Promise<DayRow[]> {
  if (!userIds.length) return [];
  const rows = await sql`
    SELECT user_id, to_char(date, 'YYYY-MM-DD') AS date, steps, azm, active_kcal, floors,
      distance_m, workouts, workout_minutes, sleep_minutes, deep_minutes, rem_minutes,
      light_minutes, in_bed_minutes, sleep_efficiency, bedtime, wake_time
    FROM daily_metrics
    WHERE user_id = ANY(${userIds}::uuid[]) AND date >= ${since}::date
    ORDER BY date`;
  return rows.map((r) => ({
    userId: r.user_id,
    date: r.date,
    steps: r.steps,
    azm: r.azm,
    activeKcal: r.active_kcal,
    floors: r.floors,
    distanceM: r.distance_m,
    workouts: r.workouts,
    workoutMinutes: r.workout_minutes,
    sleepMinutes: r.sleep_minutes,
    deepMinutes: r.deep_minutes,
    remMinutes: r.rem_minutes,
    lightMinutes: r.light_minutes,
    inBedMinutes: r.in_bed_minutes,
    sleepEfficiency: r.sleep_efficiency,
    bedtime: r.bedtime ? new Date(r.bedtime).toISOString() : null,
    wakeTime: r.wake_time ? new Date(r.wake_time).toISOString() : null,
  }));
}

export function newInviteCode() {
  // 12 chars without ambiguous characters.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

export async function getInviteCode(userId: string): Promise<string> {
  const [u] = await sql`SELECT invite_code FROM users WHERE id = ${userId}`;
  return u.invite_code;
}

/** The person whose friend link this is. */
export async function getInviter(code: string) {
  if (!/^[a-z0-9]{6,32}$/.test(code)) return null;
  const [u] = await sql`
    SELECT id, name, avatar_url, (SELECT count(*) FROM friendships f WHERE f.user_id = users.id) AS n
    FROM users WHERE invite_code = ${code}`;
  if (!u) return null;
  return { id: u.id as string, name: u.name as string, avatarUrl: u.avatar_url as string | null, friendCount: Number(u.n) };
}

export async function areFriends(a: string, b: string) {
  const [row] = await sql`SELECT 1 FROM friendships WHERE user_id = ${a} AND friend_id = ${b}`;
  return !!row;
}
