import "server-only";
import { sql } from "./db";
import { getAccessToken, NotConnectedError } from "./google";
import {
  civilDate,
  dailyRollUp,
  HealthApiError,
  listExercise,
  listSleep,
  type DailyRollup,
  type SleepSession,
} from "./health";
import { addDays, dateRange, daysBetween, todayIn } from "./dates";
import { sleepScore } from "./sleep-score";

export const BACKFILL_DAYS = 30;
const MAX_RANGE_DAYS = 89; // dailyRollUp accepts at most 90 days

type Row = {
  steps: number | null;
  azm: number | null;
  active_kcal: number | null;
  floors: number | null;
  distance_m: number | null;
  workouts: number | null;
  workout_minutes: number | null;
  sleep_minutes: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  in_bed_minutes: number | null;
  sleep_efficiency: number | null;
  sleep_score: number | null;
  bedtime: string | null;
  wake_time: string | null;
};

const emptyRow = (): Row => ({
  steps: null,
  azm: null,
  active_kcal: null,
  floors: null,
  distance_m: null,
  workouts: null,
  workout_minutes: null,
  sleep_minutes: null,
  deep_minutes: null,
  rem_minutes: null,
  light_minutes: null,
  awake_minutes: null,
  in_bed_minutes: null,
  sleep_efficiency: null,
  sleep_score: null,
  bedtime: null,
  wake_time: null,
});

const num = (s: string | number | undefined) => (s == null ? null : Number(s));

function byDate(points: DailyRollup[]) {
  return new Map(points.map((p) => [civilDate(p.civilStartTime), p]));
}

function stageMinutes(s: SleepSession, type: string): number | null {
  const stage = s.summary?.stagesSummary?.find((x) => x.type === type);
  return stage ? Number(stage.minutes ?? 0) : null;
}

/** Picks the night's main sleep: Google's `mainSleep` flag, else the longest non-nap. */
function mainSleepByDate(sessions: SleepSession[]) {
  const out = new Map<string, SleepSession>();
  for (const s of sessions) {
    if (s.metadata?.nap) continue;
    const date = civilDate(s.interval.civilEndTime);
    const cur = out.get(date);
    const asleep = Number(s.summary?.minutesAsleep ?? 0);
    if (
      !cur ||
      (s.metadata?.mainSleep && !cur.metadata?.mainSleep) ||
      (!!s.metadata?.mainSleep === !!cur.metadata?.mainSleep &&
        asleep > Number(cur.summary?.minutesAsleep ?? 0))
    ) {
      out.set(date, s);
    }
  }
  return out;
}

