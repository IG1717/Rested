"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { areFriends, newInviteCode } from "@/lib/friends";
import { validReactionTarget, type ReactionKind } from "@/lib/reactions";
import { notify, type NotifyType } from "@/lib/push";
import { formatDuration, metricByKey, type MetricKey } from "@/lib/metrics";
import { destroySession, requireUser } from "@/lib/session";

const firstName = (u: { name: string; nickname?: string | null }) => u.nickname?.trim() || u.name.split(" ")[0];

/** Accept someone's friend link. Friendships are mutual, so both directions are written. */
export async function addFriend(code: string) {
  const user = await requireUser(`/add/${code}`);
  const [inviter] = await sql`SELECT id FROM users WHERE invite_code = ${code}`;
  if (!inviter || inviter.id === user.id) redirect("/friends");
  await sql`
    INSERT INTO friendships (user_id, friend_id)
    VALUES (${user.id}, ${inviter.id}), (${inviter.id}, ${user.id})
    ON CONFLICT DO NOTHING`;
  after(() =>
    notify(
      inviter.id,
      "friends",
      { title: `${firstName(user)} added you`, body: "You can now see each other's sleep and activity.", url: `/f/${user.id}` },
      `friend:${user.id}`,
    ),
  );
  revalidatePath("/");
  redirect("/");
}

export async function removeFriend(friendId: string) {
  const user = await requireUser();
  await sql`
    DELETE FROM friendships
    WHERE (user_id = ${user.id} AND friend_id = ${friendId})
       OR (user_id = ${friendId} AND friend_id = ${user.id})`;
  revalidatePath("/");
  revalidatePath("/friends");
}

export async function resetInvite() {
  const user = await requireUser();
  await sql`UPDATE users SET invite_code = ${newInviteCode()} WHERE id = ${user.id}`;
  revalidatePath("/friends");
}

/** Adds or removes one emoji on a friend's night, day, workout or week. Returns the new state. */
export async function toggleReaction(toUser: string, kind: ReactionKind, ref: string, emoji: string) {
  const user = await requireUser();
  if (
    toUser === user.id ||
    !validReactionTarget(kind, ref, emoji) ||
    !(await areFriends(user.id, toUser))
  ) {
    return { ok: false as const };
  }
  const [removed] = await sql`
    DELETE FROM reactions
    WHERE from_user = ${user.id} AND to_user = ${toUser} AND kind = ${kind} AND ref = ${ref} AND emoji = ${emoji}
    RETURNING 1 AS ok`;
  if (removed) return { ok: true as const, on: false };
  await sql`
    INSERT INTO reactions (from_user, to_user, kind, ref, emoji)
    VALUES (${user.id}, ${toUser}, ${kind}, ${ref}, ${emoji}) ON CONFLICT DO NOTHING`;
  after(() => reactionPush(user, toUser, kind, ref, emoji));
  return { ok: true as const, on: true };
}

async function reactionPush(
  from: { id: string; name: string },
  toUser: string,
  kind: ReactionKind,
  ref: string,
  emoji: string,
) {
  const [nick] = await sql`SELECT nickname FROM users WHERE id = ${from.id}`;
  const who = firstName({ name: from.name, nickname: nick?.nickname });
  let what = "your stats";
  let url = `/f/${toUser}`;
  if (kind === "night") {
    const [d] = await sql`SELECT sleep_minutes FROM daily_metrics WHERE user_id = ${toUser} AND date = ${ref}::date`;
    what = d?.sleep_minutes ? `your ${formatDuration(d.sleep_minutes)} night` : "your night";
  } else if (kind === "day") {
    const [d] = await sql`SELECT steps FROM daily_metrics WHERE user_id = ${toUser} AND date = ${ref}::date`;
    what = d?.steps ? `your ${Number(d.steps).toLocaleString("en-US")} steps` : "your day";
  } else if (kind === "workout") {
    const [w] = await sql`SELECT display_name FROM workouts WHERE id = ${ref}::uuid AND user_id = ${toUser}`;
    what = w?.display_name ? `your ${w.display_name.toLowerCase()}` : "your workout";
  } else {
    const [week, key] = ref.split(":");
    const label = metricByKey[key as MetricKey]?.label;
    what = label ? `your ${label} win` : "your week";
    url = `/week/${week}`;
  }
  await notify(
    toUser,
    "reactions",
    { title: `${who} ${emoji}`, body: `${who} reacted ${emoji} to ${what}.`, url, tag: `reaction-${from.id}-${kind}-${ref}` },
    `reaction:${from.id}:${kind}:${ref}:${emoji}`,
  );
}

export async function markReactionsSeen() {
  const user = await requireUser();
  await sql`UPDATE users SET reactions_seen_at = now() WHERE id = ${user.id}`;
}

export async function saveNickname(formData: FormData) {
  const user = await requireUser();
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 24);
  await sql`UPDATE users SET nickname = ${nickname || null} WHERE id = ${user.id}`;
  revalidatePath("/", "layout");
}

const PREFS: Record<NotifyType, true> = { reactions: true, passed: true, weekly: true, friends: true };

export async function setNotificationPref(type: NotifyType, on: boolean) {
  const user = await requireUser();
  if (!Object.hasOwn(PREFS, type)) return;
  const v = !!on;
  if (type === "reactions") await sql`UPDATE users SET notify_reactions = ${v} WHERE id = ${user.id}`;
  if (type === "passed") await sql`UPDATE users SET notify_passed = ${v} WHERE id = ${user.id}`;
  if (type === "weekly") await sql`UPDATE users SET notify_weekly = ${v} WHERE id = ${user.id}`;
  if (type === "friends") await sql`UPDATE users SET notify_friends = ${v} WHERE id = ${user.id}`;
}

export async function finishOnboarding() {
  const user = await requireUser();
  await sql`UPDATE users SET onboarded_at = COALESCE(onboarded_at, now()) WHERE id = ${user.id}`;
  redirect("/");
}

export async function deleteAccount() {
  const user = await requireUser();
  const [u] = await sql`SELECT refresh_token_enc FROM users WHERE id = ${user.id}`;
  if (u?.refresh_token_enc) {
    // Revoke our Google access too, so nothing keeps syncing.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decrypt(u.refresh_token_enc) }),
    }).catch(() => {});
  }
  // Friendships and daily metrics cascade.
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  await destroySession();
  redirect("/");
}
