import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import type { DayRow } from "./metrics";

export type GroupSummary = {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
};

export type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Stable 0-based join order; drives the member's color so it never changes with rank. */
  slot: number;
  role: string;
  connected: boolean;
  lastSyncedAt: string | null;
};

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const rows = await sql`
    SELECT g.id, g.name, g.emoji, (SELECT count(*) FROM group_members m2 WHERE m2.group_id = g.id) AS n
    FROM groups g JOIN group_members m ON m.group_id = g.id
    WHERE m.user_id = ${userId}
    ORDER BY m.joined_at`;
  return rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, memberCount: Number(r.n) }));
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function getGroup(groupId: string, userId: string) {
  if (!UUID.test(groupId)) return null;
  const [g] = await sql`
    SELECT g.id, g.name, g.emoji, g.invite_code, m.role
    FROM groups g JOIN group_members m ON m.group_id = g.id AND m.user_id = ${userId}
    WHERE g.id = ${groupId}`;
  if (!g) return null;
  const members = await sql`
    SELECT u.id, u.name, u.avatar_url, m.role, u.refresh_token_enc IS NOT NULL AS connected,
           u.last_synced_at
    FROM group_members m JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ${groupId}
    ORDER BY m.joined_at, u.id`;
  return {
    id: g.id as string,
    name: g.name as string,
    emoji: g.emoji as string,
    inviteCode: g.invite_code as string,
    isOwner: g.role === "owner",
    members: members.map(
      (m, i): Member => ({
        id: m.id,
        name: m.name,
        avatarUrl: m.avatar_url,
        slot: i,
        role: m.role,
        connected: m.connected,
        lastSyncedAt: m.last_synced_at ? new Date(m.last_synced_at).toISOString() : null,
      }),
    ),
  };
}

export async function getGroupMetrics(memberIds: string[], since: string): Promise<DayRow[]> {
  if (!memberIds.length) return [];
  const rows = await sql`
    SELECT user_id, to_char(date, 'YYYY-MM-DD') AS date, steps, azm, active_kcal, floors,
      distance_m, workouts, workout_minutes, sleep_minutes, deep_minutes, rem_minutes,
      in_bed_minutes, sleep_efficiency, sleep_score, bedtime, wake_time
    FROM daily_metrics
    WHERE user_id = ANY(${memberIds}::uuid[]) AND date >= ${since}::date
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
    inBedMinutes: r.in_bed_minutes,
    sleepEfficiency: r.sleep_efficiency,
    sleepScore: r.sleep_score,
    bedtime: r.bedtime ? new Date(r.bedtime).toISOString() : null,
    wakeTime: r.wake_time ? new Date(r.wake_time).toISOString() : null,
  }));
}

export function newInviteCode() {
  // 10 chars of base32-ish, no ambiguous characters.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

export async function getInvite(code: string) {
  const [g] = await sql`
    SELECT g.id, g.name, g.emoji,
      (SELECT count(*) FROM group_members m WHERE m.group_id = g.id) AS n,
      (SELECT array_agg(u.name ORDER BY m.joined_at) FROM group_members m JOIN users u ON u.id = m.user_id
        WHERE m.group_id = g.id) AS names
    FROM groups g WHERE g.invite_code = ${code}`;
  if (!g) return null;
  return {
    id: g.id as string,
    name: g.name as string,
    emoji: g.emoji as string,
    memberCount: Number(g.n),
    memberNames: (g.names ?? []) as string[],
  };
}
