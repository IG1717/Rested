import { requireUser } from "@/lib/session";
import { deleteAccount } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmit, SyncNowButton } from "@/components/client-buttons";
import { SyncStatus } from "@/components/sync-provider";

export default async function MePage() {
  const user = await requireUser("/me");
  return (
    <>
      <NavBar title="You" />

      <section className="content">
        <div className="list">
          <div className="row" style={{ minHeight: 84 }}>
            <Avatar name={user.name} url={user.avatarUrl} size="lg" slot={0} />
            <div className="row-main">
              <div className="row-title" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {user.name}
              </div>
              <div className="row-sub">{user.email}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section content">
        <h2 className="section-header">Google Health</h2>
        <div className="list">
          <div className="row">
            <div className="row-main">Status</div>
            <span className="row-detail">{user.syncError ? "Problem" : "Connected"}</span>
          </div>
          <SyncNowButton />
          <a className="row tinted" href="/api/auth/login?next=/me">
            Reconnect Google Account
          </a>
        </div>
        <SyncStatus lastSyncedAt={user.lastSyncedAt} />
        <p className="section-footer">
          Rested updates when Google Health gets new data from your tracker, and again whenever you open the app.
          If something looks stale, open the Google Health app to sync your Fitbit first.
        </p>
      </section>

      <section className="section content">
        <h2 className="section-header">How Stats Work</h2>
        <div className="notice">
          <strong>Sleep</strong> is ranked on time asleep and on minutes in deep, REM and light sleep, exactly as
          Google Health reports them. Time awake in bed doesn&apos;t count.
        </div>
        <p className="section-footer">
          Each night uses your main sleep and counts toward the day you woke up. Weekly and monthly sleep
          stats are averages of the nights you tracked. Activity stats are totals.
        </p>
      </section>

      <section className="section content">
        <h2 className="section-header">Add to Home Screen</h2>
        <div className="notice">
          <strong>iPhone:</strong> in Safari, tap Share, then <strong>Add to Home Screen</strong>.
          <br />
          <strong>Android:</strong> in Chrome, tap ⋮, then <strong>Add to Home screen</strong>.
        </div>
      </section>

      <section className="section content">
        <form action="/api/auth/logout" method="post" className="list">
          <button type="submit" className="row tinted" style={{ justifyContent: "center" }}>
            Sign Out
          </button>
        </form>
      </section>

      <section className="section content">
        <form action={deleteAccount} className="list">
          <ConfirmSubmit label="Delete My Account" confirmLabel="Tap Again to Delete Everything" />
        </form>
        <p className="section-footer">
          Removes your stats from your friends’ leaderboards, deletes your account, and revokes Rested&apos;s access to
          your Google Health data. <a href="/privacy" style={{ color: "var(--tint)" }}>Privacy Policy</a>
        </p>
      </section>
    </>
  );
}
