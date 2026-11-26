import Link from "next/link";
import QRCode from "qrcode";
import { requireUser } from "@/lib/session";
import { getCircle, getInviteCode, getReceivedReactions } from "@/lib/friends";
import { removeFriend, resetInvite } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { RemoveFriendButton, ShareInvite } from "@/components/client-buttons";
import { SyncStatus } from "@/components/sync-provider";
import { RecentReactions } from "@/components/recent-reactions";
import { PageTransition } from "@/components/page-transition";
import { QrIcon } from "@/components/icons";

function syncedLabel(p: { connected: boolean; lastSyncedAt: string | null }) {
  if (!p.connected) return "Needs to reconnect Google Health";
  if (!p.lastSyncedAt) return "Waiting for first sync";
  const mins = Math.round((Date.now() - Date.parse(p.lastSyncedAt)) / 60000);
  if (mins < 60) return "Synced recently";
  if (mins < 60 * 24) return `Synced ${Math.round(mins / 60)} hr ago`;
  return `Synced ${Math.round(mins / 1440)} days ago`;
}

export default async function FriendsPage() {
  const user = await requireUser("/friends");
  const [people, code, received] = await Promise.all([
    getCircle(user.id),
    getInviteCode(user.id),
    getReceivedReactions(user.id),
  ]);
  const friends = people.filter((p) => p.id !== user.id);
  const inviteUrl = `${process.env.APP_URL}/add/${code}`;
  // Generated from our own URL by a local library, so it's safe to inline.
  const qr = await QRCode.toString(inviteUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <PageTransition>
      <NavBar title="Friends" />

      <section className="content">
        <div className="notice">
          <strong>Your friend link.</strong> Anyone who opens it can add you as a friend. You&apos;ll both see each
          other&apos;s sleep and activity stats.
          <div className="mt-12" style={{ wordBreak: "break-all", fontSize: "0.8125rem" }}>
            {inviteUrl}
          </div>
        </div>
        <div className="mt-12">
          <ShareInvite url={inviteUrl} name={people[0].short} />
        </div>
        <details className="qr-details">
          <summary className="btn btn-plain">
            <QrIcon className="inline-icon" /> Show QR Code
          </summary>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code for your friend link" role="img" />
          <p className="section-footer" style={{ textAlign: "center" }}>
            Have a friend scan this with their phone camera.
          </p>
        </details>
        <form action={resetInvite}>
          <button type="submit" className="btn btn-plain">
            Reset Link
          </button>
        </form>
        <p className="section-footer">Resetting stops the old link from working. Existing friends stay.</p>
      </section>

      <RecentReactions items={received} people={Object.fromEntries(people.map((p) => [p.id, { short: p.short, slot: p.slot }]))} />

      <section className="section content">
        <h2 className="section-header">
          {friends.length} {friends.length === 1 ? "Friend" : "Friends"}
        </h2>
        {friends.length === 0 ? (
          <div className="notice">No friends yet. Send your link to the people you want to compete with.</div>
        ) : (
          <div className="list" style={{ "--sep-inset": "64px" } as React.CSSProperties}>
            {friends.map((f) => (
              <div key={f.id} className="row">
                <Link href={`/f/${f.id}`} transitionTypes={["nav-forward"]} className="row-link" aria-label={`${f.name}'s profile`} />
                <Avatar name={f.name} url={f.avatarUrl} slot={f.slot} />
                <div className="row-main">
                  <div className="row-title">{f.name}</div>
                  <div className="row-sub">{syncedLabel(f)}</div>
                </div>
                <form action={removeFriend.bind(null, f.id)} className="above-link">
                  <RemoveFriendButton name={f.short} />
                </form>
              </div>
            ))}
          </div>
        )}
        {friends.length > 0 && (
          <p className="section-footer">Tap a friend to see their profile. Removing a friend hides your stats from each other.</p>
        )}
      </section>
      <SyncStatus lastSyncedAt={user.lastSyncedAt} />
    </PageTransition>
  );
}
