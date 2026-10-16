import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MoonIcon, WalkIcon } from "@/components/icons";

// Shown when someone signed in but unticked the Google Health permissions, or their access lapsed.
export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  if (user.connected) redirect(next);

  return (
    <main className="welcome">
      <h1>Connect Google Health</h1>
      <p className="lede">
        {sp.missing
          ? "Rested needs both permissions on Google's screen to build your leaderboards. Nothing else is shared."
          : user.syncError ?? "Rested lost access to your Google Health data. Reconnect to keep competing."}
      </p>
      <ul className="features">
        <li>
          <MoonIcon className="ficon" />
          <div>
            <strong>Sleep</strong>
            <span>Sleep sessions and stages, to rank sleep.</span>
          </div>
        </li>
        <li>
          <WalkIcon className="ficon" />
          <div>
            <strong>Activity &amp; fitness</strong>
            <span>Steps, Zone Minutes, workouts, calories, distance and floors.</span>
          </div>
        </li>
      </ul>
      <div className="welcome-actions">
        <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">
          Connect
        </a>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="btn btn-plain">
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}
