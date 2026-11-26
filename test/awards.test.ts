import { describe, expect, it } from "vitest";
import { MIN_SLEEP_NIGHTS, overtaken, weeklyAwards } from "@/lib/awards";
import { day } from "./helpers";

const MON = "2026-11-16";
const nights = (user: string, minutes: number, n: number) =>
  Array.from({ length: n }, (_, i) => day(user, `2026-11-${16 + i}`, { sleepMinutes: minutes, steps: 1000 }));

describe("weeklyAwards", () => {
  it(`needs ${MIN_SLEEP_NIGHTS} nights to win a sleep average`, () => {
    const rows = [...nights("lucky", 600, 1), ...nights("steady", 450, 5)];
    const sleep = weeklyAwards(rows, ["lucky", "steady"], MON).find((a) => a.metric.key === "sleepMinutes")!;
    expect(sleep.winners).toEqual(["steady"]);
  });

  it("shares a win on a tie and ignores days outside the week", () => {
    const rows = [
      ...nights("a", 400, 4),
      ...nights("b", 400, 4),
      day("a", "2026-11-23", { steps: 99999 }), // next Monday
    ];
    const awards = weeklyAwards(rows, ["a", "b"], MON);
    expect(awards.find((x) => x.metric.key === "sleepMinutes")!.winners.sort()).toEqual(["a", "b"]);
    expect(awards.find((x) => x.metric.key === "steps")!.winners.sort()).toEqual(["a", "b"]);
  });
});

describe("overtaken", () => {
  const friends = [
    { id: "ahead", value: 9000 },
    { id: "behind", value: 3000 },
    { id: "between", value: 6000 },
    { id: "none", value: null },
  ];

  it("returns friends the mover just passed", () => {
    expect(overtaken(5000, 7000, friends)).toEqual(["between"]);
  });

  it("does not re-notify people already behind, or people with no data", () => {
    expect(overtaken(7000, 8000, friends)).toEqual([]);
  });

  it("treats a first value of the day as passing everyone below it", () => {
    expect(overtaken(null, 7000, friends)).toEqual(["behind", "between"]);
  });

  it("counts a tie as not passed yet", () => {
    expect(overtaken(6000, 6000, friends)).toEqual([]);
  });
});
