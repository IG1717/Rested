# Rested

Friendly sleep and activity leaderboards for friends who wear Fitbit / Google trackers.
Google Health only lets you compare steps and cardio load. Rested adds sleep, Zone Minutes,
workouts, calories, distance and floors.

It's an installable web app (PWA): open it in Safari or Chrome and **Add to Home Screen**.
No App Store needed.

## How it works

- **Sign in with Google** requests read-only Google Health scopes for sleep and activity/fitness.
- **Sync**: the [Google Health API](https://developers.google.com/health) pushes webhook
  notifications to `/api/webhooks/google-health` when new data lands. The app also syncs when opened,
  and a daily Vercel Cron job (`/api/cron/sync`) catches anything missed. Each sync rolls the data up
  into one `daily_metrics` row per person per day.
- **Groups** are invite-link based. Everyone in a group sees everyone's stats.
- **Sleep Score** (0–100) is computed in `src/lib/sleep-score.ts`: duration 50, deep + REM share 25,
  efficiency 25. Sleep counts toward the day you woke up.

## Stack

Next.js 16 (App Router) on Vercel · Neon Postgres (`db/schema.sql`) · Google OAuth + Google Health API v4.

## Local development

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Add `http://localhost:3000/api/auth/callback` as an authorized redirect URI on the OAuth client.

## Google Cloud setup (one time)

1. Create a Cloud project and enable the **Google Health API** (`health.googleapis.com`).
2. Google Auth Platform → Branding/Audience: **External**. Add the two scopes
   `googlehealth.sleep.readonly` and `googlehealth.activity_and_fitness.readonly`.
3. Create an OAuth **Web** client. Redirect URI: `https://<your-domain>/api/auth/callback`.
4. Set the publishing status to **In production**. In "Testing" mode, Google expires refresh tokens after
   7 days. The app stays unverified, so it's capped at 100 users and people see an
   "unverified app" notice once when they sign in.
5. Register the webhook subscriber (needs the project **number**):

```bash
curl -X POST "https://health.googleapis.com/v4/projects/$PROJECT_NUMBER/subscribers?subscriberId=rested-webhooks" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \
  -d '{
    "endpointUri": "https://<your-domain>/api/webhooks/google-health",
    "endpointAuthorization": { "secret": "Bearer '"$WEBHOOK_SECRET"'" },
    "subscriberConfigs": [{
      "dataTypes": ["sleep","steps","distance","floors","active-zone-minutes","exercise"],
      "subscriptionCreatePolicy": "AUTOMATIC"
    }]
  }'
```
