import type { Stage } from "@/lib/friends";

// Classic hypnogram: awake on top, deep at the bottom, time running left to right.
const LEVEL: Record<string, number> = { AWAKE: 0, RESTLESS: 0, REM: 1, LIGHT: 2, ASLEEP: 2, DEEP: 3 };
const FILL: Record<number, string> = {
  0: "var(--label-3)",
  1: "var(--stage-rem)",
  2: "var(--stage-light)",
  3: "var(--stage-deep)",
};
const ROW = 7;
const GAP = 2;

export function Hypnogram({ stages, label }: { stages: Stage[]; label: string }) {
  const end = Math.max(...stages.map(([s, d]) => s + d), 1);
  const height = 4 * ROW + 3 * GAP;
  return (
    <svg className="hypnogram" viewBox={`0 0 ${end} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {stages.map(([start, dur, type], i) => {
        const level = LEVEL[type] ?? 2;
        return <rect key={i} x={start} width={dur} y={level * (ROW + GAP)} height={ROW} rx={1} fill={FILL[level]} />;
      })}
    </svg>
  );
}
