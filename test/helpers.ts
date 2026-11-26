import type { DayRow } from "@/lib/metrics";

export function day(userId: string, date: string, v: Partial<DayRow> = {}): DayRow {
  return {
    userId, date, steps: null, azm: null, activeKcal: null, floors: null, distanceM: null,
    workouts: null, workoutMinutes: null, sleepMinutes: null, deepMinutes: null, remMinutes: null,
    lightMinutes: null, inBedMinutes: null, sleepEfficiency: null, fallAsleepMinutes: null,
    napMinutes: null, bedClockMin: null, wakeClockMin: null, bedtime: null, wakeTime: null,
    ...v,
  };
}
