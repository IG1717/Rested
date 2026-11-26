import "server-only";
import { sql } from "./db";
import { getAccessToken, NotConnectedError } from "./google";
import { dailyRollUp, HealthApiError, listExercise, listSleep } from "./health";
import { addDays, daysBetween, todayIn } from "./dates";
import { mapDays, mapWorkouts, type Row } from "./sync-map";
import { overtaken } from "./awards";
import { formatDuration } from "./metrics";
import { notify } from "./push";

export const BACKFILL_DAYS = 89;
const MAX_RANGE_DAYS = 89; // dailyRollUp accepts at most 90 days

export type SyncResult = { ok: true; from: string; to: string } | { ok: false; error: string };

/**
 * Pulls [from, to] from Google Health and upserts one daily_metrics row per date, plus the
 * workouts in that span. With no range, syncs from a couple of days before the last sync
 * (or a ~3-month backfill on the first sync).
 */
export async function syncUser(
  userId: string,
  range?: { from: string; to: string },
): Promise<SyncResult> {
  const [u] = await sql`
    SELECT timezone, last_synced_at, COALESCE(NULLIF(trim(nickname), ''), split_part(name, ' ', 1)) AS short
    FROM users WHERE id = ${userId}`;
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

    const workouts = mapWorkouts(exercise);
    const { dates, rows } = mapDays(from, to, { steps, distance, floors, energy, azm, sleep, workouts });

    // Today's standing before this sync, for "you got passed" notifications.
    const coversToday = dates.includes(today);
    const [before] = coversToday
      ? await sql<{ steps: number | null; sleep_minutes: number | null }>`
          SELECT steps, sleep_minutes FROM daily_metrics WHERE user_id = ${userId} AND date = ${today}::date`
      : [];

    await upsertDays(userId, dates, rows);
    await replaceWorkouts(userId, from, to, workouts);

    // Only a full "catch-up" sync advances last_synced_at; webhook syncs cover partial ranges.
    if (!range) {
      await sql`
        UPDATE users SET last_synced_at = now(), last_activity_sync_at = now(), sync_error = NULL
        WHERE id = ${userId}`;
    } else {
      await sql`UPDATE users SET last_activity_sync_at = now(), sync_error = NULL WHERE id = ${userId}`;
    }

    // A first sync is a backfill, not someone pulling ahead, so it never notifies.
    if (coversToday && u.last_synced_at) {
      const now = rows[dates.indexOf(today)];
      await notifyOvertakes(userId, u.short, today, before ?? null, now);
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

export async function upsertDays(userId: string, dates: string[], rows: Row[]) {
  const col = <K extends keyof Row>(k: K) => rows.map((r) => r[k]);
  await sql`
    INSERT INTO daily_metrics (user_id, date, steps, azm, active_kcal, floors, distance_m,
      workouts, workout_minutes, sleep_minutes, deep_minutes, rem_minutes, light_minutes,
      awake_minutes, in_bed_minutes, sleep_efficiency, fall_asleep_minutes, nap_minutes,
      bed_clock_min, wake_clock_min, sleep_stages, bedtime, wake_time, updated_at)
    SELECT ${userId}::uuid, d, steps, azm, kcal, floors, dist, wo, wo_min, sleep, deep, rem, light,
      awake, in_bed, eff, fall, nap, bed_clock, wake_clock,
      -- Stages arrive as JSON text and are parsed here. Passing them as jsonb[] makes the driver
      -- JSON-encode each string again, storing a JSON string instead of an array.
      stages::jsonb, bed, wake, now()
    FROM unnest(
      ${dates}::date[], ${col("steps")}::int[], ${col("azm")}::int[], ${col("active_kcal")}::int[],
      ${col("floors")}::int[], ${col("distance_m")}::real[], ${col("workouts")}::int[],
      ${col("workout_minutes")}::int[], ${col("sleep_minutes")}::int[], ${col("deep_minutes")}::int[],
      ${col("rem_minutes")}::int[], ${col("light_minutes")}::int[], ${col("awake_minutes")}::int[],
      ${col("in_bed_minutes")}::int[], ${col("sleep_efficiency")}::real[],
      ${col("fall_asleep_minutes")}::int[], ${col("nap_minutes")}::int[],
      ${col("bed_clock_min")}::int[], ${col("wake_clock_min")}::int[], ${col("sleep_stages")}::text[],
      ${col("bedtime")}::timestamptz[], ${col("wake_time")}::timestamptz[])
      AS x(d, steps, azm, kcal, floors, dist, wo, wo_min, sleep, deep, rem, light, awake, in_bed, eff,
        fall, nap, bed_clock, wake_clock, stages, bed, wake)
    ON CONFLICT (user_id, date) DO UPDATE SET
      steps = EXCLUDED.steps, azm = EXCLUDED.azm, active_kcal = EXCLUDED.active_kcal,
      floors = EXCLUDED.floors, distance_m = EXCLUDED.distance_m, workouts = EXCLUDED.workouts,
      workout_minutes = EXCLUDED.workout_minutes, sleep_minutes = EXCLUDED.sleep_minutes,
      deep_minutes = EXCLUDED.deep_minutes, rem_minutes = EXCLUDED.rem_minutes,
      light_minutes = EXCLUDED.light_minutes, awake_minutes = EXCLUDED.awake_minutes,
      in_bed_minutes = EXCLUDED.in_bed_minutes, sleep_efficiency = EXCLUDED.sleep_efficiency,
      fall_asleep_minutes = EXCLUDED.fall_asleep_minutes, nap_minutes = EXCLUDED.nap_minutes,
      bed_clock_min = EXCLUDED.bed_clock_min, wake_clock_min = EXCLUDED.wake_clock_min,
      sleep_stages = EXCLUDED.sleep_stages, bedtime = EXCLUDED.bedtime, wake_time = EXCLUDED.wake_time,
      updated_at = now()`;
}

async function replaceWorkouts(userId: string, from: string, to: string, workouts: ReturnType<typeof mapWorkouts>) {
  const col = <K extends keyof (typeof workouts)[number]>(k: K) => workouts.map((w) => w[k]);
  if (workouts.length) {
    await sql`
      INSERT INTO workouts (user_id, start_time, local_date, exercise_type, display_name, duration_min,
        kcal, distance_m, steps, avg_hr, azm)
      SELECT ${userId}::uuid, * FROM unnest(
        ${col("start_time")}::timestamptz[], ${col("local_date")}::date[], ${col("exercise_type")}::text[],
        ${col("display_name")}::text[], ${col("duration_min")}::int[], ${col("kcal")}::int[],
        ${col("distance_m")}::real[], ${col("steps")}::int[], ${col("avg_hr")}::int[], ${col("azm")}::int[])
      ON CONFLICT (user_id, start_time) DO UPDATE SET
        local_date = EXCLUDED.local_date, exercise_type = EXCLUDED.exercise_type,
        display_name = EXCLUDED.display_name, duration_min = EXCLUDED.duration_min, kcal = EXCLUDED.kcal,
        distance_m = EXCLUDED.distance_m, steps = EXCLUDED.steps, avg_hr = EXCLUDED.avg_hr, azm = EXCLUDED.azm`;
  }
  // Sessions deleted in Google Health disappear here too.
  await sql`
    DELETE FROM workouts
    WHERE user_id = ${userId} AND local_date BETWEEN ${from}::date AND ${to}::date
      AND NOT (start_time = ANY(${col("start_time")}::timestamptz[]))`;
}

async function notifyOvertakes(
  userId: string,
  short: string,
  today: string,
  before: { steps: number | null; sleep_minutes: number | null } | null,
  now: Row,
) {
  const friends = await sql`
    SELECT f.friend_id AS id, d.steps, d.sleep_minutes
    FROM friendships f
    LEFT JOIN daily_metrics d ON d.user_id = f.friend_id AND d.date = ${today}::date
    WHERE f.user_id = ${userId}`;
  if (!friends.length) return;

  const stepsPassed = overtaken(
    before?.steps ?? null,
    now.steps,
    friends.map((f) => ({ id: f.id, value: f.steps })),
  );
  const sleepPassed = overtaken(
    before?.sleep_minutes ?? null,
    now.sleep_minutes,
    friends.map((f) => ({ id: f.id, value: f.sleep_minutes })),
  );
  const byId = new Map(friends.map((f) => [f.id, f]));
  await Promise.all([
    ...stepsPassed.map((id) =>
      notify(
        id,
        "passed",
        {
          title: `${short} just passed you`,
          body: `${short} is at ${now.steps!.toLocaleString("en-US")} steps today. You're at ${Number(byId.get(id)!.steps).toLocaleString("en-US")}.`,
          url: `/f/${userId}`,
          tag: `passed-steps-${userId}`,
        },
        `passed:steps:${today}:${userId}`,
      ),
    ),
    ...sleepPassed.map((id) =>
      notify(
        id,
        "passed",
        {
          title: `${short} out-slept you`,
          body: `${short} slept ${formatDuration(now.sleep_minutes!)} last night, ahead of your ${formatDuration(byId.get(id)!.sleep_minutes)}.`,
          url: `/f/${userId}`,
          tag: `passed-sleep-${userId}`,
        },
        `passed:sleep:${today}:${userId}`,
      ),
    ),
  ]);
}

function daysSince(ts: string | Date) {
  return Math.max(0, Math.ceil((Date.now() - new Date(ts).getTime()) / 86_400_000));
}
