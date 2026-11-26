"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toggleReaction } from "@/app/actions";
import { REACTION_EMOJI, type ReactionKind } from "@/lib/reactions";

export type ReactionLite = { from: string; emoji: string };

/**
 * Emoji reactions on one item (a night, a day, a workout, a week win). Shows existing reactions
 * as chips; friends get a "+" that opens a tray. Updates instantly and reverts on failure.
 */
export function Reactions({
  toUser,
  kind,
  refKey,
  initial,
  viewerId,
  names,
}: {
  toUser: string;
  kind: ReactionKind;
  refKey: string;
  initial: ReactionLite[];
  viewerId: string;
  names: Record<string, string>;
}) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const canReact = toUser !== viewerId;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(initial);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (emoji: string) => {
    if (!canReact) return;
    const mine = list.some((r) => r.from === viewerId && r.emoji === emoji);
    const prev = list;
    const next = mine
      ? list.filter((r) => !(r.from === viewerId && r.emoji === emoji))
      : [...list, { from: viewerId, emoji }];
    setList(next);
    setOpen(false);
    navigator.vibrate?.(8);
    startTransition(async () => {
      const res = await toggleReaction(toUser, kind, refKey, emoji).catch(() => ({ ok: false as const }));
      if (!res.ok) setList(prev);
    });
  };

  const grouped = REACTION_EMOJI.map((emoji) => {
    const from = list.filter((r) => r.emoji === emoji).map((r) => r.from);
    return { emoji, from, mine: from.includes(viewerId) };
  }).filter((g) => g.from.length);

  if (!grouped.length && !canReact) return null;

  return (
    <div className="reactions" ref={wrap} onClick={(e) => e.stopPropagation()}>
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          className="reaction-chip"
          aria-pressed={g.mine}
          disabled={!canReact}
          title={g.from.map((id) => (id === viewerId ? "You" : names[id] ?? "Friend")).join(", ")}
          aria-label={`${g.emoji} from ${g.from.map((id) => (id === viewerId ? "you" : names[id] ?? "a friend")).join(", ")}`}
          onClick={() => toggle(g.emoji)}
        >
          {g.emoji}
          {g.from.length > 1 && <span className="reaction-count">{g.from.length}</span>}
        </button>
      ))}
      {canReact && (
        <button
          type="button"
          className="reaction-add"
          aria-label="Add reaction"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="9" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="6.8" cy="8.6" r="0.9" fill="currentColor" />
            <circle cx="11.2" cy="8.6" r="0.9" fill="currentColor" />
            <path d="M6.6 11.6c.6.9 1.4 1.3 2.4 1.3s1.8-.4 2.4-1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M16.5 2.5v4M14.5 4.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {open && (
        <div className="reaction-tray" role="menu">
          {REACTION_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitemcheckbox"
              aria-checked={list.some((r) => r.from === viewerId && r.emoji === emoji)}
              onClick={() => toggle(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
