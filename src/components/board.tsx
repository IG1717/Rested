"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./avatar";
import { StepLeft, StepRight } from "./icons";
import { Segmented } from "./segmented";
import { TrendChart } from "./trend-chart";
import {
  formatDuration,
  METRICS,
  metricByKey,
  standings,
  type Category,
  type DayRow,
  type MetricKey,
  type Period,
} from "@/lib/metrics";
import { addDays, addMonths, startOfMonth, startOfWeek } from "@/lib/dates";

export type BoardMember = { id: string; name: string; avatarUrl: string | null; slot: number };

const DEFAULT_METRIC: Record<Category, MetricKey> = { sleep: "sleepMinutes", activity: "steps" };
const ACCENT: Record<Category, { text: string; fill: string }> = {
  sleep: { text: "var(--sleep)", fill: "var(--sleep)" },
  activity: { text: "var(--activity)", fill: "var(--activity-fill)" },
};

type Prefs = { category: Category; metric: Record<Category, MetricKey>; period: Period };

const PREFS_KEY = "rested:board";

function loadPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : null;
  } catch {
    return null;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

function periodRange(period: Period, today: string, offset: number) {
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

function periodLabel(period: Period, category: Category, offset: number, from: string, to: string) {
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
    return { title, sub: `${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(to, { month: "short", day: "numeric" })}` };
  }
  return {
    title: offset === 0 ? "This Month" : fmtDay(from, { month: "long" }),
    sub: fmtDay(from, { month: "long", year: "numeric" }),
  };
}

export function Board({
  members,
  rows,
  viewerId,
  today,
  earliest,
}: {
  members: BoardMember[];
  rows: DayRow[];
  viewerId: string;
  today: string;
  earliest: string;
}) {
  const [prefs, setPrefs] = useState<Prefs>({
    category: "sleep",
    metric: DEFAULT_METRIC,
    period: "day",
  });
  const [offset, setOffset] = useState(0);

  // Restore the last view after hydration.
  useEffect(() => {
    const saved = loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setPrefs({ ...saved, metric: { ...DEFAULT_METRIC, ...saved.metric } });
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const { category, period } = prefs;
  const metric = metricByKey[prefs.metric[category]] ?? metricByKey[DEFAULT_METRIC[category]];
  const accent = ACCENT[category];
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const { from, to } = periodRange(period, today, offset);
  const canGoBack = periodRange(period, today, offset + 1).to >= earliest;
  const label = periodLabel(period, category, offset, from, to);
  const list = standings(rows, memberIds, metric, from, to);
  const stages = metric.key === "sleepMinutes" ? stageAverages(rows, from, to) : null;
  const leader = list[0]?.value ?? 0;
  const me = list.find((s) => s.userId === viewerId);
  const ranked = list.filter((s) => s.rank != null);

  const chartSelection = useMemo(() => {
    const top = ranked.slice(0, 3).map((s) => s.userId);
    return Array.from(new Set([viewerId, ...top])).slice(0, 3);
    // Seed once per metric; the chart keeps the viewer's own picks after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.key, viewerId]);

  const unit = metric.unit ? <span className="score-unit">{metric.unit}</span> : null;

  return (
    <div style={{ "--accent": accent.text, "--accent-fill": accent.fill } as React.CSSProperties}>
      <div className="content stack-12">
        <Segmented
          large
          label="Category"
          value={category}
          onChange={(c) => {
            update({ category: c });
            setOffset(0);
          }}
          options={[
            { value: "sleep", label: "Sleep" },
            { value: "activity", label: "Activity" },
          ]}
        />
        <div className="chips" role="group" aria-label="Metric">
          {METRICS.filter((m) => m.category === category).map((m) => (
            <button
              key={m.key}
              type="button"
              className="chip"
              aria-pressed={m.key === metric.key}
              onClick={() => update({ metric: { ...prefs.metric, [category]: m.key } })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Segmented
          label="Period"
          value={period}
          onChange={(p) => {
            update({ period: p });
            setOffset(0);
          }}
          options={[
            { value: "day", label: category === "sleep" ? "Night" : "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
        <div className="stepper">
          <button
            type="button"
            className="round-btn"
            aria-label="Previous period"
            disabled={!canGoBack}
            onClick={() => setOffset((o) => o + 1)}
          >
            <StepLeft />
          </button>
          <div className="stepper-label" aria-live="polite">
            {label.title}
            <span className="sub">{label.sub}</span>
          </div>
          <button
            type="button"
            className="round-btn"
            aria-label="Next period"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
          >
            <StepRight />
          </button>
        </div>
      </div>

      {me && (
        <div className="content mt-16">
          <Headline me={me} list={list} byId={byId} format={metric.format} unitText={metric.unit} />
        </div>
      )}

      <section className="section content">
        {/* Rows are keyed by member, so switching metric animates each bar from where it was. */}
        <div className="list board">
          {list.map((s) => {
            const m = byId.get(s.userId)!;
            const isMe = s.userId === viewerId;
            const pct = s.value != null && leader > 0 ? Math.max(0.02, s.value / leader) : 0;
            const split = stages?.get(s.userId);
            const sub =
              s.value == null
                ? "No data yet"
                : split
                  ? (
                      <>
                        <span className="nowrap">Deep {formatDuration(split.deep)}</span> ·{" "}
                        <span className="nowrap">REM {formatDuration(split.rem)}</span>
                      </>
                    )
                  : metric.key === "workoutMinutes"
                  ? `${s.workouts} workout${s.workouts === 1 ? "" : "s"}`
                  : metric.agg === "avg" && period !== "day"
                    ? `Avg of ${s.days} night${s.days === 1 ? "" : "s"}`
                    : metric.agg === "sum" && period !== "day" && s.days > 0
                      ? `${metric.format((s.value ?? 0) / s.days)} ${metric.unit} / day`.trim()
                      : null;
            return (
              <div key={s.userId} className={`row${isMe ? " highlight" : ""}`}>
                <span className={`rank tnum${s.rank && s.rank <= 3 ? ` r${s.rank}` : ""}`}>
                  {s.rank ?? "–"}
                </span>
                <Avatar name={m.name} url={m.avatarUrl} slot={m.slot} />
                <div className="row-main">
                  <div className="row-title">
                    {m.name.split(" ")[0]}
                    {isMe && <span className="you-pill">You</span>}
                  </div>
                  {sub && <div className="row-sub">{sub}</div>}
                  <div className="bar-track" aria-hidden>
                    {split ? (
                      // Stage split: segment widths are minutes relative to the leader's total.
                      <div className="bar-stack" style={{ width: `${pct * 100}%` }}>
                        <span className="stage-deep" style={{ flexGrow: split.deep }} />
                        <span className="stage-rem" style={{ flexGrow: split.rem }} />
                        <span className="stage-light" style={{ flexGrow: split.light }} />
                      </div>
                    ) : (
                      <div className="bar-fill" style={{ transform: `scaleX(${pct})` }} />
                    )}
                  </div>
                </div>
                <div className="score">
                  {s.value == null ? (
                    <span className="score-empty">—</span>
                  ) : (
                    <>
                      <span className="score-value">{metric.format(s.value)}</span>
                      {unit}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="section-footer">{metric.description}</p>
      </section>

      <section className="section content">
        <TrendChart
          key={metric.key}
          metric={metric}
          rows={rows}
          members={members}
          today={today}
          initialSelected={chartSelection}
          viewerId={viewerId}
        />
      </section>
    </div>
  );
}

/** Average minutes per stage over nights with stage data, per member. */
function stageAverages(rows: DayRow[], from: string, to: string) {
  const acc = new Map<string, { deep: number; rem: number; light: number; n: number }>();
  for (const r of rows) {
    if (r.date < from || r.date > to || r.deepMinutes == null || r.remMinutes == null || r.lightMinutes == null) continue;
    const a = acc.get(r.userId) ?? { deep: 0, rem: 0, light: 0, n: 0 };
    a.deep += r.deepMinutes;
    a.rem += r.remMinutes;
    a.light += r.lightMinutes;
    a.n += 1;
    acc.set(r.userId, a);
  }
  return new Map(
    [...acc].map(([id, a]) => [id, { deep: a.deep / a.n, rem: a.rem / a.n, light: a.light / a.n }]),
  );
}

function Headline({
  me,
  list,
  byId,
  format,
  unitText,
}: {
  me: ReturnType<typeof standings>[number];
  list: ReturnType<typeof standings>;
  byId: Map<string, BoardMember>;
  format: (v: number) => string;
  unitText: string;
}) {
  const ranked = list.filter((s) => s.rank != null);
  const suffix = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
  const u = unitText ? ` ${unitText}` : "";

  let text: React.ReactNode;
  if (me.rank == null) {
    text = "No data from you for this period yet. Wear your tracker and sync the Google Health app.";
  } else if (ranked.length < 2) {
    text =
      list.length < 2
        ? "Add friends to start competing. Share your link from the Friends tab."
        : "You're the only one with data so far.";
  } else if (me.rank === 1) {
    const second = ranked.find((s) => s.userId !== me.userId)!;
    const lead = (me.value ?? 0) - (second.value ?? 0);
    text =
      lead === 0 ? (
        <>You&apos;re tied for the lead.</>
      ) : (
        <>
          You&apos;re ahead of <strong>{byId.get(second.userId)!.name.split(" ")[0]}</strong> by{" "}
          <strong>{format(lead)}{u}</strong>.
        </>
      );
  } else {
    const above = ranked[ranked.findIndex((s) => s.userId === me.userId) - 1] ?? ranked[0];
    const gap = (above.value ?? 0) - (me.value ?? 0);
    text = (
      <>
        <strong>{format(gap)}{u}</strong> behind <strong>{byId.get(above.userId)!.name.split(" ")[0]}</strong>{" "}
        for {above.rank}
        {suffix(above.rank ?? 1)} place.
      </>
    );
  }

  return (
    <div className="hero fade-swap" key={`${me.rank}-${me.value}`}>
      <div className="hero-rank tnum">
        {me.rank ?? "–"}
        {me.rank != null && <small>{suffix(me.rank)}</small>}
      </div>
      <div className="hero-text">{text}</div>
    </div>
  );
}
