// Shared (client + server) metric definitions and leaderboard math.

export type DayRow = {
  userId: string;
  date: string;
  steps: number | null;
  azm: number | null;
  activeKcal: number | null;
  floors: number | null;
  distanceM: number | null;
  workouts: number | null;
  workoutMinutes: number | null;
  sleepMinutes: number | null;
  deepMinutes: number | null;
  remMinutes: number | null;
  lightMinutes: number | null;
  inBedMinutes: number | null;
  sleepEfficiency: number | null;
  fallAsleepMinutes: number | null;
  napMinutes: number | null;
  /** Local bedtime as minutes after the previous noon (23:00 = 660, 01:00 = 780). */
  bedClockMin: number | null;
  /** Local wake time as minutes after midnight. */
  wakeClockMin: number | null;
  bedtime: string | null;
  wakeTime: string | null;
};

export type Category = "sleep" | "activity";
export type Period = "day" | "week" | "month";

export type MetricKey =
  | "sleepMinutes"
  | "deepMinutes"
  | "remMinutes"
  | "lightMinutes"
  | "efficiency"
  | "bedtime"
  | "consistency"
  | "steps"
  | "azm"
  | "workoutMinutes"
  | "activeKcal"
  | "distance"
  | "floors";

export type Metric = {
  key: MetricKey;
  category: Category;
  label: string;
  /**
   * How days combine over a period: "avg" for nightly sleep stats, "sum" for activity totals,
   * "spread" for the standard deviation (consistency), which needs several nights.
   */
  agg: "avg" | "sum" | "spread";
  /** Which direction wins. */
  better: "higher" | "lower";
  /** Periods this metric makes sense for (default: all). */
  periods?: Period[];
  value: (r: DayRow) => number | null;
  format: (v: number) => string;
  /** Short unit shown after the value in tight spaces. */
  unit: string;
  description: string;
};

export const formatDuration = (min: number) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};

/** Minutes after noon → "10:52 PM". */
export const formatBedClock = (minAfterNoon: number) => {
  const total = (Math.round(minAfterNoon) + 720) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h = h24 % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
};

/** Minutes after midnight → "6:45 AM". */
export const formatClock = (minAfterMidnight: number) => formatBedClock(minAfterMidnight - 720);

const int = (v: number) => Math.round(v).toLocaleString("en-US");
const METERS_PER_MILE = 1609.344;
export const MIN_SPREAD_NIGHTS = 3;

export const METRICS: Metric[] = [
  {
    key: "sleepMinutes",
    category: "sleep",
    label: "Time Asleep",
    agg: "avg",
    better: "higher",
    value: (r) => r.sleepMinutes,
    format: formatDuration,
    unit: "",
    description: "Minutes actually asleep in your main sleep, not counting time awake in bed.",
  },
  {
    key: "deepMinutes",
    category: "sleep",
    label: "Deep",
    agg: "avg",
    better: "higher",
    value: (r) => r.deepMinutes,
    format: formatDuration,
    unit: "",
    description: "Time in deep sleep, as tracked by Google Health. Nights without stage tracking don't count.",
  },
  {
    key: "remMinutes",
    category: "sleep",
    label: "REM",
    agg: "avg",
    better: "higher",
    value: (r) => r.remMinutes,
    format: formatDuration,
    unit: "",
    description: "Time in REM sleep, as tracked by Google Health. Nights without stage tracking don't count.",
  },
  {
    key: "lightMinutes",
    category: "sleep",
    label: "Light",
    agg: "avg",
    better: "higher",
    value: (r) => r.lightMinutes,
    format: formatDuration,
    unit: "",
    description: "Time in light sleep, as tracked by Google Health. Nights without stage tracking don't count.",
  },
  {
    key: "efficiency",
    category: "sleep",
    label: "Efficiency",
    agg: "avg",
    better: "higher",
    value: (r) => (r.sleepEfficiency == null ? null : r.sleepEfficiency * 100),
    format: (v) => `${Math.round(v)}%`,
    unit: "",
    description: "Share of your time in bed spent asleep. Tossing and turning brings it down.",
  },
  {
    key: "bedtime",
    category: "sleep",
    label: "Bedtime",
    agg: "avg",
    better: "lower",
    value: (r) => r.bedClockMin,
    format: formatBedClock,
    unit: "",
    description: "When your main sleep started, in your local time. Earliest to bed wins.",
  },
  {
    key: "consistency",
    category: "sleep",
    label: "Consistency",
    agg: "spread",
    better: "lower",
    periods: ["week", "month"],
    value: (r) => r.bedClockMin,
    format: (v) => `±${formatDuration(v)}`,
    unit: "",
    description: `How much your bedtime varies night to night. Smallest spread wins; needs ${MIN_SPREAD_NIGHTS} nights.`,
  },
  {
    key: "steps",
    category: "activity",
    label: "Steps",
    agg: "sum",
    better: "higher",
    value: (r) => r.steps,
    format: int,
    unit: "steps",
    description: "Total steps.",
  },
  {
    key: "azm",
    category: "activity",
    label: "Zone Minutes",
    agg: "sum",
    better: "higher",
    value: (r) => r.azm,
    format: int,
    unit: "min",
    description: "Active Zone Minutes. Cardio and peak minutes count double.",
  },
  {
    key: "workoutMinutes",
    category: "activity",
    label: "Workouts",
    agg: "sum",
    better: "higher",
    value: (r) => r.workoutMinutes,
    format: formatDuration,
    unit: "",
    description: "Total time in logged or auto-detected exercise sessions.",
  },
  {
    key: "activeKcal",
    category: "activity",
    label: "Active Calories",
    agg: "sum",
    better: "higher",
    value: (r) => r.activeKcal,
    format: int,
    unit: "Cal",
    description: "Calories burned from activity, excluding your resting burn.",
  },
  {
    key: "distance",
    category: "activity",
    label: "Distance",
    agg: "sum",
    better: "higher",
    value: (r) => (r.distanceM == null ? null : r.distanceM / METERS_PER_MILE),
    format: (v) => v.toFixed(v < 10 ? 2 : 1),
    unit: "mi",
    description: "Distance covered on foot and in workouts.",
  },
  {
    key: "floors",
    category: "activity",
    label: "Floors",
    agg: "sum",
    better: "higher",
    value: (r) => r.floors,
    format: int,
    unit: "floors",
    description: "Floors climbed.",
  },
];

