// Rested Sleep Score (0–100). Shown in the app under "How scores work".
//   Duration    50 pts  — time asleep vs. an 8h target (full marks at 8h+)
//   Restoration 25 pts  — deep + REM share of sleep, full marks at 40%+
//   Efficiency  25 pts  — asleep ÷ time in bed, 75% → 0 pts, 95%+ → full marks
// Nights without stage data (classic sleep) get a neutral 12.5 for restoration.

export const SLEEP_TARGET_MINUTES = 480;
const RESTORATIVE_TARGET = 0.4;
const EFFICIENCY_FLOOR = 0.75;
const EFFICIENCY_CEIL = 0.95;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function sleepScore(input: {
  asleep: number;
  inBed: number;
  deep: number | null;
  rem: number | null;
}): number {
  const { asleep, inBed, deep, rem } = input;
  if (asleep <= 0) return 0;
  const duration = clamp01(asleep / SLEEP_TARGET_MINUTES) * 50;
  const restoration =
    deep == null || rem == null ? 12.5 : clamp01((deep + rem) / asleep / RESTORATIVE_TARGET) * 25;
  const efficiency = inBed > 0 ? asleep / inBed : 1;
  const effPts = clamp01((efficiency - EFFICIENCY_FLOOR) / (EFFICIENCY_CEIL - EFFICIENCY_FLOOR)) * 25;
  return Math.round(duration + restoration + effPts);
}
