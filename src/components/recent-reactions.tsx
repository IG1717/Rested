"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { markReactionsSeen } from "@/app/actions";
import { Avatar } from "./avatar";
import type { ReceivedReaction } from "@/lib/friends";
import { metricByKey, type MetricKey } from "@/lib/metrics";
import { fmtDay, nightLabel } from "@/lib/periods";

function what(r: ReceivedReaction) {
  if (r.kind === "night") return `your ${nightLabel(r.ref)}`;
  if (r.kind === "day") return `your activity on ${fmtDay(r.ref, { weekday: "short" })}`;
  if (r.kind === "workout") return "your workout";
  const [, key] = r.ref.split(":");
  return `your ${metricByKey[key as MetricKey]?.label ?? "weekly"} win`;
}

function href(r: ReceivedReaction) {
  return r.kind === "week" ? `/week/${r.ref.slice(0, 10)}` : `/f/${r.to}`;
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/** Reactions you've received. Opening it marks them seen (clears the tab and app badges). */
export function RecentReactions({
  items,
  people,
}: {
  items: ReceivedReaction[];
  /** Short name and color slot per friend, so two Sams stay distinguishable. */
  people: Record<string, { short: string; slot: number }>;
}) {
  const router = useRouter();
  // Keep the "new" dots from the first render, even after the refresh clears them server-side.
  const [unseen] = useState(() => new Set(items.filter((i) => i.unseen).map((i) => `${i.from}${i.kind}${i.ref}${i.emoji}`)));

  useEffect(() => {
    if (!unseen.size) return;
    markReactionsSeen().then(() => router.refresh());
  }, [unseen, router]);

  if (!items.length) return null;
  return (
    <section className="section content">
      <h2 className="section-header">Reactions</h2>
      <div className="list" style={{ "--sep-inset": "64px" } as React.CSSProperties}>
        {items.map((r) => {
          const id = `${r.from}${r.kind}${r.ref}${r.emoji}`;
          return (
            <Link key={id} href={href(r)} transitionTypes={["nav-forward"]} className="row">
              <span className="reaction-avatar">
                <Avatar name={r.fromName} url={r.fromAvatar} slot={people[r.from]?.slot ?? 1} />
                <span className="reaction-badge">{r.emoji}</span>
              </span>
              <div className="row-main">
                <div className="row-title wrap">
                  <strong>{people[r.from]?.short ?? r.fromName.split(" ")[0]}</strong> reacted to {what(r)}
                </div>
              </div>
              <span className="row-detail small">{ago(r.at)}</span>
              {unseen.has(id) && <span className="new-dot" aria-label="New" />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
