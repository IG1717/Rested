"use client";

import { useMemo, useState } from "react";
import { Avatar } from "./avatar";
import { Segmented } from "./segmented";
import { TrendChart } from "./trend-chart";
import { Hypnogram } from "./hypnogram";
import { Reactions } from "./reactions";
import { Morph } from "./page-transition";
import {
  barFraction,
  formatClock,
  formatBedClock,
  formatDuration,
  headToHead,
  METRICS,
  metricByKey,
  standings,
  type DayRow,
  type MetricKey,
} from "@/lib/metrics";
import { fmtDay, nightLabel, periodRange } from "@/lib/periods";
import type { Night, Reaction, Workout } from "@/lib/friends";

type P = { id: string; name: string; avatarUrl: string | null; slot: number };
type Range = "week" | "month" | "all";

const CHART_METRICS: MetricKey[] = ["sleepMinutes", "deepMinutes", "steps", "azm", "workoutMinutes"];

export function ProfileView({
  person,
  viewer,
  isMe,
  rows,
  nights,
  workouts,
  reactions,
  today,
  earliest,
}: {
  person: P & { fullName: string; lastSyncedAt: string | null; since: string | null };
  viewer: P;
  isMe: boolean;
  rows: DayRow[];
  nights: Night[];
  workouts: Workout[];
  reactions: Reaction[];
  today: string;
  earliest: string;
}) {
  const [range, setRange] = useState<Range>("month");
  const [chartMetric, setChartMetric] = useState<MetricKey>("sleepMinutes");
  const names = { [viewer.id]: viewer.name, [person.id]: person.name };
  const members = isMe ? [person] : [viewer, person];

  const { from, to } =
    range === "all" ? { from: earliest, to: today } : periodRange(range, today, 0);

  const reactionsFor = (kind: Reaction["kind"], ref: string) =>
    reactions.filter((r) => r.kind === kind && r.ref === ref).map((r) => ({ from: r.from, emoji: r.emoji }));

  const subtitle = isMe
    ? "How others see you"
    : person.since
      ? `Friends since ${new Date(person.since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
      : null;

  return (
    <>
      <section className="content">
        <div className="profile-head">
          <Morph name={`avatar-${person.id}`}>
            <Avatar name={person.fullName} url={person.avatarUrl} slot={person.slot} size="lg" />
          </Morph>
          <div>
            <div className="profile-name">{person.fullName}</div>
            {subtitle && <div className="row-sub">{subtitle}</div>}
            <div className="row-sub">{synced(person.lastSyncedAt)}</div>
          </div>
        </div>
      </section>

      {!isMe && (
        <section className="section content">
          <h2 className="section-header big">
            <span>Head to Head</span>
          </h2>
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: "week", label: "This Week" },
              { value: "month", label: "This Month" },
              { value: "all", label: "4 Months" },
            ]}
          />
          <Records rows={rows} viewer={viewer} person={person} from={from} to={to} />
          <div className="list mt-12 vs-list">
            {METRICS.map((m) => {
              const list = standings(rows, [viewer.id, person.id], m, from, to);
              const mine = list.find((s) => s.userId === viewer.id)!;
              const theirs = list.find((s) => s.userId === person.id)!;
              const meWins = mine.rank === 1 && theirs.rank !== 1;
              const theyWin = theirs.rank === 1 && mine.rank !== 1;
              // Long units ("steps", "floors") are implied by the row label and would wrap.
              const v = (x: number | null) => (x == null ? "—" : `${m.format(x)}${m.unit && m.unit.length <= 3 ? ` ${m.unit}` : ""}`);
              return (
                <div key={m.key} className="vs-row">
                  <div className="vs-label">{m.label}</div>
                  <div className={`vs-side${meWins ? " win" : ""}`} style={{ "--c": `var(--m${viewer.slot % 8})` } as React.CSSProperties}>
                    <span className="vs-value">{v(mine.value)}</span>
                    <span className="vs-bar">
                      <span style={{ transform: `scaleX(${barFraction(m, mine.value, list)})` }} />
                    </span>
                  </div>
                  <div className={`vs-side${theyWin ? " win" : ""}`} style={{ "--c": `var(--m${person.slot % 8})` } as React.CSSProperties}>
                    <span className="vs-value">{v(theirs.value)}</span>
                    <span className="vs-bar">
                      <span style={{ transform: `scaleX(${barFraction(m, theirs.value, list)})` }} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="section-footer">
            Top bar is you, bottom is {person.name.replace(/\.$/, "")}. Sleep is averaged per night, activity totaled.
          </p>
        </section>
      )}

      <PersonalBests rows={rows.filter((r) => r.userId === person.id)} />

      <section className="section content">
        <h2 className="section-header">Recent Nights</h2>
        {nights.length === 0 ? (
          <div className="notice">No sleep tracked yet.</div>
        ) : (
          <div className="list">
            {nights.map((n) => (
              <div key={n.date} className="row night-row">
                <div className="row-main">
                  <div className="night-top">
                    <span className="row-title">{nightLabel(n.date)}</span>
                    <span className="score-value small">{formatDuration(n.sleepMinutes)}</span>
                  </div>
                  <div className="row-sub">
                    {fmtDay(n.date, { month: "short", day: "numeric" })}
                    {n.bedClockMin != null && n.wakeClockMin != null &&
                      ` · ${formatBedClock(n.bedClockMin)} – ${formatClock(n.wakeClockMin)}`}
                    {n.deep != null && ` · Deep ${formatDuration(n.deep)} · REM ${formatDuration(n.rem ?? 0)}`}
                  </div>
                  {n.stages && n.stages.length > 0 && (
                    <Hypnogram stages={n.stages} label={`Sleep stages for ${nightLabel(n.date)}`} />
                  )}
                  <Reactions
                    toUser={person.id}
                    kind="night"
                    refKey={n.date}
                    initial={reactionsFor("night", n.date)}
                    viewerId={viewer.id}
                    names={names}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {nights.some((n) => n.stages?.length) && (
          <p className="section-footer legend-inline">
            <span className="key awake" /> Awake <span className="key rem" /> REM <span className="key light" /> Light{" "}
            <span className="key deep" /> Deep
          </p>
        )}
      </section>

      <section className="section content">
        <h2 className="section-header">Recent Workouts</h2>
        {workouts.length === 0 ? (
          <div className="notice">No workouts in the last few months.</div>
        ) : (
          <div className="list" style={{ "--sep-inset": "64px" } as React.CSSProperties}>
            {workouts.map((w) => (
              <div key={w.id} className="row">
                <span className="emoji-tile" aria-hidden>
                  {workoutEmoji(w.type)}
                </span>
                <div className="row-main">
                  <div className="night-top">
                    <span className="row-title">{w.name ?? prettyType(w.type)}</span>
                    <span className="score-value small">{formatDuration(w.durationMin)}</span>
                  </div>
                  <div className="row-sub">{workoutDetails(w)}</div>
                  <Reactions
                    toUser={person.id}
                    kind="workout"
                    refKey={w.id}
                    initial={reactionsFor("workout", w.id)}
                    viewerId={viewer.id}
                    names={names}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section content">
        <div className="chips" role="group" aria-label="Chart metric">
          {CHART_METRICS.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={k === chartMetric} onClick={() => setChartMetric(k)}>
              {metricByKey[k].label}
            </button>
          ))}
        </div>
        <div className="mt-12">
          <TrendChart
            key={chartMetric}
            metric={metricByKey[chartMetric]}
            rows={rows}
            members={members}
            today={today}
            initialSelected={members.map((m) => m.id)}
            viewerId={viewer.id}
          />
        </div>
      </section>
    </>
  );
}

function Records({ rows, viewer, person, from, to }: { rows: DayRow[]; viewer: P; person: P; from: string; to: string }) {
  const sleep = headToHead(rows, viewer.id, person.id, metricByKey.sleepMinutes, from, to);
  const steps = headToHead(rows, viewer.id, person.id, metricByKey.steps, from, to);
  const card = (title: string, unit: string, r: { aWins: number; bWins: number; ties: number }) => (
    <div className="record">
      <span className="record-title">{title}</span>
      <span className="record-score tnum">
        <span className={r.aWins > r.bWins ? "lead" : ""}>{r.aWins}</span>
        <span className="record-dash">–</span>
        <span className={r.bWins > r.aWins ? "lead" : ""}>{r.bWins}</span>
      </span>
      <span className="record-sub">
        You vs {person.name}
        {r.aWins + r.bWins + r.ties === 0 ? ` · no ${unit} yet` : ` · ${unit} won`}
      </span>
    </div>
  );
  return (
    <div className="records mt-12">
      {card("Sleep", "nights", sleep)}
      {card("Steps", "days", steps)}
    </div>
  );
}

function PersonalBests({ rows }: { rows: DayRow[] }) {
  const bests = useMemo(() => {
    const best = (key: keyof DayRow) => {
      let top: DayRow | null = null;
      for (const r of rows) {
        const v = r[key] as number | null;
        if (v != null && (top == null || v > (top[key] as number))) top = r;
      }
      return top;
    };
    const out: { label: string; value: string; date: string }[] = [];
    const night = best("sleepMinutes");
    if (night) out.push({ label: "Longest sleep", value: formatDuration(night.sleepMinutes!), date: night.date });
    const deep = best("deepMinutes");
    if (deep) out.push({ label: "Most deep sleep", value: formatDuration(deep.deepMinutes!), date: deep.date });
    const steps = best("steps");
    if (steps && steps.steps) out.push({ label: "Most steps", value: steps.steps.toLocaleString("en-US"), date: steps.date });
    const azm = best("azm");
    if (azm && azm.azm) out.push({ label: "Most Zone Minutes", value: `${azm.azm} min`, date: azm.date });
    const wk = best("workoutMinutes");
    if (wk && wk.workoutMinutes) out.push({ label: "Most workout time", value: formatDuration(wk.workoutMinutes), date: wk.date });
    return out;
  }, [rows]);

  if (!bests.length) return null;
  return (
    <section className="section content">
      <h2 className="section-header">Personal Bests · Last 4 Months</h2>
      <div className="bests">
        {bests.map((b) => (
          <div key={b.label} className="best">
            <span className="best-value">{b.value}</span>
            <span className="best-label">{b.label}</span>
            <span className="best-date">{fmtDay(b.date, { month: "short", day: "numeric" })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function synced(at: string | null) {
  if (!at) return "Waiting for first sync";
  const mins = Math.round((Date.now() - Date.parse(at)) / 60000);
  if (mins < 2) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  if (mins < 60 * 24) return `Synced ${Math.round(mins / 60)} hr ago`;
  return `Synced ${Math.round(mins / 1440)} days ago`;
}

const EMOJI: [RegExp, string][] = [
  [/RUN|JOG|TREADMILL/, "🏃"],
  [/WALK|HIK/, "🚶"],
  [/BIK|CYCL|SPINNING/, "🚴"],
  [/SWIM/, "🏊"],
  [/WEIGHT|STRENGTH|CROSSFIT/, "🏋️"],
  [/YOGA|PILATES|STRETCH/, "🧘"],
  [/ROW/, "🚣"],
  [/TENNIS|PADEL|PICKLE|SQUASH|BADMINTON/, "🎾"],
  [/BASKETBALL/, "🏀"],
  [/SOCCER|FOOTBALL/, "⚽️"],
  [/GOLF/, "⛳️"],
  [/SKI|SNOWBOARD/, "⛷️"],
  [/DANCE/, "💃"],
  [/CLIMB|STAIR/, "🧗"],
  [/BOX|MARTIAL|KICKBOX/, "🥊"],
  [/ELLIPTICAL/, "🔁"],
];

function workoutEmoji(type: string | null) {
  if (!type) return "💪";
  return EMOJI.find(([re]) => re.test(type))?.[1] ?? "💪";
}

const prettyType = (t: string | null) =>
  t ? t.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Workout";

function workoutDetails(w: Workout) {
  const parts = [fmtDay(w.date, { weekday: "short", month: "short", day: "numeric" })];
  if (w.distanceM) parts.push(`${(w.distanceM / 1609.344).toFixed(2)} mi`);
  if (w.kcal) parts.push(`${w.kcal} Cal`);
  if (w.avgHr) parts.push(`${w.avgHr} bpm avg`);
  return parts.join(" · ");
}
