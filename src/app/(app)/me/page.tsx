import Link from "next/link";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { deleteAccount, saveNickname } from "@/app/actions";
import { NavBar } from "@/components/nav-bar";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmit, SubmitButton, SyncNowButton } from "@/components/client-buttons";
import { SyncStatus } from "@/components/sync-provider";
import { NotificationsCard } from "@/components/notifications-card";
import { PageTransition } from "@/components/page-transition";
import { ChevronRight } from "@/components/icons";

export default async function MePage() {
  const user = await requireUser("/me");
  const [prefs] = await sql`
    SELECT notify_reactions, notify_passed, notify_weekly, notify_friends FROM users WHERE id = ${user.id}`;

  return (
    <PageTransition>
      <NavBar title="You" />

      <section className="content">
        <div className="list">
          <Link href={`/f/${user.id}`} transitionTypes={["nav-forward"]} className="row" style={{ minHeight: 84 }}>
            <Avatar name={user.name} url={user.avatarUrl} size="lg" slot={0} />
            <div className="row-main">
              <div className="row-title" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {user.nickname || user.name}
              </div>
              <div className="row-sub">{user.email}</div>
              <div className="row-sub tinted-text">View your profile</div>
            </div>
            <ChevronRight />
          </Link>
        </div>
      </section>

      <section className="section content">
        <h2 className="section-header">Display Name</h2>
        <form action={saveNickname} className="stack-12">
          <div className="list">
            <label className="visually-hidden" htmlFor="nickname">
              Nickname
            </label>
            <input
              id="nickname"
              name="nickname"
              className="field"
              defaultValue={user.nickname ?? ""}
              placeholder={user.name.split(" ")[0]}
              maxLength={24}
              autoComplete="nickname"
            />
          </div>
          <SubmitButton>Save Name</SubmitButton>
        </form>
        <p className="section-footer">What friends see on leaderboards. Leave empty to use your first name.</p>
      </section>

      <NotificationsCard
        vapidKey={process.env.VAPID_PUBLIC_KEY ?? null}
        prefs={{
          reactions: prefs.notify_reactions,
          passed: prefs.notify_passed,
          weekly: prefs.notify_weekly,
          friends: prefs.notify_friends,
        }}
      />

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
          Rested updates within minutes when Google Health gets new data from your tracker, and whenever you open the
          app or pull down on the leaderboard. If something looks stale, open the Google Health app to sync your
          Fitbit first.
        </p>
      </section>

      <section className="section content">
        <h2 className="section-header">How Stats Work</h2>
        <div className="notice">
          <strong>Sleep</strong> uses time asleep, deep, REM and light minutes, exactly as Google Health reports
          them. <strong>Efficiency</strong> is the share of time in bed you were asleep. <strong>Bedtime</strong>{" "}
          ranks who goes to bed earliest, and <strong>Consistency</strong> how little your bedtime varies.
        </div>
        <p className="section-footer">
          Each night uses your main sleep and counts toward the day you woke up. Weekly and monthly sleep stats
          are averages of the nights you tracked; activity stats are totals. Weekly winners need 4 tracked nights
          for sleep categories.
        </p>
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
          Removes your stats from your friends&apos; leaderboards, deletes your account, and revokes Rested&apos;s
          access to your Google Health data. <a href="/privacy" style={{ color: "var(--tint)" }}>Privacy Policy</a>
        </p>
      </section>
    </PageTransition>
  );
}
