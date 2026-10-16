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
  /** "avg" for nightly sleep stats, "sum" for activity totals. */
  agg: "avg" | "sum";
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
const int = (v: number) => Math.round(v).toLocaleString("en-US");
const METERS_PER_MILE = 1609.344;

export const METRICS: Metric[] = [
  {
    key: "sleepMinutes",
    category: "sleep",
    label: "Time Asleep",
    agg: "avg",
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
    value: (r) => r.lightMinutes,
    format: formatDuration,
    unit: "",
    description: "Time in light sleep, as tracked by Google Health. Nights without stage tracking don't count.",
  },
  {
    key: "steps",
    category: "activity",
    label: "Steps",
    agg: "sum",
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

export type Standing = {
  userId: string;
  value: number | null;
  days: number;
  workouts?: number;
  rank: number | null;
};

/** Ranks members over [from, to]. Members with no data sit at the bottom, unranked. */
export function standings(
  rows: DayRow[],
  memberIds: string[],
  metric: Metric,
  from: string,
  to: string,
): Standing[] {
  const acc = new Map<string, { sum: number; days: number; workouts: number }>();
  for (const id of memberIds) acc.set(id, { sum: 0, days: 0, workouts: 0 });
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const a = acc.get(r.userId);
    const v = metric.value(r);
    if (!a || v == null) continue;
    a.sum += v;
    a.days += 1;
    a.workouts += r.workouts ?? 0;
  }
  const list: Standing[] = memberIds.map((id) => {
    const a = acc.get(id)!;
    const value = a.days === 0 ? null : metric.agg === "avg" ? a.sum / a.days : a.sum;
    return { userId: id, value, days: a.days, workouts: a.workouts, rank: null };
  });
  list.sort((x, y) => (y.value ?? -Infinity) - (x.value ?? -Infinity));
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
