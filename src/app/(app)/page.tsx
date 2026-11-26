import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCircle, getMetrics, getReactions } from "@/lib/friends";
import { sql } from "@/lib/db";
import { addDays, dateRange, startOfWeek, todayIn } from "@/lib/dates";
import { awardSummary, weeklyAwards } from "@/lib/awards";
import { NavBar } from "@/components/nav-bar";
import { Welcome } from "@/components/welcome";
import { Board } from "@/components/board";
import { ChevronRight, PersonAddIcon } from "@/components/icons";
import { SyncStatus } from "@/components/sync-provider";
import { InstallBanner } from "@/components/pwa";
import { PageTransition } from "@/components/page-transition";
import { WinnersCard, type WinnerLine } from "@/components/winners-card";

const HISTORY_DAYS = 120;

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  if (!user) {
    return (
      <Welcome
        next={typeof sp.next === "string" ? sp.next : undefined}
        error={typeof sp.error === "string" ? sp.error : undefined}
      />
    );
  }
  if (!user.onboarded) redirect("/setup");

  const [people, [{ timezone }]] = await Promise.all([
    getCircle(user.id),
    sql`SELECT timezone FROM users WHERE id = ${user.id}`,
  ]);
  const ids = people.map((p) => p.id);
  const today = todayIn(timezone);
  const earliest = addDays(today, -HISTORY_DAYS);
  const [rows, reactions] = await Promise.all([
    getMetrics(ids, earliest),
    // Reactions only show on the Night/Day view, which steps back at most a few weeks in practice.
    getReactions(ids, dateRange(addDays(today, -30), today)),
  ]);
  const friendCount = people.length - 1;

  // Last week's winners (Monday–Sunday just finished).
  const lastWeek = addDays(startOfWeek(today), -7);
  const awards = friendCount ? weeklyAwards(rows, ids, lastWeek) : [];
  const summary = awardSummary(awards, user.id);
  const byId = new Map(people.map((p) => [p.id, p]));
  const lines: WinnerLine[] = [summary.sleep, summary.steps]
    .filter((a) => a && a.winners.length)
    .map((a) => ({
      key: a!.metric.key,
      label: a!.metric.label,
      winners: a!.winners.map((id) => {
        const p = byId.get(id)!;
        return { id, name: id === user.id ? "You" : p.short, avatarUrl: p.avatarUrl, slot: p.slot };
      }),
      value: `${a!.metric.format(a!.value!)}${a!.metric.unit ? ` ${a!.metric.unit}` : ""}${a!.metric.agg === "avg" ? " avg" : ""}`,
    }));

  return (
    <PageTransition>
      <NavBar
        title="Leaderboard"
        right={
          <Link href="/friends" transitionTypes={["tab"]} className="nav-btn" aria-label="Add friends">
            <PersonAddIcon />
          </Link>
        }
      />
      <InstallBanner />
      <WinnersCard weekStart={lastWeek} lines={lines} won={summary.won} total={summary.total} />
      {friendCount === 0 && (
        <section className="content" style={{ marginBottom: 16 }}>
          <div className="list">
            <Link href="/friends" transitionTypes={["tab"]} className="row">
              <span className="emoji-tile">👋</span>
              <div className="row-main">
                <div className="row-title">Add your friends</div>
                <div className="row-sub">Share your link. Once they open it, they show up here.</div>
              </div>
              <ChevronRight />
            </Link>
          </div>
        </section>
      )}
      <Board
        members={people.map(({ id, short, avatarUrl, slot }) => ({ id, name: short, avatarUrl, slot }))}
        rows={rows}
        viewerId={user.id}
        today={today}
        earliest={earliest}
        reactions={reactions}
        importing={!user.lastSyncedAt && !rows.some((r) => r.userId === user.id)}
      />
      <SyncStatus lastSyncedAt={user.lastSyncedAt} />
    </PageTransition>
  );
}
