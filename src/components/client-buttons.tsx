"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSync } from "./sync-provider";

/** Share sheet on phones, clipboard elsewhere. */
export function ShareInvite({ url, groupName }: { url: string; groupName: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={async () => {
        const data = { title: `Join ${groupName} on Rested`, text: `Compete with me on sleep and activity in ${groupName}.`, url };
        if (navigator.share && navigator.canShare?.(data)) {
          try {
            await navigator.share(data);
            return;
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {}
      }}
    >
      {copied ? "Link Copied" : "Share Invite Link"}
    </button>
  );
}

/** Two-tap confirmation in place of a modal dialog. The second tap submits the surrounding form. */
export function ConfirmSubmit({ label, confirmLabel }: { label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type={armed ? "submit" : "button"}
      className="row destructive"
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {pending ? "Working…" : armed ? confirmLabel : label}
    </button>
  );
}

export function SyncNowButton() {
  const { syncing, syncNow } = useSync();
  return (
    <button type="button" className="row tinted" onClick={syncNow} disabled={syncing}>
      <div className="row-main">{syncing ? "Syncing…" : "Sync Now"}</div>
      {syncing && <span className="spinner" />}
    </button>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
