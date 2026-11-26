// Pure mapping from Google Health responses to Rested's daily rows and workouts. No I/O, so it
// can be unit-tested against fixture JSON.
import {
  civilDate,
  sessionEndDate,
  sessionStartDate,
  type DailyRollup,
  type ExerciseSession,
  type SleepSession,
} from "./health";
import { dateRange } from "./dates";

export type Row = {
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
  fall_asleep_minutes: number | null;
  nap_minutes: number | null;
  bed_clock_min: number | null;
  wake_clock_min: number | null;
  sleep_stages: string | null; // JSON text
  bedtime: string | null;
  wake_time: string | null;
};

export const ROW_KEYS: (keyof Row)[] = [
  "steps", "azm", "active_kcal", "floors", "distance_m", "workouts", "workout_minutes",
  "sleep_minutes", "deep_minutes", "rem_minutes", "light_minutes", "awake_minutes",
  "in_bed_minutes", "sleep_efficiency", "fall_asleep_minutes", "nap_minutes",
  "bed_clock_min", "wake_clock_min", "sleep_stages", "bedtime", "wake_time",
];

const emptyRow = (): Row => Object.fromEntries(ROW_KEYS.map((k) => [k, null])) as Row;

const num = (s: string | number | undefined | null) => (s == null || s === "" ? null : Number(s));

function byDate(points: DailyRollup[]) {
  return new Map(points.map((p) => [civilDate(p.civilStartTime), p]));
}

function stageMinutes(s: SleepSession, type: string): number | null {
  const stage = s.summary?.stagesSummary?.find((x) => x.type === type);
  return stage ? Number(stage.minutes ?? 0) : null;
}

