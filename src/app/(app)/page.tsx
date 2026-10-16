import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listGroups } from "@/lib/groups";
import { NavBar } from "@/components/nav-bar";
import { Welcome } from "@/components/welcome";
import { ChevronRight, PlusIcon } from "@/components/icons";
import { SyncStatus } from "@/components/sync-provider";

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

  const groups = await listGroups(user.id);

  return (
    <>
      <NavBar
        title="Groups"
        right={
          <Link href="/groups/new" className="nav-btn" aria-label="New group">
            <PlusIcon />
          </Link>
        }
      />
      {groups.length === 0 ? (
        <div className="content">
          <div className="empty">
            <div className="big-emoji">🛌</div>
            <h2>No groups yet</h2>
            <p>Create a group and send the invite link to your friends. They&apos;ll show up on the leaderboard as soon as they join.</p>
          </div>
          <Link href="/groups/new" className="btn btn-primary">
            Create a Group
          </Link>
          <p className="section-footer" style={{ textAlign: "center" }}>
            Got an invite? Open the link your friend sent you.
          </p>
        </div>
      ) : (
        <section className="section content">
          <div className="list" style={{ "--sep-inset": "64px" } as React.CSSProperties}>
            {groups.map((g) => (
              <Link key={g.id} href={`/g/${g.id}`} className="row">
                <span className="emoji-tile">{g.emoji}</span>
                <div className="row-main">
                  <div className="row-title">{g.name}</div>
                  <div className="row-sub">
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  </div>
                </div>
                <ChevronRight />
              </Link>
            ))}
          </div>
        </section>
      )}
      <SyncStatus lastSyncedAt={user.lastSyncedAt} />
    </>
  );
}
