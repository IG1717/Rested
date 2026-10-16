"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { memberColor } from "./avatar";
import { Segmented } from "./segmented";
import { addDays, dateRange } from "@/lib/dates";
import type { DayRow, Metric } from "@/lib/metrics";
import type { BoardMember } from "./group-board";

const HEIGHT = 210;
const PAD = { top: 14, right: 64, bottom: 24, left: 40 };
const MAX_SERIES = 4;

type Range = "14" | "30" | "90";

function niceStep(span: number, count: number) {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function tickLabel(metric: Metric, v: number) {
  if (metric.key === "sleepMinutes" || metric.key === "deepRem" || metric.key === "workoutMinutes") {
    return v % 60 === 0 ? `${v / 60}h` : `${(v / 60).toFixed(1)}h`;
  }
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return metric.key === "distance" ? v.toFixed(v < 10 ? 1 : 0) : String(Math.round(v));
}

const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

export function TrendChart({
  metric,
  rows,
  members,
  today,
  initialSelected,
  viewerId,
}: {
  metric: Metric;
  rows: DayRow[];
  members: BoardMember[];
  today: string;
  initialSelected: string[];
  viewerId: string;
}) {
  const [range, setRange] = useState<Range>("14");
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dates = useMemo(() => dateRange(addDays(today, -(Number(range) - 1)), today), [range, today]);

  const series = useMemo(() => {
    const index = new Map(rows.map((r) => [`${r.userId}|${r.date}`, r]));
    return members
      .filter((m) => selected.includes(m.id))
      .map((m) => ({
        member: m,
        values: dates.map((d) => {
          const r = index.get(`${m.id}|${d}`);
          return r ? metric.value(r) : null;
        }),
      }));
  }, [rows, members, selected, dates, metric]);

  // Scales
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : 1;
  if (metric.agg === "sum" || lo - (hi - lo) * 0.5 < 0) lo = 0;
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, 3);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);

  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (dates.length === 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    // Lone points (no neighbor on either side) get a dot so they don't vanish.
    const lone = s.values
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => v != null && s.values[i - 1] == null && s.values[i + 1] == null);
    return { ...s, d, lone };
  });

  // Direct labels at each line's last point, nudged apart so they never collide.
  const endLabels = paths
    .map((p) => {
      const last = p.values.findLastIndex((v) => v != null);
      const name = p.member.id === viewerId ? "You" : p.member.name.split(" ")[0];
      return last < 0 ? null : { id: p.member.id, name, ly: y(p.values[last]!), lx: x(last) };
    })
    .filter((l): l is NonNullable<typeof l> => !!l)
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].ly - endLabels[i - 1].ly < 14) endLabels[i].ly = endLabels[i - 1].ly + 14;
  }

  const xTicks = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];

  const indexFromPointer = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(dates.length - 1, Math.round((px / plotW) * (dates.length - 1))));
  };

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_SERIES ? cur : [...cur, id],
    );

  const tip =
    hover != null
      ? series
          .map((s) => ({ m: s.member, v: s.values[hover] }))
          .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
      : [];
  // Keep the tooltip inside the plot, on the side of the crosshair with more room.
  const TIP_W = 184;
  const tipLeft =
    hover == null ? 0 : x(hover) > PAD.left + plotW / 2 ? Math.max(4, x(hover) - TIP_W - 12) : x(hover) + 12;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <span className="chart-title">{metric.label} Trend</span>
        <div style={{ width: 150 }}>
          <Segmented
            label="Trend range"
            value={range}
            onChange={(r) => {
              setRange(r);
              setHover(null);
            }}
            options={[
              { value: "14", label: "2W" },
              { value: "30", label: "1M" },
              { value: "90", label: "3M" },
            ]}
          />
        </div>
      </div>

      <div ref={wrap} style={{ position: "relative" }}>
        <svg
          className="chart-svg"
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`${metric.label} over the last ${range} days`}
          tabIndex={0}
          onPointerDown={(e) => setHover(indexFromPointer(e.clientX))}
          onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons) && setHover(indexFromPointer(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onPointerUp={(e) => e.pointerType !== "mouse" && setHover(null)}
          onPointerCancel={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? dates.length) - 1));
            if (e.key === "ArrowRight") setHover((h) => Math.min(dates.length - 1, (h ?? -1) + 1));
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke={t === lo ? "var(--axis)" : "var(--grid)"}
                strokeWidth={t === lo ? 1 : 0.5}
              />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {tickLabel(metric, t)}
              </text>
            </g>
          ))}
          {xTicks.map((i, k) => (
            <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
              {i === dates.length - 1 ? "Today" : fmtDate(dates[i], { month: "short", day: "numeric" })}
            </text>
          ))}

          {paths.map((p) => (
            <g key={p.member.id} style={{ color: memberColor(p.member.slot) }}>
              <path
                d={p.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={p.member.id === viewerId ? 2.5 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {p.lone.map(({ v, i }) => (
                <circle key={i} cx={x(i)} cy={y(v!)} r={3.5} fill="currentColor" stroke="var(--card)" strokeWidth={2} />
              ))}
            </g>
          ))}

          {endLabels.map((l) => (
            <text key={l.id} className="end-label" x={PAD.left + plotW + 8} y={l.ly + 4}>
              {l.name}
            </text>
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top - 4}
                y2={PAD.top + plotH}
                stroke="var(--label-3)"
                strokeWidth={1}
              />
              {series.map((s) =>
                s.values[hover] == null ? null : (
                  <circle
                    key={s.member.id}
                    cx={x(hover)}
                    cy={y(s.values[hover]!)}
                    r={4.5}
                    fill={memberColor(s.member.slot)}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          )}
        </svg>

        {hover != null && series.length > 0 && (
          <div className="chart-tip" style={{ left: tipLeft, width: TIP_W }}>
            <div className="tip-date">{fmtDate(dates[hover], { weekday: "short", month: "short", day: "numeric" })}</div>
            {tip.map(({ m, v }) => (
              <div className="tip-row" key={m.id}>
                <span className="key" style={{ background: memberColor(m.slot) }} />
                <span className="tip-val">{v == null ? "—" : `${metric.format(v)}${metric.unit ? ` ${metric.unit}` : ""}`}</span>
                <span className="tip-name">{m.id === viewerId ? "You" : m.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="legend" role="group" aria-label="People shown in chart">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className="legend-chip"
            aria-pressed={selected.includes(m.id)}
            style={{ "--c": memberColor(m.slot) } as React.CSSProperties}
            onClick={() => toggle(m.id)}
          >
            <span className="key" />
            {m.id === viewerId ? "You" : m.name.split(" ")[0]}
          </button>
        ))}
      </div>
      {selected.length >= MAX_SERIES && (
        <p className="section-footer" style={{ paddingTop: 0 }}>
          Up to {MAX_SERIES} people at a time. Tap a name to swap.
        </p>
      )}

      <button type="button" className="btn btn-plain" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
        {showTable ? "Hide Data Table" : "Show Data Table"}
      </button>
      {showTable && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {series.map((s) => (
                  <th key={s.member.id}>{s.member.name.split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...dates.keys()].reverse().map((i) => (
                <tr key={dates[i]}>
                  <td>{fmtDate(dates[i], { month: "short", day: "numeric" })}</td>
                  {series.map((s) => (
                    <td key={s.member.id}>{s.values[i] == null ? "—" : metric.format(s.values[i]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
