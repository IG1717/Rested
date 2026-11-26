"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { ShareIcon } from "./icons";

type Platform = "ios" | "android" | "other";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type PwaState = {
  online: boolean;
  standalone: boolean;
  platform: Platform;
  installEvent: InstallEvent | null;
};

const PwaContext = createContext<PwaState>({ online: true, standalone: false, platform: "other", installEvent: null });
export const usePwa = () => use(PwaContext);

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Registers the service worker, tracks connectivity and install state, and sets the app badge. */
export function PwaProvider({ children, badge }: { children: ReactNode; badge: number }) {
  const [state, setState] = useState<PwaState>({ online: true, standalone: false, platform: "other", installEvent: null });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, online: navigator.onLine, standalone: isStandalone(), platform: detectPlatform() }));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const online = () => setState((s) => ({ ...s, online: true }));
    const offline = () => setState((s) => ({ ...s, online: false }));
    const install = (e: Event) => {
      e.preventDefault();
      setState((s) => ({ ...s, installEvent: e as InstallEvent }));
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (badge > 0) nav.setAppBadge?.(badge).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [badge]);

  return <PwaContext value={state}>{children}</PwaContext>;
}

export function OfflineBanner({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const { online } = usePwa();
  if (online) return null;
  const at = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <div className="offline-banner" role="status">
      You&apos;re offline{at ? ` · last updated ${at}` : ""}
    </div>
  );
}

const DISMISS_KEY = "rested:install-dismissed";

/** Nudges phone users to install the app, which iPhone needs for notifications. */
export function InstallBanner() {
  const { standalone, platform, installEvent } = usePwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (standalone || dismissed || platform === "other") return null;
  if (platform === "android" && !installEvent) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="content" style={{ marginBottom: 12 }}>
      <div className="install-card">
        <button type="button" className="install-close" aria-label="Dismiss" onClick={dismiss}>
          ×
        </button>
        <strong>Get the app</strong>
        {platform === "ios" ? (
          <p>
            Tap <ShareIcon className="inline-icon" /> <b>Share</b>, then <b>Add to Home Screen</b>. You&apos;ll get
            notifications when friends pass you or react.
          </p>
        ) : (
          <>
            <p>Install Rested for a full-screen app and notifications.</p>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={async () => {
                await installEvent!.prompt();
                dismiss();
              }}
            >
              Install
            </button>
          </>
        )}
      </div>
    </div>
  );
}
