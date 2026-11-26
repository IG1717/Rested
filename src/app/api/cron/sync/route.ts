import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { syncUser } from "@/lib/sync";
import { getCircle, getMetrics } from "@/lib/friends";
import { awardSummary, weeklyAwards } from "@/lib/awards";
import { addDays, startOfWeek, todayIn } from "@/lib/dates";
import { notify } from "@/lib/push";

// Daily safety net in case webhooks were missed (Vercel Cron, see vercel.json). On each user's
// local Monday it also sends the "who won last week" recap.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(null, { status: 401 });
  }
  const users = await sql`SELECT id, timezone FROM users WHERE refresh_token_enc IS NOT NULL`;
  let ok = 0;
  for (const u of users) {
    const r = await syncUser(u.id);
    if (r.ok) ok++;
  }

  let recaps = 0;
  for (const u of users) {
    const today = todayIn(u.timezone);
    if (startOfWeek(today) !== today) continue; // not Monday where they live
    try {
      if (await sendWeeklyRecap(u.id, addDays(today, -7))) recaps++;
    } catch (e) {
      console.error("weekly recap failed", u.id, e);
    }
  }
  return NextResponse.json({ users: users.length, ok, recaps });
}

async function sendWeeklyRecap(userId: string, weekStart: string) {
  const people = await getCircle(userId);
  if (people.length < 2) return false;
  const rows = await getMetrics(people.map((p) => p.id), weekStart);
  const awards = weeklyAwards(rows, people.map((p) => p.id), weekStart);
  const { won, total, sleep, steps } = awardSummary(awards, userId);
  if (!total) return false;

  const short = new Map(people.map((p) => [p.id, p.id === userId ? "you" : p.short]));
  const who = (ids: string[] | undefined) =>
    ids?.length ? ids.map((id) => short.get(id)).join(" & ") : null;
  const parts = [
    who(sleep?.winners) && `${cap(who(sleep?.winners)!)} won Sleep`,
    who(steps?.winners) && `${who(steps?.winners)} won Steps`,
  ].filter(Boolean);
  const body = `${parts.join(", ")}. You took ${won} of ${total} categories.`;
  await notify(
    userId,
    "weekly",
    { title: won ? `You won ${won} ${won === 1 ? "category" : "categories"} last week 🏆` : "Last week's winners are in", body, url: `/week/${weekStart}`, tag: "weekly" },
    `weekly:${weekStart}`,
  );
  return true;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
