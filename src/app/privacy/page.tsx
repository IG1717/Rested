import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy · Rested" };

const UPDATED = "October 16, 2026";

export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main className="doc">
      <Link href="/" className="doc-back">
        ‹ Rested
      </Link>
      <h1>Privacy Policy</h1>
      <p className="doc-meta">Last updated {UPDATED}</p>

      <p>
        Rested is a small, invite-only app for friends to compare sleep and activity stats from Google Health. This
        policy explains what Rested reads, what it stores, and who can see it.
      </p>

      <h2>What we access</h2>
      <p>When you sign in with Google, Rested asks for:</p>
      <ul>
        <li>
          <strong>Your basic Google profile</strong>: name, email address and profile photo, used to identify you
          to the friends in your groups.
        </li>
        <li>
          <strong>Google Health sleep data</strong> (read-only): sleep sessions, sleep stages and time in bed.
        </li>
        <li>
          <strong>Google Health activity and fitness data</strong> (read-only): steps, distance, floors, active
          calories, Active Zone Minutes and exercise sessions.
        </li>
      </ul>
      <p>Rested never writes to your Google Health data and does not request any other health data.</p>

      <h2>What we store</h2>
      <p>
        Rested stores one summary row per day: totals such as steps and Zone Minutes, and nightly sleep figures such
        as time asleep, deep and REM minutes, and a computed Sleep Score. It also stores your groups and an
        encrypted Google access token so it can keep your stats up to date. Raw minute-by-minute data is not kept.
        Data is held in a Neon Postgres database and served by Vercel, both in the United States.
      </p>

      <h2>Who can see it</h2>
      <p>
        Your stats are visible only to members of the groups you join. Anyone with a group&apos;s invite link can
        join that group, so share links only with people you want to compete with. Rested does not sell your data,
        show ads, or share data with anyone else.
      </p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        Rested&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Google user data is used only to show you and your group members
        the leaderboards and trends in the app. It is not used for advertising, is not sold, is not used to train
        AI or machine-learning models, and is not read by humans except where you ask for help, for security
        purposes, or where the law requires it.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Go to <strong>You → Delete My Account</strong> at any time. This immediately deletes your account and
        every stat Rested stored about you, and revokes Rested&apos;s access to your Google account. You can also
        revoke access yourself at{" "}
        <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.
      </p>

      <h2>Contact</h2>
      <p>
        {contact ? (
          <>
            Questions? Email <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        ) : (
          <>Questions? Contact the person who invited you to Rested.</>
        )}
      </p>
    </main>
  );
}
