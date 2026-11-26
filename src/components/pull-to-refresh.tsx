"use client";

import { useEffect, useRef, useState } from "react";
import { useSync } from "./sync-provider";
import { usePwa } from "./pwa";

const TRIGGER = 72;

/**
 * Pull down at the top of the page to sync. Only in the installed app: Safari and Chrome tabs
 * already reload on pull, and two gestures would fight.
 */
export function PullToRefresh() {
  const { standalone } = usePwa();
  const { syncing, syncNow } = useSync();
  const [pull, setPull] = useState(0);
  const start = useRef<{ y: number; x: number } | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!standalone) return;
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 ? { y: e.touches[0].clientY, x: e.touches[0].clientX } : null;
    };
    const move = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (dy <= 0 || dx > dy) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(120, dy * 0.5);
      setPull(pullRef.current);
    };
    const up = () => {
      if (pullRef.current >= TRIGGER * 0.75) syncNow();
      start.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [standalone, syncNow]);

  const visible = pull > 4 || syncing;
  if (!standalone || !visible) return null;
  const ready = pull >= TRIGGER * 0.75;
  return (
    <div className="ptr" style={{ transform: `translateY(${syncing ? 12 : pull * 0.6}px)` }} aria-hidden>
      <span className={`ptr-dot${syncing ? " spinning" : ""}`} style={{ opacity: syncing ? 1 : Math.min(1, pull / TRIGGER), rotate: `${pull * 3}deg` }}>
        {syncing || ready ? <span className="spinner" /> : "↓"}
      </span>
    </div>
  );
}