export const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<
  MetricKey,
  Metric
>;

export const metricsFor = (category: Category, period: Period) =>
  METRICS.filter((m) => m.category === category && (!m.periods || m.periods.includes(period)));

export type Standing = {
  userId: string;
  value: number | null;
  days: number;
  workouts?: number;
  rank: number | null;
};

function spread(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

/**
 * Ranks members over [from, to]. Members with no data (or fewer than `minDays` days with data)
 * sit at the bottom, unranked.
 */
export function standings(
  rows: DayRow[],
  memberIds: string[],
  metric: Metric,
  from: string,
  to: string,
  minDays = metric.agg === "spread" ? MIN_SPREAD_NIGHTS : 1,
): Standing[] {
  const acc = new Map<string, { values: number[]; workouts: number }>();
  for (const id of memberIds) acc.set(id, { values: [], workouts: 0 });
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const a = acc.get(r.userId);
    const v = metric.value(r);
    if (!a || v == null) continue;
    a.values.push(v);
    a.workouts += r.workouts ?? 0;
  }
  const list: Standing[] = memberIds.map((id) => {
    const { values, workouts } = acc.get(id)!;
    const days = values.length;
    let value: number | null = null;
    if (days >= Math.max(1, minDays)) {
      const sum = values.reduce((a, b) => a + b, 0);
      value = metric.agg === "sum" ? sum : metric.agg === "avg" ? sum / days : spread(values);
    }
    return { userId: id, value, days, workouts, rank: null };
  });
  const dir = metric.better === "higher" ? -1 : 1;
  list.sort((x, y) => {
    if (x.value == null || y.value == null) return x.value == null ? (y.value == null ? 0 : 1) : -1;
    return dir * (x.value - y.value);
  });
  let rank = 0;
  let prev: number | null = null;
  list.forEach((s, i) => {
    if (s.value == null) return;
    // Ties share a rank (compare on the displayed precision).
    const shown = Math.round(s.value * 100);
    if (shown !== prev) rank = i + 1;
    prev = shown;
    s.rank = rank;
  });
  return list;
}

/** Bar length 0..1 relative to the best value, for either direction. */
export function barFraction(metric: Metric, value: number | null, list: Standing[]) {
  if (value == null) return 0;
  const vals = list.map((s) => s.value).filter((v): v is number => v != null);
  if (!vals.length) return 0;
  if (metric.better === "higher") {
    const max = Math.max(...vals);
    return max > 0 ? Math.max(0.02, value / max) : 0;
  }
  // Lower is better: proportional to the best (smallest) value, so close calls look close.
  const min = Math.min(...vals);
  if (value <= 0) return 1;
  return Math.max(0.02, min / value);
}

/** The gap between two values in the metric's own units, always positive when `a` is ahead. */
export function lead(metric: Metric, a: number, b: number) {
  return metric.better === "higher" ? a - b : b - a;
}

export type HeadToHead = { aWins: number; bWins: number; ties: number };

/** Day-by-day record between two people over [from, to] on a per-day metric. */
export function headToHead(
  rows: DayRow[],
  a: string,
  b: string,
  metric: Metric,
  from: string,
  to: string,
): HeadToHead {
  const out: HeadToHead = { aWins: 0, bWins: 0, ties: 0 };
  if (metric.agg === "spread") return out;
  const byDate = new Map<string, { a?: number; b?: number }>();
  for (const r of rows) {
    if (r.date < from || r.date > to || (r.userId !== a && r.userId !== b)) continue;
    const v = metric.value(r);
    if (v == null) continue;
    const d = byDate.get(r.date) ?? {};
    if (r.userId === a) d.a = v;
    else d.b = v;
    byDate.set(r.date, d);
  }
  for (const { a: va, b: vb } of byDate.values()) {
    if (va == null || vb == null) continue;
    const diff = Math.round(lead(metric, va, vb) * 100);
    if (diff > 0) out.aWins++;
    else if (diff < 0) out.bWins++;
    else out.ties++;
  }
  return out;
}

/** Rank movement vs the previous period: positive means moved up. */
export function rankChanges(current: Standing[], previous: Standing[]) {
  const prev = new Map(previous.map((s) => [s.userId, s.rank]));
  return new Map(
    current.map((s) => {
      const p = prev.get(s.userId);
      return [s.userId, s.rank != null && p != null ? p - s.rank : 0];
    }),
  );
}

export const ordinal = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
