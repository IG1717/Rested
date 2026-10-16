import "server-only";
import { addDays } from "./dates";

// Google Health API v4 client. Only the calls Rested needs.
// Reference: https://developers.google.com/health/reference/rest

const BASE = "https://health.googleapis.com/v4/users/me";

export type CivilDateTime = {
  date: { year: number; month: number; day: number };
  time?: { hours?: number; minutes?: number; seconds?: number };
};

export function civilDate(c: CivilDateTime): string {
  const { year, month, day } = c.date;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toCivil(date: string): CivilDateTime {
  const [year, month, day] = date.split("-").map(Number);
  return { date: { year, month, day }, time: { hours: 0, minutes: 0, seconds: 0 } };
}

export class HealthApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Google Health API ${status}: ${body.slice(0, 300)}`);
  }
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new HealthApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export function getIdentity(token: string) {
  return call<{ healthUserId: string; legacyUserId?: string }>(token, "/identity");
}

export type DailyRollup = {
  civilStartTime: CivilDateTime;
  steps?: { countSum?: string };
  distance?: { millimetersSum?: string };
  floors?: { countSum?: string };
  activeEnergyBurned?: { kcalSum?: number };
  activeZoneMinutes?: {
    sumInFatBurnHeartZone?: string;
    sumInCardioHeartZone?: string;
    sumInPeakHeartZone?: string;
  };
};

/** Daily totals for [from, to] inclusive (max 90 days). */
export async function dailyRollUp(token: string, dataType: string, from: string, to: string) {
  const out: DailyRollup[] = [];
  let pageToken: string | undefined;
  do {
    const res = await call<{ rollupDataPoints?: DailyRollup[]; nextPageToken?: string }>(
      token,
      `/dataTypes/${dataType}/dataPoints:dailyRollUp`,
      {
        method: "POST",
        body: JSON.stringify({
          range: { start: toCivil(from), end: toCivil(addDays(to, 1)) },
          windowSizeDays: 1,
          pageToken,
        }),
      },
    );
    out.push(...(res.rollupDataPoints ?? []));
    pageToken = res.nextPageToken || undefined;
  } while (pageToken);
  return out;
}

type SessionInterval = {
  startTime: string;
  endTime: string;
  civilStartTime: CivilDateTime;
  civilEndTime: CivilDateTime;
};

export type SleepSession = {
  interval: SessionInterval;
  type?: "CLASSIC" | "STAGES" | "SLEEP_TYPE_UNSPECIFIED";
  metadata?: { mainSleep?: boolean; nap?: boolean; processed?: boolean };
  summary?: {
    minutesAsleep?: string;
    minutesAwake?: string;
    minutesInSleepPeriod?: string;
    stagesSummary?: { type: string; minutes?: string; count?: string }[];
  };
};

export type ExerciseSession = {
  interval: SessionInterval;
  activeDuration?: string; // e.g. "1830s"
  displayName?: string;
};

async function reconcileAll<T>(token: string, dataType: string, filter: string, pageSize: number) {
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    // Percent-encode (spaces as %20, not "+") so the AIP-160 filter reaches the API verbatim.
    let query = `filter=${encodeURIComponent(filter)}&pageSize=${pageSize}`;
    if (pageToken) query += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await call<{ dataPoints?: T[]; nextPageToken?: string }>(
      token,
      `/dataTypes/${dataType}/dataPoints:reconcile?${query}`,
    );
    out.push(...(res.dataPoints ?? []));
    pageToken = res.nextPageToken || undefined;
  } while (pageToken);
  return out;
}

/** Sleep sessions that ended (civil time) on a date in [from, to]. */
export async function listSleep(token: string, from: string, to: string) {
  const filter = `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${addDays(to, 1)}"`;
  const points = await reconcileAll<{ sleep?: SleepSession }>(token, "sleep", filter, 25);
  return points.flatMap((p) => (p.sleep ? [p.sleep] : []));
}

/** Exercise sessions that started (civil time) on a date in [from, to]. */
export async function listExercise(token: string, from: string, to: string) {
  const filter = `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${addDays(to, 1)}"`;
  const points = await reconcileAll<{ exercise?: ExerciseSession }>(token, "exercise", filter, 25);
  return points.flatMap((p) => (p.exercise ? [p.exercise] : []));
}