/** Picks each night's main sleep: Google's `mainSleep` flag, else the longest non-nap. */
export function mainSleepByDate(sessions: SleepSession[]) {
  const out = new Map<string, SleepSession>();
  for (const s of sessions) {
    if (s.metadata?.nap) continue;
    const date = sessionEndDate(s.interval);
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

/** Minutes asleep in naps and any other non-main sessions, by end date. */
export function napMinutesByDate(sessions: SleepSession[], main: Map<string, SleepSession>) {
  const mainSet = new Set(main.values());
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (mainSet.has(s)) continue;
    const date = sessionEndDate(s.interval);
    out.set(date, (out.get(date) ?? 0) + Number(s.summary?.minutesAsleep ?? 0));
  }
  return out;
}

/** Local minutes after midnight for a UTC timestamp plus a google-duration offset ("-18000s"). */
export function localClockMinutes(timestamp: string, utcOffset?: string) {
  const offsetSeconds = utcOffset ? parseFloat(utcOffset) || 0 : 0;
  const d = new Date(Date.parse(timestamp) + offsetSeconds * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Bedtime as minutes after the previous noon, so late nights average correctly. */
export const toBedClock = (minAfterMidnight: number) => (minAfterMidnight + 720) % 1440;

/** Compact hypnogram: [startOffsetMin, durationMin, stage]. */
export function hypnogram(s: SleepSession): [number, number, string][] | null {
  if (!s.stages?.length) return null;
  const t0 = Date.parse(s.interval.startTime);
  return s.stages
    .map((st): [number, number, string] => [
      Math.round((Date.parse(st.startTime) - t0) / 60_000),
      Math.max(1, Math.round((Date.parse(st.endTime) - Date.parse(st.startTime)) / 60_000)),
      st.type,
    ])
    .sort((a, b) => a[0] - b[0]);
}

function durationMinutes(d: string | undefined, start: string, end: string) {
  if (d?.endsWith("s")) return Math.round(parseFloat(d) / 60);
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

export type WorkoutRow = {
  start_time: string;
  local_date: string;
  exercise_type: string | null;
  display_name: string | null;
  duration_min: number;
  kcal: number | null;
  distance_m: number | null;
  steps: number | null;
  avg_hr: number | null;
  azm: number | null;
};

export function mapWorkouts(exercise: ExerciseSession[]): WorkoutRow[] {
  const seen = new Set<string>();
  const out: WorkoutRow[] = [];
  for (const e of exercise) {
    if (seen.has(e.interval.startTime)) continue;
    seen.add(e.interval.startTime);
    const m = e.metricsSummary ?? {};
    const mm = num(m.distanceMillimeters);
    const kcal = num(m.caloriesKcal);
    const hr = num(m.averageHeartRateBeatsPerMinute);
    out.push({
      start_time: e.interval.startTime,
      local_date: sessionStartDate(e.interval),
      exercise_type: e.exerciseType ?? null,
      display_name: e.displayName ?? null,
      duration_min: durationMinutes(e.activeDuration, e.interval.startTime, e.interval.endTime),
      kcal: kcal == null ? null : Math.round(kcal),
      distance_m: mm == null || mm === 0 ? null : mm / 1000,
      steps: num(m.steps),
      avg_hr: hr == null || hr === 0 ? null : Math.round(hr),
      azm: num(m.activeZoneMinutes),
    });
  }
  return out;
}

export type SyncInput = {
  steps: DailyRollup[];
  distance: DailyRollup[];
  floors: DailyRollup[];
  energy: DailyRollup[];
  azm: DailyRollup[];
  sleep: SleepSession[];
  workouts: WorkoutRow[];
};

/** One row per date in [from, to]. */
export function mapDays(from: string, to: string, input: SyncInput) {
  const stepsBy = byDate(input.steps);
  const distBy = byDate(input.distance);
  const floorsBy = byDate(input.floors);
  const energyBy = byDate(input.energy);
  const azmBy = byDate(input.azm);
  const sleepBy = mainSleepByDate(input.sleep);
  const napsBy = napMinutesByDate(input.sleep, sleepBy);

  const workoutsBy = new Map<string, { count: number; minutes: number }>();
  for (const w of input.workouts) {
    const agg = workoutsBy.get(w.local_date) ?? { count: 0, minutes: 0 };
    agg.count += 1;
    agg.minutes += w.duration_min;
    workoutsBy.set(w.local_date, agg);
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
      ? Number(z.sumInFatBurnHeartZone ?? 0) + Number(z.sumInCardioHeartZone ?? 0) + Number(z.sumInPeakHeartZone ?? 0)
      : null;
    const w = workoutsBy.get(date);
    r.workouts = w?.count ?? (r.steps != null ? 0 : null);
    r.workout_minutes = w?.minutes ?? (r.steps != null ? 0 : null);
    r.nap_minutes = napsBy.get(date) ?? null;

    const s = sleepBy.get(date);
    if (s?.summary) {
      const asleep = Number(s.summary.minutesAsleep ?? 0);
      const inBed = Number(s.summary.minutesInSleepPeriod ?? 0);
      r.sleep_minutes = asleep;
      r.in_bed_minutes = inBed;
      r.deep_minutes = stageMinutes(s, "DEEP");
      r.rem_minutes = stageMinutes(s, "REM");
      r.light_minutes = stageMinutes(s, "LIGHT");
      r.awake_minutes = Number(s.summary.minutesAwake ?? 0);
      r.sleep_efficiency = inBed > 0 ? asleep / inBed : null;
      r.fall_asleep_minutes = num(s.summary.minutesToFallAsleep);
      r.bedtime = s.interval.startTime;
      r.wake_time = s.interval.endTime;
      r.bed_clock_min = toBedClock(localClockMinutes(s.interval.startTime, s.interval.startUtcOffset));
      r.wake_clock_min = localClockMinutes(s.interval.endTime, s.interval.endUtcOffset ?? s.interval.startUtcOffset);
      const h = hypnogram(s);
      r.sleep_stages = h ? JSON.stringify(h) : null;
    }
    return r;
  });
  return { dates, rows };
}
