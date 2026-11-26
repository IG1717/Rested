import { notFound, redirect } from "next/navigation";
import { areFriends, getInviter } from "@/lib/friends";
import { getCurrentUser } from "@/lib/session";
import { addFriend } from "@/app/actions";
import { Welcome } from "@/components/welcome";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/client-buttons";

export default async function AddFriendPage({ params }: PageProps<"/add/[code]">) {
  const { code } = await params;
  const inviter = await getInviter(code);
  if (!inviter) notFound();
  const first = inviter.name.split(" ")[0];

  const user = await getCurrentUser();
  if (!user) return <Welcome next={`/add/${code}`} invite={first} />;
  if (!user.connected) redirect(`/connect?next=/add/${code}`);
  if (inviter.id === user.id) redirect("/friends");
  if (await areFriends(user.id, inviter.id)) redirect("/");

  return (
    <main className="welcome">
      <Avatar name={inviter.name} url={inviter.avatarUrl} size="lg" slot={1} />
      <h1>Add {first} as a friend?</h1>
      <p className="lede">
        You&apos;ll see each other&apos;s sleep and activity stats on your leaderboards. Either of you can remove
        the other at any time.
      </p>
      <form action={addFriend.bind(null, code)} className="welcome-actions">
        <SubmitButton>Add {first}</SubmitButton>
        <p className="fine-print">Signed in as {user.email}</p>
      </form>
    </main>
  );
}
