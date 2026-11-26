"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { newInviteCode } from "@/lib/friends";
import { destroySession, requireUser } from "@/lib/session";

/** Accept someone's friend link. Friendships are mutual, so both directions are written. */
export async function addFriend(code: string) {
  const user = await requireUser(`/add/${code}`);
  const [inviter] = await sql`SELECT id FROM users WHERE invite_code = ${code}`;
  if (!inviter || inviter.id === user.id) redirect("/friends");
  await sql`
    INSERT INTO friendships (user_id, friend_id)
    VALUES (${user.id}, ${inviter.id}), (${inviter.id}, ${user.id})
    ON CONFLICT DO NOTHING`;
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