function durationMinutes(d: string | undefined, start: string, end: string) {
  if (d?.endsWith("s")) return Math.round(parseFloat(d) / 60);
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

export type SyncResult = { ok: true; from: string; to: string } | { ok: false; error: string };

/**
 * Pulls [from, to] from Google Health and upserts one daily_metrics row per date.
 * With no range, syncs from a couple of days before the last sync (or a 30-day backfill).
 */
export async function syncUser(
  userId: string,
  range?: { from: string; to: string },
): Promise<SyncResult> {
  const [u] = await sql`SELECT timezone, last_synced_at FROM users WHERE id = ${userId}`;
  if (!u) return { ok: false, error: "No such user" };
  const today = todayIn(u.timezone);

  let from: string;
  let to: string;
  if (range) {
    ({ from, to } = range);
  } else {
    to = today;
    const lookback = u.last_synced_at
      ? Math.min(BACKFILL_DAYS, 2 + daysSince(u.last_synced_at))
      : BACKFILL_DAYS;
    from = addDays(today, -lookback);
  }
  if (to > today) to = today;
  if (daysBetween(from, to) > MAX_RANGE_DAYS) from = addDays(to, -MAX_RANGE_DAYS);
  if (from > to) return { ok: true, from, to };

  try {
    const token = await getAccessToken(userId);
    const [steps, distance, floors, energy, azm, sleep, exercise] = await Promise.all([
      dailyRollUp(token, "steps", from, to),
      dailyRollUp(token, "distance", from, to),
      dailyRollUp(token, "floors", from, to),
      dailyRollUp(token, "active-energy-burned", from, to),
      dailyRollUp(token, "active-zone-minutes", from, to),
      listSleep(token, from, to),
      listExercise(token, from, to),
    ]);

    const stepsBy = byDate(steps);
    const distBy = byDate(distance);
    const floorsBy = byDate(floors);
    const energyBy = byDate(energy);
    const azmBy = byDate(azm);
    const sleepBy = mainSleepByDate(sleep);

    const workoutsBy = new Map<string, { count: number; minutes: number }>();
    for (const e of exercise) {
      const date = civilDate(e.interval.civilStartTime);
      const w = workoutsBy.get(date) ?? { count: 0, minutes: 0 };
      w.count += 1;
      w.minutes += durationMinutes(e.activeDuration, e.interval.startTime, e.interval.endTime);
      workoutsBy.set(date, w);
    }

    const dates = dateRange(from, to);
    const rows = dates.map((date) => {
      const r = emptyRow();
      r.steps = num(stepsBy.get(date)?.steps?.countSum);
      const mm = num(distBy.get(date)?.distance?.millimetersSum);
      r.distance_m = mm == null ? null : mm / 1000;
      r.floors = num(floorsBy.get(date)?.floors?.countSum);
      const kcal = energyBy.get(date)?.activeEnergyBurned?.kcalSum;
      r.active_kcal = kcal == null ? null : Math.round(kcal);
      const z = azmBy.get(date)?.activeZoneMinutes;
      r.azm = z
        ? Number(z.sumInFatBurnHeartZone ?? 0) +
          Number(z.sumInCardioHeartZone ?? 0) +
          Number(z.sumInPeakHeartZone ?? 0)
        : null;
      const w = workoutsBy.get(date);
      r.workouts = w?.count ?? (r.steps != null ? 0 : null);
      r.workout_minutes = w?.minutes ?? (r.steps != null ? 0 : null);

      const s = sleepBy.get(date);
      if (s?.summary) {
        const asleep = Number(s.summary.minutesAsleep ?? 0);
        const inBed = Number(s.summary.minutesInSleepPeriod ?? 0);
        const deep = stageMinutes(s, "DEEP");
        const rem = stageMinutes(s, "REM");
        r.sleep_minutes = asleep;
        r.in_bed_minutes = inBed;
        r.deep_minutes = deep;
        r.rem_minutes = rem;
        r.light_minutes = stageMinutes(s, "LIGHT");
        r.awake_minutes = Number(s.summary.minutesAwake ?? 0);
        r.sleep_efficiency = inBed > 0 ? asleep / inBed : null;
        r.sleep_score = sleepScore({ asleep, inBed, deep, rem });
        r.bedtime = s.interval.startTime;
        r.wake_time = s.interval.endTime;
      }
      return r;
    });

    const col = <K extends keyof Row>(k: K) => rows.map((r) => r[k]);
    await sql`
      INSERT INTO daily_metrics (user_id, date, steps, azm, active_kcal, floors, distance_m,
        workouts, workout_minutes, sleep_minutes, deep_minutes, rem_minutes, light_minutes,
        awake_minutes, in_bed_minutes, sleep_efficiency, sleep_score, bedtime, wake_time, updated_at)
      SELECT ${userId}::uuid, * , now() FROM unnest(
        ${dates}::date[], ${col("steps")}::int[], ${col("azm")}::int[], ${col("active_kcal")}::int[],
        ${col("floors")}::int[], ${col("distance_m")}::real[], ${col("workouts")}::int[],
        ${col("workout_minutes")}::int[], ${col("sleep_minutes")}::int[], ${col("deep_minutes")}::int[],
        ${col("rem_minutes")}::int[], ${col("light_minutes")}::int[], ${col("awake_minutes")}::int[],
        ${col("in_bed_minutes")}::int[], ${col("sleep_efficiency")}::real[], ${col("sleep_score")}::int[],
        ${col("bedtime")}::timestamptz[], ${col("wake_time")}::timestamptz[])
      ON CONFLICT (user_id, date) DO UPDATE SET
        steps = EXCLUDED.steps, azm = EXCLUDED.azm, active_kcal = EXCLUDED.active_kcal,
        floors = EXCLUDED.floors, distance_m = EXCLUDED.distance_m, workouts = EXCLUDED.workouts,
        workout_minutes = EXCLUDED.workout_minutes, sleep_minutes = EXCLUDED.sleep_minutes,
        deep_minutes = EXCLUDED.deep_minutes, rem_minutes = EXCLUDED.rem_minutes,
        light_minutes = EXCLUDED.light_minutes, awake_minutes = EXCLUDED.awake_minutes,
        in_bed_minutes = EXCLUDED.in_bed_minutes, sleep_efficiency = EXCLUDED.sleep_efficiency,
        sleep_score = EXCLUDED.sleep_score, bedtime = EXCLUDED.bedtime, wake_time = EXCLUDED.wake_time,
        updated_at = now()`;

    // Only a full "catch-up" sync advances last_synced_at; webhook syncs cover partial ranges.
    if (!range) {
      await sql`UPDATE users SET last_synced_at = now(), sync_error = NULL WHERE id = ${userId}`;
    } else {
      await sql`UPDATE users SET sync_error = NULL WHERE id = ${userId}`;
    }
    return { ok: true, from, to };
  } catch (e) {
    const error =
      e instanceof NotConnectedError
        ? "Google Health isn't connected."
        : e instanceof HealthApiError && e.status === 400 && e.body.includes("ACCOUNT_NOT_LINKED")
          ? "This Google account isn't linked to Google Health yet."
          : "Couldn't reach Google Health. We'll try again soon.";
    console.error(`sync failed for ${userId}`, e);
    if (!(e instanceof NotConnectedError)) {
      await sql`UPDATE users SET sync_error = ${error} WHERE id = ${userId}`;
    }
    return { ok: false, error };
  }
}

function daysSince(ts: string | Date) {
  return Math.max(0, Math.ceil((Date.now() - new Date(ts).getTime()) / 86_400_000));
}
