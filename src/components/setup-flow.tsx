"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShareInvite, SubmitButton } from "./client-buttons";
import { NotificationsCard } from "./notifications-card";
import { usePwa } from "./pwa";
import { ShareIcon } from "./icons";

export function SetupFlow({
  firstName,
  imported,
  inviteUrl,
  qr,
  vapidKey,
  finish,
}: {
  firstName: string;
  imported: boolean;
  inviteUrl: string;
  qr: string;
  vapidKey: string | null;
  finish: () => Promise<void>;
}) {
  const router = useRouter();
  const { standalone, platform } = usePwa();

  // Kick off the first import (if the sign-in one isn't already running) and poll until it lands.
  useEffect(() => {
    if (imported) return;
    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    }).finally(() => router.refresh());
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [imported, router]);

  return (
    <main className="welcome setup">
      <h1>Welcome, {firstName}</h1>
      <p className="lede">Three quick things and you&apos;re ready to compete.</p>

      <ol className="setup-steps">
        <li className={imported ? "done" : "active"}>
          <span className="step-num">{imported ? "✓" : <span className="spinner" />}</span>
          <div>
            <strong>{imported ? "Your data is in" : "Importing your last 3 months…"}</strong>
            <span>
              {imported
                ? "Sleep, steps and workouts from Google Health are on your leaderboard."
                : "Pulling sleep, steps and workouts from Google Health."}
            </span>
          </div>
        </li>

        <li className="active">
          <span className="step-num">2</span>
          <div>
            <strong>Add your friends</strong>
            <span>Send your link. Anyone who opens it becomes your friend on Rested.</span>
            <div className="mt-12">
              <ShareInvite url={inviteUrl} name={firstName} />
            </div>
            <div className="qr small mt-12" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code for your friend link" />
          </div>
        </li>

        <li className="active">
          <span className="step-num">3</span>
          <div>
            <strong>{standalone ? "Turn on notifications" : "Put Rested on your Home Screen"}</strong>
            {!standalone && platform === "ios" && (
              <span>
                Tap <ShareIcon className="inline-icon" /> <b>Share</b> then <b>Add to Home Screen</b>. Notifications only work
                from the installed app on iPhone.
              </span>
            )}
            {!standalone && platform !== "ios" && <span>Install it from your browser menu for a full-screen app.</span>}
            {standalone && <span>Hear when friends pass you, react, or win the week.</span>}
          </div>
        </li>
      </ol>

      {(standalone || platform !== "ios") && (
        <div className="setup-notify">
          <NotificationsCard
            vapidKey={vapidKey}
            prefs={{ reactions: true, passed: true, weekly: true, friends: true }}
          />
        </div>
      )}

      <form action={finish} className="welcome-actions">
        <SubmitButton>{imported ? "Go to Leaderboard" : "Skip for Now"}</SubmitButton>
      </form>
    </main>
  );
}
