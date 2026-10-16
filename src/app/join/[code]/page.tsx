import { notFound, redirect } from "next/navigation";
import { getInvite } from "@/lib/groups";
import { getCurrentUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { joinGroup } from "@/app/actions";
import { Welcome } from "@/components/welcome";
import { SubmitButton } from "@/components/client-buttons";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const invite = await getInvite(code);
  if (!invite) notFound();

  const user = await getCurrentUser();
  if (!user) return <Welcome next={`/join/${code}`} invite={invite.name} />;
  if (!user.connected) redirect(`/connect?next=/join/${code}`);

  const [already] = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${invite.id} AND user_id = ${user.id}`;
  if (already) redirect(`/g/${invite.id}`);

  const names = invite.memberNames.map((n) => n.split(" ")[0]);
  const who =
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;

  return (
    <main className="welcome">
      <div className="emoji-tile" style={{ width: 84, height: 84, borderRadius: 20, fontSize: "2.75rem" }}>
        {invite.emoji}
      </div>
      <h1>Join {invite.name}</h1>
      <p className="lede">
        {who} {names.length === 1 ? "is" : "are"} comparing sleep and activity here. Once you join, your
        stats appear on the group&apos;s leaderboards.
      </p>
      <form action={joinGroup.bind(null, code)} className="welcome-actions">
        <SubmitButton>Join Group</SubmitButton>
        <p className="fine-print">Signed in as {user.email}</p>
      </form>
    </main>
  );
}
