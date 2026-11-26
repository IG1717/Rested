"use client";

import { useEffect, useState, useTransition } from "react";
import { setNotificationPref } from "@/app/actions";
import { usePwa } from "./pwa";
import { useToast } from "./toast";
import type { NotifyType } from "@/lib/push";

type Prefs = Record<NotifyType, boolean>;

const LABELS: { type: NotifyType; label: string; sub: string }[] = [
  { type: "passed", label: "When someone passes you", sub: "Steps today or sleep last night" },
  { type: "reactions", label: "Reactions", sub: "When a friend reacts to your stats" },
  { type: "weekly", label: "Weekly winners", sub: "Monday morning recap" },
  { type: "friends", label: "New friends", sub: "When someone adds you" },
];

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/** Turn on Web Push for this device, plus per-type switches. */
export function NotificationsCard({ vapidKey, prefs: initial }: { vapidKey: string | null; prefs: Prefs }) {
  const { standalone, platform } = usePwa();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState(initial);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhone Safari only exposes push inside the installed app.
        setStatus(platform === "ios" && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, [vapidKey, platform, standalone]);

  const enable = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey!) }));
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) throw new Error("subscribe failed");
        setStatus("on");
        toast("Notifications on");
      } catch {
        toast("Couldn't turn on notifications");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      toast("Notifications off on this device");
    });

  const flip = (type: NotifyType) => {
    const on = !prefs[type];
    setPrefs((p) => ({ ...p, [type]: on }));
    startTransition(() => setNotificationPref(type, on));
  };

  return (
    <section className="section content">
      <h2 className="section-header">Notifications</h2>
      <div className="list">
        {status === "needs-install" && (
          <div className="row">
            <div className="row-main">
              <div className="row-title wrap">Add Rested to your Home Screen first</div>
              <div className="row-sub">On iPhone, notifications only work in the installed app. Tap Share → Add to Home Screen, then open it from there.</div>
            </div>
          </div>
        )}
        {status === "unsupported" && (
          <div className="row">
            <div className="row-main row-sub">This browser doesn&apos;t support notifications.</div>
          </div>
        )}
        {status === "denied" && (
          <div className="row">
            <div className="row-main">
              <div className="row-title wrap">Notifications are blocked</div>
              <div className="row-sub">Allow them for Rested in your phone&apos;s Settings, then come back.</div>
            </div>
          </div>
        )}
        {(status === "off" || status === "loading") && (
          <button type="button" className="row tinted" onClick={enable} disabled={busy || status === "loading"}>
            <div className="row-main">Turn On Notifications</div>
            {busy && <span className="spinner" />}
          </button>
        )}
        {status === "on" &&
          LABELS.map((l) => (
            <label key={l.type} className="row switch-row">
              <div className="row-main">
                <div className="row-title">{l.label}</div>
                <div className="row-sub">{l.sub}</div>
              </div>
              <input type="checkbox" role="switch" className="switch" checked={prefs[l.type]} onChange={() => flip(l.type)} />
            </label>
          ))}
        {status === "on" && (
          <button type="button" className="row tinted" onClick={disable} disabled={busy}>
            Turn Off on This Device
          </button>
        )}
      </div>
    </section>
  );
}
