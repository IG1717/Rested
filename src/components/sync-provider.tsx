"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type SyncState = { syncing: boolean; error: string | null; syncNow: () => void };
const SyncContext = createContext<SyncState>({ syncing: false, error: null, syncNow: () => {} });

export const useSync = () => use(SyncContext);

/** Pulls fresh Google Health data when the app opens or returns to the foreground. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSyncing(true);
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            force,
          }),
        });
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? null);
        if (data.synced || data.error) router.refresh();
      } catch {
        setError("You're offline.");
      } finally {
        inFlight.current = false;
        setSyncing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const first = setTimeout(() => run(), 0);
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run]);

  const syncNow = useCallback(() => run(true), [run]);
  return <SyncContext value={{ syncing, error, syncNow }}>{children}</SyncContext>;
}

export function SyncStatus({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const { syncing, error } = useSync();
  if (syncing) {
    return (
      <p className="sync-status" role="status">
        <span className="spinner" /> Updating from Google Health…
      </p>
    );
  }
  return (
    <p className="sync-status" role="status">
      {error ?? (lastSyncedAt ? `Updated ${relative(lastSyncedAt)}` : "Waiting for first sync")}
    </p>
  );
}

function relative(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
