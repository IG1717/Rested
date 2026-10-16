import { notFound } from "next/navigation";
import { getGroup } from "@/lib/groups";
import { requireUser } from "@/lib/session";
import { leaveGroup, renameGroup, resetInvite } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmit, ShareInvite, SubmitButton } from "@/components/client-buttons";

function syncedLabel(m: { connected: boolean; lastSyncedAt: string | null }) {
  if (!m.connected) return "Needs to reconnect Google Health";
  if (!m.lastSyncedAt) return "Waiting for first sync";
  const mins = Math.round((Date.now() - Date.parse(m.lastSyncedAt)) / 60000);
  if (mins < 60) return "Synced recently";
  if (mins < 60 * 24) return `Synced ${Math.round(mins / 60)} hr ago`;
  return `Synced ${Math.round(mins / 1440)} days ago`;
}

export default async function MembersPage({ params }: PageProps<"/g/[id]/members">) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/members`);
  const group = await getGroup(id, user.id);
  if (!group) notFound();
  const inviteUrl = `${process.env.APP_URL}/join/${group.inviteCode}`;

  return (
    <>
      <NavBar title="Members" back={{ href: `/g/${group.id}`, label: group.name }} />

      <section className="section content">
        <div className="notice">
          <strong>Invite friends.</strong> Anyone with this link can join <strong>{group.name}</strong> and
          see everyone&apos;s sleep and activity stats here.
          <div className="mt-12" style={{ wordBreak: "break-all", fontSize: "0.8125rem" }}>
            {inviteUrl}
          </div>
        </div>
        <div className="mt-12">
          <ShareInvite url={inviteUrl} groupName={group.name} />
        </div>
        {group.isOwner && (
          <form action={resetInvite.bind(null, group.id)}>
            <button type="submit" className="btn btn-plain">
              Reset Link
            </button>
          </form>
        )}
      </section>

      <section className="section content">
        <h2 className="section-header">{group.members.length} Members</h2>
        <div className="list" style={{ "--sep-inset": "64px" } as React.CSSProperties}>
          {group.members.map((m) => (
            <div key={m.id} className="row">
              <Avatar name={m.name} url={m.avatarUrl} slot={m.slot} />
              <div className="row-main">
                <div className="row-title">
                  {m.name}
                  {m.id === user.id && <span className="you-pill">You</span>}
                </div>
                <div className="row-sub">{syncedLabel(m)}</div>
              </div>
              {m.role === "owner" && <span className="row-detail" style={{ fontSize: "0.8125rem" }}>Owner</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="section content">
        <h2 className="section-header">Group</h2>
        <form action={renameGroup.bind(null, group.id)} className="stack-12">
          <div className="list">
            <label className="visually-hidden" htmlFor="name">
              Group name
            </label>
            <input id="name" name="name" className="field" defaultValue={group.name} maxLength={40} required />
          </div>
          <SubmitButton>Save Name</SubmitButton>
        </form>
      </section>

      <section className="section content">
        <form action={leaveGroup.bind(null, group.id)} className="list">
          <ConfirmSubmit label="Leave Group" confirmLabel="Tap Again to Leave" />
        </form>
        <p className="section-footer">
          {group.isOwner && group.members.length > 1
            ? "If you leave, the next longest-standing member becomes the owner."
            : group.members.length === 1
              ? "You're the only member, so leaving deletes the group."
              : "Your data stops showing in this group."}
        </p>
      </section>
    </>
  );
}
