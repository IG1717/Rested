import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getCircle, getMetrics } from "@/lib/friends";
import { sql } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { NavBar } from "@/components/nav-bar";
import { Welcome } from "@/components/welcome";
import { Board } from "@/components/board";
import { ChevronRight, PersonAddIcon } from "@/components/icons";
import { SyncStatus } from "@/components/sync-provider";

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

  const [people, [{ timezone }]] = await Promise.all([
    getCircle(user.id),
    sql`SELECT timezone FROM users WHERE id = ${user.id}`,
  ]);
  const today = todayIn(timezone);
  const earliest = addDays(today, -HISTORY_DAYS);
  const rows = await getMetrics(
    people.map((p) => p.id),
    earliest,
  );
  const friendCount = people.length - 1;

  return (
    <>
      <NavBar
        title="Leaderboard"
        right={
          <Link href="/friends" className="nav-btn" aria-label="Add friends">
            <PersonAddIcon />
          </Link>
        }
      />
      {friendCount === 0 && (
        <section className="content" style={{ marginBottom: 16 }}>
          <div className="list">
            <Link href="/friends" className="row">
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
        members={people.map(({ id, name, avatarUrl, slot }) => ({ id, name, avatarUrl, slot }))}
        rows={rows}
        viewerId={user.id}
        today={today}
        earliest={earliest}
      />
      <SyncStatus lastSyncedAt={user.lastSyncedAt} />
    </>
  );
}
