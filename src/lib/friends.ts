import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { shortNames } from "./names";
import type { DayRow } from "./metrics";
import type { ReactionKind } from "./reactions";

export type Person = {
  id: string;
  name: string;
  /** Nickname or first name, disambiguated within this circle. */
  short: string;
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
    SELECT u.id, u.name, u.nickname, u.avatar_url, u.refresh_token_enc IS NOT NULL AS connected,
           u.last_synced_at, f.created_at AS since
    FROM users u
    LEFT JOIN friendships f ON f.user_id = ${userId} AND f.friend_id = u.id
    WHERE u.id = ${userId} OR f.friend_id IS NOT NULL
    ORDER BY (u.id = ${userId}) DESC, f.created_at, u.id`;
  const names = shortNames(rows.map((r) => ({ id: r.id, name: r.name, nickname: r.nickname })));
  return rows.map((r, i) => ({
    id: r.id,
    name: r.nickname?.trim() || r.name,
    short: names.get(r.id)!,
    avatarUrl: r.avatar_url,
    slot: i,
    connected: r.connected,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    since: r.since ? new Date(r.since).toISOString() : null,
  }));
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function getMetrics(userIds: string[], since: string): Promise<DayRow[]> {
  if (!userIds.length) return [];
  const rows = await sql`
    SELECT user_id, to_char(date, 'YYYY-MM-DD') AS date, steps, azm, active_kcal, floors,
      distance_m, workouts, workout_minutes, sleep_minutes, deep_minutes, rem_minutes,
      light_minutes, in_bed_minutes, sleep_efficiency, fall_asleep_minutes, nap_minutes,
      bed_clock_min, wake_clock_min, bedtime, wake_time
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
    fallAsleepMinutes: r.fall_asleep_minutes,
    napMinutes: r.nap_minutes,
    bedClockMin: r.bed_clock_min,
    wakeClockMin: r.wake_clock_min,
    bedtime: iso(r.bedtime),
    wakeTime: iso(r.wake_time),
  }));
}

/** [startOffsetMin, durationMin, stage] */
export type Stage = [number, number, string];

export type Night = {
  date: string;
  sleepMinutes: number;
  inBedMinutes: number | null;
  deep: number | null;
  rem: number | null;
  light: number | null;
  bedClockMin: number | null;
  wakeClockMin: number | null;
  stages: Stage[] | null;
};

/** One person's most recent nights, newest first, with hypnograms. */
export async function getNights(userId: string, limit = 14): Promise<Night[]> {
  const rows = await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, sleep_minutes, in_bed_minutes, deep_minutes,
      rem_minutes, light_minutes, bed_clock_min, wake_clock_min, sleep_stages
    FROM daily_metrics
    WHERE user_id = ${userId} AND sleep_minutes IS NOT NULL
    ORDER BY date DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    date: r.date,
    sleepMinutes: r.sleep_minutes,
    inBedMinutes: r.in_bed_minutes,
    deep: r.deep_minutes,
    rem: r.rem_minutes,
    light: r.light_minutes,
    bedClockMin: r.bed_clock_min,
    wakeClockMin: r.wake_clock_min,
    stages: parseStages(r.sleep_stages),
  }));
}

/** Tolerates rows written before the double-encoding fix (a JSON string instead of an array). */
function parseStages(v: unknown): Stage[] | null {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return Array.isArray(v) ? (v as Stage[]) : null;
}

export type Workout = {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  type: string | null;
  name: string | null;
  durationMin: number;
  kcal: number | null;
  distanceM: number | null;
  steps: number | null;
  avgHr: number | null;
};

export async function getWorkouts(userId: string, limit = 12): Promise<Workout[]> {
  const rows = await sql`
    SELECT id, user_id, to_char(local_date, 'YYYY-MM-DD') AS date, start_time, exercise_type,
      display_name, duration_min, kcal, distance_m, steps, avg_hr
    FROM workouts WHERE user_id = ${userId}
    ORDER BY start_time DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    date: r.date,
    startTime: new Date(r.start_time).toISOString(),
    type: r.exercise_type,
    name: r.display_name,
    durationMin: r.duration_min,
    kcal: r.kcal,
    distanceM: r.distance_m,
    steps: r.steps,
    avgHr: r.avg_hr,
  }));
}

export type Reaction = { from: string; to: string; kind: ReactionKind; ref: string; emoji: string };

/** All reactions to these people's items with refs in the list (or any ref when omitted). */
export async function getReactions(toUsers: string[], refs?: string[]): Promise<Reaction[]> {
  if (!toUsers.length) return [];
  const rows = refs
    ? await sql`
        SELECT from_user, to_user, kind, ref, emoji FROM reactions
        WHERE to_user = ANY(${toUsers}::uuid[]) AND ref = ANY(${refs}::text[])
        ORDER BY created_at`
    : await sql`
        SELECT from_user, to_user, kind, ref, emoji FROM reactions
        WHERE to_user = ANY(${toUsers}::uuid[]) AND created_at > now() - interval '120 days'
        ORDER BY created_at`;
  return rows.map((r) => ({ from: r.from_user, to: r.to_user, kind: r.kind, ref: r.ref, emoji: r.emoji }));
}

export type ReceivedReaction = Reaction & { fromName: string; fromAvatar: string | null; at: string; unseen: boolean };

export async function getReceivedReactions(userId: string, limit = 20): Promise<ReceivedReaction[]> {
  const rows = await sql`
    SELECT r.from_user, r.to_user, r.kind, r.ref, r.emoji, r.created_at,
      COALESCE(NULLIF(trim(u.nickname), ''), u.name) AS from_name, u.avatar_url,
      r.created_at > me.reactions_seen_at AS unseen
    FROM reactions r
    JOIN users u ON u.id = r.from_user
    JOIN users me ON me.id = r.to_user
    WHERE r.to_user = ${userId}
    ORDER BY r.created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    from: r.from_user,
    to: r.to_user,
    kind: r.kind,
    ref: r.ref,
    emoji: r.emoji,
    fromName: r.from_name,
    fromAvatar: r.avatar_url,
    at: new Date(r.created_at).toISOString(),
    unseen: r.unseen,
  }));
}

export async function unseenReactionCount(userId: string): Promise<number> {
  const [r] = await sql`
    SELECT count(*) AS n FROM reactions r JOIN users me ON me.id = r.to_user
    WHERE r.to_user = ${userId} AND r.created_at > me.reactions_seen_at`;
  return Number(r?.n ?? 0);
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
    SELECT id, COALESCE(NULLIF(trim(nickname), ''), name) AS name, avatar_url,
      (SELECT count(*) FROM friendships f WHERE f.user_id = users.id) AS n
    FROM users WHERE invite_code = ${code}`;
  if (!u) return null;
  return { id: u.id as string, name: u.name as string, avatarUrl: u.avatar_url as string | null, friendCount: Number(u.n) };
}

export async function areFriends(a: string, b: string) {
  const [row] = await sql`SELECT 1 FROM friendships WHERE user_id = ${a} AND friend_id = ${b}`;
  return !!row;
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await sql`SELECT friend_id FROM friendships WHERE user_id = ${userId}`;
  return rows.map((r) => r.friend_id);
}
