"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./avatar";

export type WinnerLine = {
  key: string;
  label: string;
  winners: { id: string; name: string; avatarUrl: string | null; slot: number }[];
  value: string;
};

/** "Last week's winners" banner on the leaderboard; dismissible until the next week. */
export function WinnersCard({
  weekStart,
  lines,
  won,
  total,
}: {
  weekStart: string;
  lines: WinnerLine[];
  won: number;
  total: number;
}) {
  const key = `rested:winners-dismissed:${weekStart}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(localStorage.getItem(key) === "1");
  }, [key]);
  if (hidden || !total) return null;

  return (
    <section className="content" style={{ marginBottom: 12 }}>
      <div className="winners-card">
        <button
          type="button"
          className="install-close"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(key, "1");
            setHidden(true);
          }}
        >
          ×
        </button>
        <Link href={`/week/${weekStart}`} transitionTypes={["nav-forward"]} className="winners-link">
          <div className="winners-head">
            <span className="winners-trophy" aria-hidden>
              🏆
            </span>
            <div>
              <strong>Last week&apos;s winners</strong>
              <span>{won ? `You won ${won} of ${total} categories` : `${total} categories decided`} · See all</span>
            </div>
          </div>
          <div className="winners-lines">
            {lines.map((l) => (
              <div key={l.key} className="winners-line">
                <span className="winners-label">{l.label}</span>
                <span className="winners-who">
                  {l.winners.slice(0, 2).map((w) => (
                    <Avatar key={w.id} name={w.name} url={w.avatarUrl} slot={w.slot} />
                  ))}
                  <span>{l.winners.map((w) => w.name).join(" & ") || "Nobody"}</span>
                </span>
                <span className="winners-value">{l.value}</span>
              </div>
            ))}
          </div>
        </Link>
      </div>
    </section>
  );
}
