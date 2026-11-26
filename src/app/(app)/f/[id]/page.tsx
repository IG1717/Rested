import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCircle, getMetrics, getNights, getReactions, getWorkouts } from "@/lib/friends";
import { sql } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { NavBar } from "@/components/nav-bar";
import { PageTransition } from "@/components/page-transition";
import { ProfileView } from "@/components/profile-view";

const HISTORY_DAYS = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfilePage({ params }: PageProps<"/f/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/f/${id}`);
  if (!UUID.test(id)) notFound();
  const people = await getCircle(user.id);
  // Only you and your friends: getCircle is exactly that set.
  const person = people.find((p) => p.id === id);
  if (!person) notFound();
  const isMe = id === user.id;

  const [{ timezone }] = await sql`SELECT timezone FROM users WHERE id = ${user.id}`;
  const today = todayIn(timezone);
  const earliest = addDays(today, -HISTORY_DAYS);
  const [rows, nights, workouts] = await Promise.all([
    getMetrics(isMe ? [id] : [user.id, id], earliest),
    getNights(id, 14),
    getWorkouts(id, 12),
  ]);
  const reactions = await getReactions([id], [...nights.map((n) => n.date), ...workouts.map((w) => w.id)]);

  const me = people[0];
  const strip = (p: typeof person) => ({ id: p.id, name: p.short, avatarUrl: p.avatarUrl, slot: p.slot });

  return (
    <PageTransition>
      <NavBar title={isMe ? "Your Profile" : person.short} back={isMe ? { href: "/me", label: "You" } : { href: "/", label: "Leaderboard" }} />
      <ProfileView
        person={{ ...strip(person), fullName: person.name, lastSyncedAt: person.lastSyncedAt, since: person.since }}
        viewer={strip(me)}
        isMe={isMe}
        rows={rows}
        nights={nights}
        workouts={workouts}
        reactions={reactions}
        today={today}
        earliest={earliest}
      />
    </PageTransition>
  );
}
