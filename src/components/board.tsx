"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./avatar";
import { CrownIcon, StepLeft, StepRight } from "./icons";
import { Segmented } from "./segmented";
import { TrendChart } from "./trend-chart";
import { CountUp } from "./count-up";
import { Reactions, type ReactionLite } from "./reactions";
import { Morph } from "./page-transition";
import {
  barFraction,
  formatDuration,
  lead,
  metricByKey,
  metricsFor,
  ordinal,
  rankChanges,
  standings,
  type Category,
  type DayRow,
  type Metric,
  type MetricKey,
  type Period,
  type Standing,
} from "@/lib/metrics";
import { periodLabel, periodRange } from "@/lib/periods";
import type { ReactionKind } from "@/lib/reactions";

export type BoardMember = { id: string; name: string; avatarUrl: string | null; slot: number };
export type BoardReaction = { to: string; kind: ReactionKind; ref: string; from: string; emoji: string };

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

export function Board({
  members,
  rows,
  viewerId,
  today,
  earliest,
  reactions,
  importing,
}: {
  members: BoardMember[];
  rows: DayRow[];
  viewerId: string;
  today: string;
  earliest: string;
  reactions: BoardReaction[];
  importing: boolean;
}) {
  const [prefs, setPrefs] = useState<Prefs>({ category: "sleep", metric: DEFAULT_METRIC, period: "day" });
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
  const available = metricsFor(category, period);
  const metric =
    available.find((m) => m.key === prefs.metric[category]) ?? metricByKey[DEFAULT_METRIC[category]];
  const accent = ACCENT[category];
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const solo = members.length < 2;

  const { from, to } = periodRange(period, today, offset);
  const prevRange = periodRange(period, today, offset + 1);
  const canGoBack = prevRange.to >= earliest;
  const label = periodLabel(period, category, offset, from, to);
  const list = standings(rows, memberIds, metric, from, to);
  const moves = rankChanges(list, standings(rows, memberIds, metric, prevRange.from, prevRange.to));
  const stages = metric.key === "sleepMinutes" ? stageAverages(rows, from, to) : null;
  const me = list.find((s) => s.userId === viewerId);
  const ranked = list.filter((s) => s.rank != null);

  // Your place in every metric, for the chips.
  const chipRanks = new Map(
    available.map((m) => {
      const s = standings(rows, memberIds, m, from, to).find((x) => x.userId === viewerId);
      return [m.key, s?.rank ?? null];
    }),
  );

  const reactionKind: ReactionKind = category === "sleep" ? "night" : "day";
  const reactionsFor = (userId: string): ReactionLite[] =>
    reactions.filter((r) => r.to === userId && r.kind === reactionKind && r.ref === from);

  const chartSelection = useMemo(() => {
    const top = ranked.slice(0, 3).map((s) => s.userId);
    return Array.from(new Set([viewerId, ...top])).slice(0, 3);
    // Seed once per metric; the chart keeps the viewer's own picks after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.key, viewerId]);

  const step = (dir: 1 | -1) =>
    setOffset((o) => (dir === 1 ? (canGoBack ? o + 1 : o) : Math.max(0, o - 1)));
  const swipe = useSwipe((dir) => step(dir === "right" ? 1 : -1));

  // Pin your row above the tab bar while it's scrolled out of view below.
  const meRow = useRef<HTMLDivElement>(null);
  const [pinMe, setPinMe] = useState(false);
  useEffect(() => {
    const el = meRow.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPinMe(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, [metric.key, period, offset, members.length]);

  const unit = metric.unit ? <span className="score-unit">{metric.unit}</span> : null;

  return (
    <div style={{ "--accent": accent.text, "--accent-fill": accent.fill } as React.CSSProperties} {...swipe}>
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
          {available.map((m) => {
            const r = chipRanks.get(m.key);
            return (
              <button
                key={m.key}
                type="button"
                className="chip"
                aria-pressed={m.key === metric.key}
                onClick={() => update({ metric: { ...prefs.metric, [category]: m.key } })}
              >
                {m.label}
                {!solo && r != null && (
                  <span className={`chip-rank${r === 1 ? " first" : ""}`}>
                    {r}
                    {ordinal(r)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="controls-row">
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
            <button type="button" className="round-btn" aria-label="Previous period" disabled={!canGoBack} onClick={() => step(1)}>
              <StepLeft />
            </button>
            <div className="stepper-label" aria-live="polite">
              {label.title}
              <span className="sub">{label.sub}</span>
            </div>
            <button type="button" className="round-btn" aria-label="Next period" disabled={offset === 0} onClick={() => step(-1)}>
              <StepRight />
            </button>
          </div>
        </div>
      </div>

      {importing ? (
        <section className="section content">
          <div className="importing">
            <span className="spinner" />
            <div>
              <strong>Importing your last 3 months…</strong>
              <span>This takes a few seconds the first time. Your leaderboards fill in as soon as it&apos;s done.</span>
            </div>
          </div>
        </section>
      ) : solo ? (
        <SoloSummary rows={rows} viewerId={viewerId} category={category} period={period} from={from} to={to} />
      ) : (
        <>
          {me && (
            <div className="content mt-16">
              <Headline me={me} list={list} byId={byId} metric={metric} />
            </div>
          )}

          <section className="section content">
            {/* Rows are keyed by member, so switching metric animates each bar from where it was. */}
            <div className="list board">
              {list.map((s) => {
                const m = byId.get(s.userId)!;
                const isMe = s.userId === viewerId;
                const pct = barFraction(metric, s.value, list);
                const split = stages?.get(s.userId);
                const move = moves.get(s.userId) ?? 0;
                const sub = rowSub(s, metric, period, split);
                return (
                  <div
                    key={s.userId}
                    ref={isMe ? meRow : undefined}
                    className={`row board-row${isMe ? " highlight" : ""}${s.rank === 1 ? " leader" : ""}`}
                  >
                    <Link
                      href={`/f/${s.userId}`}
                      transitionTypes={["nav-forward"]}
                      className="row-link"
                      aria-label={`${m.name}${isMe ? " (you)" : ""}, ${s.rank ? `${s.rank}${ordinal(s.rank)}` : "no data"}${s.value != null ? `, ${metric.format(s.value)} ${metric.unit}` : ""}`}
                    />
                    <span className={`rank tnum${s.rank && s.rank <= 3 ? ` r${s.rank}` : ""}`}>
                      {s.rank === 1 && <CrownIcon className="crown" />}
                      {s.rank ?? "–"}
                      {move !== 0 && (
                        <span className={`move ${move > 0 ? "up" : "down"}`} aria-hidden>
                          {move > 0 ? "▲" : "▼"}
                          {Math.abs(move)}
                        </span>
                      )}
                    </span>
                    <Morph name={`avatar-${s.userId}`}>
                      <Avatar name={m.name} url={m.avatarUrl} slot={m.slot} />
                    </Morph>
                    <div className="row-main">
                      <div className="row-title">
                        {m.name}
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
                      {period === "day" && s.value != null && (
                        <Reactions
                          key={`${s.userId}-${reactionKind}-${from}`}
                          toUser={s.userId}
                          kind={reactionKind}
                          refKey={from}
                          initial={reactionsFor(s.userId)}
                          viewerId={viewerId}
                          names={names}
                        />
                      )}
                    </div>
                    <div className="score">
                      {s.value == null ? (
                        <span className="score-empty">—</span>
                      ) : (
                        <>
                          <span className="score-value">
                            <CountUp value={s.value} format={metric.format} />
                          </span>
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

          {pinMe && me && (
            <div className="pinned-me" aria-hidden>
              <span className="rank tnum">{me.rank ?? "–"}</span>
              <Avatar name={byId.get(viewerId)!.name} url={byId.get(viewerId)!.avatarUrl} slot={byId.get(viewerId)!.slot} />
              <span className="pinned-name">You</span>
              <span className="score-value">{me.value == null ? "—" : metric.format(me.value)}</span>
              {unit}
            </div>
          )}
        </>
      )}

      {!importing && metric.agg !== "spread" && (
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
      )}
    </div>
  );
}

function rowSub(s: Standing, metric: Metric, period: Period, split?: { deep: number; rem: number }) {
  if (s.value == null) {
    return metric.agg === "spread" && s.days > 0 ? `Needs 3 nights (has ${s.days})` : "No data yet";
  }
  if (split) {
    return (
      <>
        <span className="nowrap">Deep {formatDuration(split.deep)}</span> ·{" "}
        <span className="nowrap">REM {formatDuration(split.rem)}</span>
      </>
    );
  }
  if (metric.key === "workoutMinutes") return `${s.workouts} workout${s.workouts === 1 ? "" : "s"}`;
  if ((metric.agg === "avg" || metric.agg === "spread") && period !== "day") return `Over ${s.days} night${s.days === 1 ? "" : "s"}`;
  if (metric.agg === "sum" && period !== "day" && s.days > 0)
    return `${metric.format(s.value / s.days)} ${metric.unit} / day`.trim();
  return null;
}

/** Horizontal swipe detection that ignores vertical scrolls and taps. */
function useSwipe(onSwipe: (dir: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      // Don't hijack horizontally scrolling areas (chips, chart).
      if (target.closest(".chips, .chart-card, .reaction-tray")) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 40 && Date.now() - s.t < 600) onSwipe(dx > 0 ? "right" : "left");
    },
  };
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

/** With nobody to compete against, show your own numbers for the period instead of a 1-row board. */
function SoloSummary({
  rows,
  viewerId,
  category,
  period,
  from,
  to,
}: {
  rows: DayRow[];
  viewerId: string;
  category: Category;
  period: Period;
  from: string;
  to: string;
}) {
  const metrics = metricsFor(category, period);
  return (
    <section className="section content">
      <h2 className="section-header">Your {category === "sleep" ? "sleep" : "activity"}</h2>
      <div className="list">
        {metrics.map((m) => {
          const s = standings(rows, [viewerId], m, from, to)[0];
          return (
            <div key={m.key} className="row">
              <div className="row-main">{m.label}</div>
              <span className="score">
                {s.value == null ? (
                  <span className="score-empty">—</span>
                ) : (
                  <>
                    <span className="score-value small">
                      <CountUp value={s.value} format={m.format} />
                    </span>
                    {m.unit && <span className="score-unit">{m.unit}</span>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p className="section-footer">Leaderboards appear here once a friend joins.</p>
    </section>
  );
}

function Headline({
  me,
  list,
  byId,
  metric,
}: {
  me: Standing;
  list: Standing[];
  byId: Map<string, BoardMember>;
  metric: Metric;
}) {
  const ranked = list.filter((s) => s.rank != null);
  const u = metric.unit ? ` ${metric.unit}` : "";
  const gapText = (a: number, b: number) =>
    metric.key === "bedtime" ? formatDuration(Math.abs(lead(metric, a, b))) : `${metric.format(Math.abs(lead(metric, a, b)))}${u}`;

  let text: React.ReactNode;
  if (me.rank == null) {
    text =
      metric.agg === "spread"
        ? "Consistency needs at least 3 tracked nights in the period."
        : "No data from you for this period yet. Wear your tracker and sync the Google Health app.";
  } else if (ranked.length < 2) {
    text = "You're the only one with data so far.";
  } else if (me.rank === 1) {
    const second = ranked.find((s) => s.userId !== me.userId)!;
    const tied = Math.round(lead(metric, me.value ?? 0, second.value ?? 0) * 100) === 0;
    text = tied ? (
      <>You&apos;re tied for the lead.</>
    ) : (
      <>
        You&apos;re ahead of <strong>{byId.get(second.userId)!.name}</strong> by{" "}
        <strong>{gapText(me.value ?? 0, second.value ?? 0)}</strong>.
      </>
    );
  } else {
    const above = ranked[ranked.findIndex((s) => s.userId === me.userId) - 1] ?? ranked[0];
    text = (
      <>
        <strong>{gapText(above.value ?? 0, me.value ?? 0)}</strong> behind{" "}
        <strong>{byId.get(above.userId)!.name}</strong> for {above.rank}
        {ordinal(above.rank ?? 1)} place.
      </>
    );
  }

  return (
    <div className="hero fade-swap" key={`${me.rank}-${me.value}`}>
      <div className="hero-rank tnum">
        {me.rank ?? "–"}
        {me.rank != null && <small>{ordinal(me.rank)}</small>}
      </div>
      <div className="hero-text">{text}</div>
    </div>
  );
}
