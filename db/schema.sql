-- Rested database schema (Neon Postgres). Applied to project "rested" (icy-morning-75597342).

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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🏆',
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members(user_id);

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
  sleep_score integer, -- unused since 2026-10-16 (calculated score removed); safe to drop
  bedtime timestamptz,
  wake_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
CREATE INDEX daily_metrics_date_idx ON daily_metrics(date);
