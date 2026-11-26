import { describe, expect, it } from "vitest";
import { hypnogram, localClockMinutes, mapDays, mapWorkouts, toBedClock } from "@/lib/sync-map";
import type { DailyRollup, ExerciseSession, SleepSession } from "@/lib/health";

const EST = "-18000s";
const civil = (d: string) => {
  const [year, month, day] = d.split("-").map(Number);
  return { date: { year, month, day } };
};

// Bed at 11:10 PM Nov 24 local, up at 6:40 AM Nov 25 local (UTC-5).
const mainSleep: SleepSession = {
  interval: { startTime: "2026-11-25T04:10:00Z", endTime: "2026-11-25T11:40:00Z", startUtcOffset: EST, endUtcOffset: EST },
  type: "STAGES",
  metadata: { mainSleep: true },
  stages: [
    { startTime: "2026-11-25T04:10:00Z", endTime: "2026-11-25T04:18:00Z", type: "AWAKE" },
    { startTime: "2026-11-25T04:18:00Z", endTime: "2026-11-25T05:30:00Z", type: "LIGHT" },
    { startTime: "2026-11-25T05:30:00Z", endTime: "2026-11-25T06:40:00Z", type: "DEEP" },
    { startTime: "2026-11-25T06:40:00Z", endTime: "2026-11-25T08:10:00Z", type: "REM" },
  ],
  summary: {
    minutesAsleep: "420",
    minutesInSleepPeriod: "450",
    minutesAwake: "30",
    minutesToFallAsleep: "8",
    stagesSummary: [
      { type: "DEEP", minutes: "70" },
      { type: "REM", minutes: "90" },
      { type: "LIGHT", minutes: "260" },
      { type: "AWAKE", minutes: "30" },
    ],
  },
};

const nap: SleepSession = {
  interval: { startTime: "2026-11-25T19:00:00Z", endTime: "2026-11-25T19:40:00Z", startUtcOffset: EST, endUtcOffset: EST },
  metadata: { nap: true },
  summary: { minutesAsleep: "35", minutesInSleepPeriod: "40" },
};

const run: ExerciseSession = {
  interval: { startTime: "2026-11-25T22:00:00Z", endTime: "2026-11-25T22:35:00Z", startUtcOffset: EST },
  exerciseType: "RUNNING",
  displayName: "Run",
  activeDuration: "1800s",
  metricsSummary: {
    caloriesKcal: 310.4,
    distanceMillimeters: "5000000",
    steps: "4800",
    averageHeartRateBeatsPerMinute: 152,
    activeZoneMinutes: "28",
  },
};

// 10:30 PM local on Nov 25, which is already Nov 26 in UTC.
const lateLift: ExerciseSession = {
  interval: { startTime: "2026-11-26T03:30:00Z", endTime: "2026-11-26T04:15:00Z", startUtcOffset: EST },
  exerciseType: "WEIGHTS",
  displayName: "Weights",
};

const rollup = (date: string, v: Partial<DailyRollup>): DailyRollup => ({ civilStartTime: civil(date), ...v });

describe("clock helpers", () => {
  it("converts UTC + offset into local minutes", () => {
    expect(localClockMinutes("2026-11-25T04:10:00Z", EST)).toBe(23 * 60 + 10);
    expect(toBedClock(23 * 60 + 10)).toBe(670); // minutes after noon
    expect(toBedClock(60)).toBe(780); // 1 AM
  });

  it("builds a hypnogram relative to sleep start", () => {
    expect(hypnogram(mainSleep)).toEqual([
      [0, 8, "AWAKE"],
      [8, 72, "LIGHT"],
      [80, 70, "DEEP"],
      [150, 90, "REM"],
    ]);
    expect(hypnogram(nap)).toBeNull();
  });
});

describe("mapWorkouts", () => {
  it("maps metrics and uses the local start date", () => {
    const [r, w] = mapWorkouts([run, lateLift, run]);
    expect(r).toMatchObject({
      local_date: "2026-11-25",
      exercise_type: "RUNNING",
      duration_min: 30,
      kcal: 310,
      distance_m: 5000,
      steps: 4800,
      avg_hr: 152,
      azm: 28,
    });
    expect(w).toMatchObject({ local_date: "2026-11-25", duration_min: 45, kcal: null, distance_m: null });
  });

  it("drops duplicate sessions", () => {
    expect(mapWorkouts([run, run])).toHaveLength(1);
  });
});

describe("mapDays", () => {
  const { dates, rows } = mapDays("2026-11-24", "2026-11-25", {
    steps: [rollup("2026-11-25", { steps: { countSum: "11234" } })],
    distance: [rollup("2026-11-25", { distance: { millimetersSum: "8046720" } })],
    floors: [],
    energy: [rollup("2026-11-25", { activeEnergyBurned: { kcalSum: 512.6 } })],
    azm: [rollup("2026-11-25", { activeZoneMinutes: { sumInFatBurnHeartZone: "10", sumInCardioHeartZone: "20", sumInPeakHeartZone: "4" } })],
    sleep: [mainSleep, nap],
    workouts: mapWorkouts([run, lateLift]),
  });
  const nov25 = rows[dates.indexOf("2026-11-25")];
  const nov24 = rows[dates.indexOf("2026-11-24")];

  it("attributes the night to the wake date with all sleep fields", () => {
    expect(nov25).toMatchObject({
      sleep_minutes: 420,
      in_bed_minutes: 450,
      deep_minutes: 70,
      rem_minutes: 90,
      light_minutes: 260,
      fall_asleep_minutes: 8,
      nap_minutes: 35,
      bed_clock_min: 670,
      wake_clock_min: 6 * 60 + 40,
    });
    expect(nov25.sleep_efficiency).toBeCloseTo(420 / 450);
    expect(JSON.parse(nov25.sleep_stages!)).toHaveLength(4);
  });

  it("totals activity and workouts", () => {
    expect(nov25).toMatchObject({ steps: 11234, distance_m: 8046.72, active_kcal: 513, azm: 34, workouts: 2, workout_minutes: 75 });
  });

  it("leaves untracked days empty rather than zero", () => {
    expect(nov24.steps).toBeNull();
    expect(nov24.sleep_minutes).toBeNull();
    expect(nov24.workouts).toBeNull();
  });
});
