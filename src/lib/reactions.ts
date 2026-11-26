// Shared by client and server.
export const REACTION_EMOJI = ["🔥", "👏", "💪", "😴", "😂", "👀"] as const;

export type ReactionKind = "night" | "day" | "workout" | "week";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A week win: the Monday plus the metric, e.g. "2026-11-17:steps".
const WEEK = /^\d{4}-\d{2}-\d{2}:[a-zA-Z]{2,24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nights and days are keyed by date, week wins by "monday:metric", workouts by id. */
export function validReactionTarget(kind: string, ref: string, emoji: string): kind is ReactionKind {
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) return false;
  if (kind === "workout") return UUID.test(ref);
  if (kind === "week") return WEEK.test(ref);
  return (kind === "night" || kind === "day") && DATE.test(ref);
}
