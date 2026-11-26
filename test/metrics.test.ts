import { describe, expect, it } from "vitest";
import { barFraction, formatBedClock, formatClock, headToHead, metricByKey, rankChanges, standings } from "@/lib/metrics";
import { day } from "./helpers";

const W = { from: "2026-11-16", to: "2026-11-22" };

describe("standings", () => {
  it("ranks higher-is-better sums with shared ranks for ties", () => {
    const rows = [
      day("a", "2026-11-16", { steps: 5000 }),
      day("a", "2026-11-17", { steps: 5000 }),
      day("b", "2026-11-16", { steps: 10000 }),
      day("c", "2026-11-16", { steps: 12000 }),
    ];
    const s = standings(rows, ["a", "b", "c", "d"], metricByKey.steps, W.from, W.to);
    expect(s.map((x) => [x.userId, x.value, x.rank])).toEqual([
      ["c", 12000, 1],
      ["a", 10000, 2],
      ["b", 10000, 2],
      ["d", null, null],
    ]);
  });

  it("ranks lower-is-better (bedtime) with the earliest first", () => {
    const rows = [
      day("late", "2026-11-16", { bedClockMin: 780 }), // 1:00 AM
      day("early", "2026-11-16", { bedClockMin: 600 }), // 10:00 PM
    ];
    const s = standings(rows, ["late", "early"], metricByKey.bedtime, W.from, W.to);
    expect(s.map((x) => x.userId)).toEqual(["early", "late"]);
    expect(s[0].rank).toBe(1);
  });

  it("needs 3 nights for consistency and ranks the smallest spread first", () => {
    const rows = [
      ...[600, 610, 620].map((v, i) => day("steady", `2026-11-1${6 + i}`, { bedClockMin: v })),
      ...[540, 700, 780].map((v, i) => day("wild", `2026-11-1${6 + i}`, { bedClockMin: v })),
      ...[600, 600].map((v, i) => day("short", `2026-11-1${6 + i}`, { bedClockMin: v })),
    ];
    const s = standings(rows, ["wild", "steady", "short"], metricByKey.consistency, W.from, W.to);
    expect(s[0].userId).toBe("steady");
    expect(s[0].value).toBeCloseTo(8.16, 1);
    expect(s.find((x) => x.userId === "short")!.rank).toBeNull();
  });

  it("respects a custom minDays", () => {
    const rows = [day("a", "2026-11-16", { sleepMinutes: 600 }), day("b", "2026-11-16", { sleepMinutes: 400 }), day("b", "2026-11-17", { sleepMinutes: 400 })];
    const s = standings(rows, ["a", "b"], metricByKey.sleepMinutes, W.from, W.to, 2);
    expect(s[0]).toMatchObject({ userId: "b", rank: 1 });
    expect(s[1]).toMatchObject({ userId: "a", rank: null, days: 1 });
  });
});

describe("headToHead", () => {
  it("counts days won, lost and tied, skipping days only one person tracked", () => {
    const rows = [
      day("me", "2026-11-16", { sleepMinutes: 480 }),
      day("you", "2026-11-16", { sleepMinutes: 420 }),
      day("me", "2026-11-17", { sleepMinutes: 400 }),
      day("you", "2026-11-17", { sleepMinutes: 450 }),
      day("me", "2026-11-18", { sleepMinutes: 450 }),
      day("you", "2026-11-18", { sleepMinutes: 450 }),
      day("me", "2026-11-19", { sleepMinutes: 500 }),
    ];
    expect(headToHead(rows, "me", "you", metricByKey.sleepMinutes, W.from, W.to)).toEqual({ aWins: 1, bWins: 1, ties: 1 });
  });

  it("uses the metric's direction", () => {
    const rows = [day("me", "2026-11-16", { bedClockMin: 600 }), day("you", "2026-11-16", { bedClockMin: 700 })];
    expect(headToHead(rows, "me", "you", metricByKey.bedtime, W.from, W.to).aWins).toBe(1);
  });
});

describe("helpers", () => {
  it("gives the best value a full bar in either direction", () => {
    const list = standings(
      [day("a", "2026-11-16", { bedClockMin: 600 }), day("b", "2026-11-16", { bedClockMin: 720 })],
      ["a", "b"],
      metricByKey.bedtime,
      W.from,
      W.to,
    );
    expect(barFraction(metricByKey.bedtime, 600, list)).toBe(1);
    expect(barFraction(metricByKey.bedtime, 720, list)).toBeCloseTo(600 / 720);
  });

  it("reports rank movement", () => {
    const now = [{ userId: "a", value: 1, days: 1, rank: 1 }, { userId: "b", value: 0, days: 1, rank: 2 }];
    const before = [{ userId: "a", value: 0, days: 1, rank: 2 }, { userId: "b", value: 1, days: 1, rank: 1 }];
    expect([...rankChanges(now, before)]).toEqual([["a", 1], ["b", -1]]);
  });

  it("formats clock times", () => {
    expect(formatBedClock(660)).toBe("11:00 PM");
    expect(formatBedClock(780)).toBe("1:00 AM");
    expect(formatBedClock(0)).toBe("12:00 PM");
    expect(formatClock(405)).toBe("6:45 AM");
  });
});
