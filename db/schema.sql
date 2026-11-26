-- Rested database schema (Supabase Postgres).
-- The app connects as the `postgres` role through the transaction pooler, which bypasses RLS.
-- RLS is on with no policies so the Supabase Data API (anon/authenticated keys) can't read anything.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  health_user_id text UNIQUE,
  timezone text,
  refresh_token_enc text,
  access_token_enc text,
  access_token_expires_at timestamptz,
  granted_scopes text,
  last_synced_at timestamptz,
  sync_error text,
  -- Personal friend link: /add/<invite_code>. Rotating it invalidates the old link.
  invite_code text UNIQUE NOT NULL DEFAULT substr(md5(gen_random_uuid()::text), 1, 12),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Friendships are mutual and stored in both directions, so "my friends" is one indexed lookup.
CREATE TABLE friendships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX friendships_friend_idx ON friendships(friend_id);

-- One row per user per civil date. Sleep is attributed to the date the user woke up.
CREATE TABLE daily_metrics (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  steps integer,
  azm integer,
  active_kcal integer,
  floors integer,
  distance_m real,
  workouts integer,
  workout_minutes integer,
  sleep_minutes integer,
  deep_minutes integer,
  rem_minutes integer,
  light_minutes integer,
  awake_minutes integer,
  in_bed_minutes integer,
  sleep_efficiency real,
  bedtime timestamptz,
  wake_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
CREATE INDEX daily_metrics_date_idx ON daily_metrics(date);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
