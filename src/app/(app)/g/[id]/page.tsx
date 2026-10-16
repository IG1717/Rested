import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroup, getGroupMetrics } from "@/lib/groups";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { NavBar } from "@/components/nav-bar";
import { GroupBoard } from "@/components/group-board";
import { ChevronRight, ShareIcon } from "@/components/icons";
import { SyncStatus } from "@/components/sync-provider";
import { Avatar } from "@/components/avatar";

const HISTORY_DAYS = 120;

export default async function GroupPage({ params }: PageProps<"/g/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}`);
  const group = await getGroup(id, user.id);
  if (!group) notFound();

  const [{ timezone }] = await sql`SELECT timezone FROM users WHERE id = ${user.id}`;
  const today = todayIn(timezone);
  const earliest = addDays(today, -HISTORY_DAYS);
  const rows = await getGroupMetrics(
    group.members.map((m) => m.id),
    earliest,
  );

  return (
    <>
      <NavBar
        title={`${group.emoji} ${group.name}`}
        back={{ href: "/", label: "Groups" }}
        right={
          <Link href={`/g/${group.id}/members`} className="nav-btn" aria-label="Invite and members">
            <ShareIcon />
          </Link>
        }
      />
      <GroupBoard
        groupId={group.id}
        members={group.members.map(({ id, name, avatarUrl, slot }) => ({ id, name, avatarUrl, slot }))}
        rows={rows}
        viewerId={user.id}
        today={today}
        earliest={earliest}
      />
      <section className="section content">
        <div className="list">
          <Link href={`/g/${group.id}/members`} className="row">
            <div style={{ display: "flex" }}>
              {group.members.slice(0, 5).map((m, i) => (
                <span key={m.id} style={{ marginLeft: i ? -10 : 0 }}>
                  <Avatar name={m.name} url={m.avatarUrl} slot={m.slot} ring />
                </span>
              ))}
            </div>
            <div className="row-main">
              <div className="row-title">Members &amp; Invite</div>
              <div className="row-sub">
                {group.members.length} {group.members.length === 1 ? "person" : "people"}
              </div>
            </div>
            <ChevronRight />
          </Link>
        </div>
      </section>
      <SyncStatus lastSyncedAt={user.lastSyncedAt} />
    </>
  );
}
