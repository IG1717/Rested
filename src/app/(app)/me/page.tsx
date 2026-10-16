import { requireUser } from "@/lib/session";
import { deleteAccount } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmit, SyncNowButton } from "@/components/client-buttons";
import { SyncStatus } from "@/components/sync-provider";
import { SLEEP_TARGET_MINUTES } from "@/lib/sleep-score";

export default async function MePage() {
  const user = await requireUser("/me");
  return (
    <>
      <NavBar title="You" />

      <section className="content">
        <div className="list">
          <div className="row" style={{ minHeight: 84 }}>
            <Avatar name={user.name} url={user.avatarUrl} size="lg" slot={6} />
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
        <h2 className="section-header">How the Sleep Score Works</h2>
        <div className="list">
          <div className="row">
            <div className="row-main">
              <div className="row-title">Duration</div>
              <div className="row-sub">Full marks at {SLEEP_TARGET_MINUTES / 60}h asleep or more</div>
            </div>
            <span className="row-detail tnum">50</span>
          </div>
          <div className="row">
            <div className="row-main">
              <div className="row-title">Deep + REM</div>
              <div className="row-sub">Full marks when 40% of sleep is deep or REM</div>
            </div>
            <span className="row-detail tnum">25</span>
          </div>
          <div className="row">
            <div className="row-main">
              <div className="row-title">Efficiency</div>
              <div className="row-sub">Asleep ÷ time in bed. Full marks at 95%, none below 75%</div>
            </div>
            <span className="row-detail tnum">25</span>
          </div>
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
          Removes your stats from every group, deletes your account, and revokes Rested&apos;s access to
          your Google Health data. <a href="/privacy" style={{ color: "var(--tint)" }}>Privacy Policy</a>
        </p>
      </section>
    </>
  );
}
