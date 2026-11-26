// Period ranges and labels shared by the leaderboard, profiles and the weekly recap.
import { addDays, addMonths, startOfMonth, startOfWeek } from "./dates";
import type { Category, Period } from "./metrics";

export const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** The period `offset` steps before the current one (0 = current). */
export function periodRange(period: Period, today: string, offset: number) {
  if (period === "day") {
    const d = addDays(today, -offset);
    return { from: d, to: d };
  }
  if (period === "week") {
    const from = addDays(startOfWeek(today), -7 * offset);
    return { from, to: addDays(from, 6) };
  }
  const from = addMonths(startOfMonth(today), -offset);
  return { from, to: addDays(addMonths(from, 1), -1) };
}

export function periodLabel(period: Period, category: Category, offset: number, from: string, to: string) {
  if (period === "day") {
    if (category === "sleep") {
      if (offset === 0) return { title: "Last Night", sub: fmtDay(from, { weekday: "long", month: "short", day: "numeric" }) };
      return { title: `Night of ${fmtDay(addDays(from, -1), { weekday: "short" })}`, sub: `Woke up ${fmtDay(from, { month: "short", day: "numeric" })}` };
    }
    const title = offset === 0 ? "Today" : offset === 1 ? "Yesterday" : fmtDay(from, { weekday: "long" });
    return { title, sub: fmtDay(from, { month: "long", day: "numeric" }) };
  }
  if (period === "week") {
    const title = offset === 0 ? "This Week" : offset === 1 ? "Last Week" : `Week of ${fmtDay(from, { month: "short", day: "numeric" })}`;
    return { title, sub: weekSpan(from, to) };
  }
  return {
    title: offset === 0 ? "This Month" : fmtDay(from, { month: "long" }),
    sub: fmtDay(from, { month: "long", year: "numeric" }),
  };
}

export const weekSpan = (from: string, to: string) =>
  `${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(to, { month: "short", day: "numeric" })}`;

/** "Mon, Nov 24" style label for a night (by wake date). */
export const nightLabel = (wakeDate: string) =>
  `${fmtDay(addDays(wakeDate, -1), { weekday: "short" })} night`;
