/* eslint-disable @next/next/no-img-element */
import { MARK_DATA_URI } from "@/lib/brand";
import { ChartIcon, GoogleG, MoonIcon, WalkIcon } from "./icons";

export function Welcome({ next, error, invite }: { next?: string; error?: string; invite?: string }) {
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <main className="welcome">
      <img src={MARK_DATA_URI} alt="" className="welcome-mark" />
      <h1>{invite ? <>Join {invite} on Rested</> : <>Who slept best last&nbsp;night?</>}</h1>
      <p className="lede">
        Rested turns your Google Health data into friendly leaderboards, so you and your friends can
        compete on more than steps.
      </p>
      <ul className="features">
        <li>
          <MoonIcon className="ficon" />
          <div>
            <strong>Sleep, head to head</strong>
            <span>Sleep Score, time asleep and deep + REM, ranked every night.</span>
          </div>
        </li>
        <li>
          <WalkIcon className="ficon" />
          <div>
            <strong>Every activity stat</strong>
            <span>Steps, Zone Minutes, workouts, calories, distance and floors.</span>
          </div>
        </li>
        <li>
          <ChartIcon className="ficon" />
          <div>
            <strong>Groups and trends</strong>
            <span>Make a group, share the link, and watch the lead change over weeks.</span>
          </div>
        </li>
      </ul>
      <div className="welcome-actions">
        {error && (
          <p className="notice" role="alert">
            Sign-in didn&apos;t finish. Please try again.
          </p>
        )}
        <a href={href} className="btn btn-google">
          <GoogleG /> Continue with Google
        </a>
        <p className="fine-print">
          Use the Google account your Fitbit syncs to. Google will ask to share your sleep and activity data
          with Rested. Only people in your groups can see it. <a href="/privacy">Privacy</a> ·{" "}
          <a href="/terms">Terms</a>
        </p>
      </div>
    </main>
  );
}
