import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCircle, getMetrics, getReactions } from "@/lib/friends";
import { sql } from "@/lib/db";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { MIN_SLEEP_NIGHTS, weeklyAwards } from "@/lib/awards";
import { ordinal } from "@/lib/metrics";
import { fmtDay, weekSpan } from "@/lib/periods";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { Reactions } from "@/components/reactions";
import { PageTransition } from "@/components/page-transition";
import { StepLeft, StepRight } from "@/components/icons";

const EARLIEST_WEEKS = 16;

export default async function WeekPage({ params }: PageProps<"/week/[start]">) {
  const { start } = await params;
  const user = await requireUser(`/week/${start}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || startOfWeek(start) !== start) notFound();

  const [{ timezone }] = await sql`SELECT timezone FROM users WHERE id = ${user.id}`;
  const today = todayIn(timezone);
  const lastFinished = addDays(startOfWeek(today), -7);
  const earliest = addDays(lastFinished, -7 * EARLIEST_WEEKS);
  if (start > lastFinished || start < earliest) notFound();

  const people = await getCircle(user.id);
  const ids = people.map((p) => p.id);
  const byId = new Map(people.map((p) => [p.id, p]));
  const names = Object.fromEntries(people.map((p) => [p.id, p.short]));
  const rows = (await getMetrics(ids, start)).filter((r) => r.date <= addDays(start, 6));
  const awards = weeklyAwards(rows, ids, start);
  const reactions = await getReactions(
    ids,
    awards.map((a) => `${start}:${a.metric.key}`),
  );
  const won = awards.filter((a) => a.winners.includes(user.id)).length;
  const decided = awards.filter((a) => a.winners.length).length;

  const sections = [
    { title: "Sleep", awards: awards.filter((a) => a.metric.category === "sleep") },
    { title: "Activity", awards: awards.filter((a) => a.metric.category === "activity") },
  ];

  return (
    <PageTransition>
      <NavBar title="Weekly Recap" back={{ href: "/", label: "Leaderboard" }} />
      <section className="content">
        <div className="stepper week-stepper">
          {start > earliest ? (
            <Link href={`/week/${addDays(start, -7)}`} transitionTypes={["nav-back"]} className="round-btn" aria-label="Previous week">
              <StepLeft />
            </Link>
          ) : (
            <span className="round-btn" aria-hidden data-disabled />
          )}
          <div className="stepper-label">
            {start === lastFinished ? "Last Week" : `Week of ${fmtDay(start, { month: "short", day: "numeric" })}`}
            <span className="sub">{weekSpan(start, addDays(start, 6))}</span>
          </div>
          {start < lastFinished ? (
            <Link href={`/week/${addDays(start, 7)}`} transitionTypes={["nav-forward"]} className="round-btn" aria-label="Next week">
              <StepRight />
            </Link>
          ) : (
            <span className="round-btn" aria-hidden data-disabled />
          )}
        </div>
        <div className="hero mt-16">
          <div className="hero-rank tnum">
            {won}
            <small>/{decided}</small>
          </div>
          <div className="hero-text">
            {people.length < 2 ? (
              "Add friends to start winning weeks."
            ) : won ? (
              <>
                You won <strong>{won}</strong> {won === 1 ? "category" : "categories"} this week.
              </>
            ) : (
              "No wins this week. Next week's a fresh start."
            )}
          </div>
        </div>
      </section>

      {sections.map((sec) => (
        <section key={sec.title} className="section content">
          <h2 className="section-header">{sec.title}</h2>
          <div className="list">
            {sec.awards.map((a) => {
              const top = a.standings.filter((s) => s.rank != null).slice(0, 3);
              const mine = a.standings.find((s) => s.userId === user.id);
              const fmt = (v: number | null) => (v == null ? "—" : `${a.metric.format(v)}${a.metric.unit ? ` ${a.metric.unit}` : ""}`);
              const ref = `${start}:${a.metric.key}`;
              return (
                <div key={a.metric.key} className="row award-row">
                  <div className="row-main">
                    <div className="night-top">
                      <span className="row-title">{a.metric.label}</span>
                      <span className="row-sub">
                        {mine?.rank ? `You: ${mine.rank}${ordinal(mine.rank)}` : "You: unranked"}
                      </span>
                    </div>
                    {top.length === 0 ? (
                      <div className="row-sub">
                        Nobody qualified
                        {a.metric.category === "sleep" ? ` (needs ${MIN_SLEEP_NIGHTS} tracked nights)` : ""}
                      </div>
                    ) : (
                      <ol className="podium">
                        {top.map((s) => {
                          const p = byId.get(s.userId)!;
                          return (
                            <li key={s.userId} className={`podium-${s.rank}`}>
                              <span className={`rank tnum r${s.rank}`}>{s.rank}</span>
                              <Avatar name={p.short} url={p.avatarUrl} slot={p.slot} />
                              <span className="podium-name">{s.userId === user.id ? "You" : p.short}</span>
                              <span className="podium-value">{fmt(s.value)}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {a.winners.map((w) => (
                      <Reactions
                        key={w}
                        toUser={w}
                        kind="week"
                        refKey={ref}
                        initial={reactions.filter((r) => r.to === w && r.ref === ref).map((r) => ({ from: r.from, emoji: r.emoji }))}
                        viewerId={user.id}
                        names={names}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="section-footer content">
        Weeks run Monday to Sunday. Sleep averages need {MIN_SLEEP_NIGHTS} tracked nights to win.
      </p>
    </PageTransition>
  );
}
