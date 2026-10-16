"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { newInviteCode } from "@/lib/groups";
import { destroySession, requireUser } from "@/lib/session";

export async function createGroup(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const emoji = String(formData.get("emoji") ?? "🏆").slice(0, 8) || "🏆";
  if (!name) return;
  const [g] = await sql`
    INSERT INTO groups (name, emoji, invite_code, created_by)
    VALUES (${name}, ${emoji}, ${newInviteCode()}, ${user.id}) RETURNING id`;
  await sql`INSERT INTO group_members (group_id, user_id, role) VALUES (${g.id}, ${user.id}, 'owner')`;
  redirect(`/g/${g.id}`);
}

export async function joinGroup(code: string) {
  const user = await requireUser(`/join/${code}`);
  const [g] = await sql`SELECT id FROM groups WHERE invite_code = ${code}`;
  if (!g) redirect("/");
  await sql`
    INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${user.id})
    ON CONFLICT DO NOTHING`;
  redirect(`/g/${g.id}`);
}

export async function leaveGroup(groupId: string) {
  const user = await requireUser();
  const [m] = await sql`
    DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${user.id} RETURNING role`;
  if (m?.role === "owner") {
    // Hand the group to the longest-standing member, or remove it if nobody is left.
    const [next] = await sql`
      UPDATE group_members SET role = 'owner'
      WHERE (group_id, user_id) = (
        SELECT group_id, user_id FROM group_members WHERE group_id = ${groupId}
        ORDER BY joined_at LIMIT 1)
      RETURNING user_id`;
    if (!next) await sql`DELETE FROM groups WHERE id = ${groupId}`;
  }
  revalidatePath("/");
  redirect("/");
}

export async function renameGroup(groupId: string, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const emoji = String(formData.get("emoji") ?? "").slice(0, 8);
  if (!name) return;
  await sql`
    UPDATE groups SET name = ${name}, emoji = COALESCE(NULLIF(${emoji}, ''), emoji)
    WHERE id = ${groupId} AND EXISTS (
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${user.id})`;
  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}/members`);
}

export async function resetInvite(groupId: string) {
  const user = await requireUser();
  await sql`
    UPDATE groups SET invite_code = ${newInviteCode()}
    WHERE id = ${groupId} AND EXISTS (
      SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${user.id} AND role = 'owner')`;
  revalidatePath(`/g/${groupId}/members`);
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
  // Groups this user owns pass to the next member; empty groups go away.
  const owned = await sql`SELECT group_id FROM group_members WHERE user_id = ${user.id} AND role = 'owner'`;
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  for (const { group_id } of owned) {
    const [next] = await sql`
      UPDATE group_members SET role = 'owner'
      WHERE (group_id, user_id) = (
        SELECT group_id, user_id FROM group_members WHERE group_id = ${group_id}
        ORDER BY joined_at LIMIT 1)
      RETURNING user_id`;
    if (!next) await sql`DELETE FROM groups WHERE id = ${group_id}`;
  }
  await destroySession();
  redirect("/");
}
