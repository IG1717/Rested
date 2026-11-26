// Weekly winners and overtake detection. Pure functions, shared by server and client.
import { addDays } from "./dates";
import { METRICS, standings, type DayRow, type Metric } from "./metrics";

/** Nights needed to win a sleep average for the week, so one lucky night can't take it. */
export const MIN_SLEEP_NIGHTS = 4;

export type Award = {
  metric: Metric;
  /** Everyone tied for first. Empty when nobody qualified. */
  winners: string[];
  value: number | null;
  /** Full standings for the podium. */
  standings: ReturnType<typeof standings>;
};

export function weeklyAwards(rows: DayRow[], memberIds: string[], weekStart: string): Award[] {
  const to = addDays(weekStart, 6);
  return METRICS.filter((m) => !m.periods || m.periods.includes("week")).map((metric) => {
    const minDays =
      metric.agg === "avg" && metric.category === "sleep" ? MIN_SLEEP_NIGHTS : metric.agg === "spread" ? MIN_SLEEP_NIGHTS : 1;
    const list = standings(rows, memberIds, metric, weekStart, to, minDays);
    const winners = list.filter((s) => s.rank === 1).map((s) => s.userId);
    return { metric, winners, value: list[0]?.value ?? null, standings: list };
  });
}

/** Headline winners: the two flagship metrics, then how many the viewer won overall. */
export function awardSummary(awards: Award[], viewerId: string) {
  const won = awards.filter((a) => a.winners.includes(viewerId)).length;
  const sleep = awards.find((a) => a.metric.key === "sleepMinutes");
  const steps = awards.find((a) => a.metric.key === "steps");
  return { won, total: awards.filter((a) => a.winners.length).length, sleep, steps };
}

/**
 * Friends that `mover` just overtook: they were ahead of (or level with) the mover's old value
 * and are now behind the new value. Friends without a value are never "passed".
 */
export function overtaken(
  oldValue: number | null,
  newValue: number | null,
  friends: { id: string; value: number | null }[],
  better: "higher" | "lower" = "higher",
): string[] {
  if (newValue == null) return [];
  const ahead = (a: number, b: number) => (better === "higher" ? a > b : a < b);
  return friends
    .filter((f) => f.value != null && ahead(newValue, f.value) && (oldValue == null || !ahead(oldValue, f.value)))
    .map((f) => f.id);
}
