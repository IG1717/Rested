-- Richer sleep data, workouts, reactions, web push, and per-user settings.

ALTER TABLE daily_metrics
  ADD COLUMN fall_asleep_minutes integer,
  ADD COLUMN nap_minutes integer,
  -- Local clock times of the main sleep: bedtime as minutes after the previous noon
  -- (so 23:00 = 660 and 01:00 = 780 average sensibly), wake as minutes after midnight.
  ADD COLUMN bed_clock_min integer,
  ADD COLUMN wake_clock_min integer,
  -- Hypnogram: [[startOffsetMin, durationMin, "DEEP"|"REM"|"LIGHT"|"AWAKE"|...], ...]
  ADD COLUMN sleep_stages jsonb;

ALTER TABLE daily_metrics DROP COLUMN IF EXISTS sleep_score;

ALTER TABLE users
  ADD COLUMN nickname text,
  ADD COLUMN onboarded_at timestamptz,
  ADD COLUMN last_activity_sync_at timestamptz,
  ADD COLUMN reactions_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN notify_reactions boolean NOT NULL DEFAULT true,
  ADD COLUMN notify_passed boolean NOT NULL DEFAULT true,
  ADD COLUMN notify_weekly boolean NOT NULL DEFAULT true,
  ADD COLUMN notify_friends boolean NOT NULL DEFAULT true;

-- One row per exercise session.
CREATE TABLE workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  local_date date NOT NULL,
  exercise_type text,
  display_name text,
  duration_min integer NOT NULL,
  kcal integer,
  distance_m real,
  steps integer,
  avg_hr integer,
  azm integer,
  UNIQUE (user_id, start_time)
);
CREATE INDEX workouts_user_date_idx ON workouts(user_id, local_date);

-- Emoji reactions to a friend's night, day, workout or week.
-- ref: a date (night/day), a workout id, or a week's Monday.
CREATE TABLE reactions (
  from_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('night', 'day', 'workout', 'week')),
  ref text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_user, to_user, kind, ref, emoji),
  CHECK (from_user <> to_user)
);
CREATE INDEX reactions_to_idx ON reactions(to_user, created_at DESC);
CREATE INDEX reactions_target_idx ON reactions(to_user, kind, ref);

CREATE TABLE push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions(user_id);

-- Dedupe for notifications that must only go out once (e.g. "passed you" per day).
CREATE TABLE notification_log (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE workouts OWNER TO rested_app;
ALTER TABLE reactions OWNER TO rested_app;
ALTER TABLE push_subscriptions OWNER TO rested_app;
ALTER TABLE notification_log OWNER TO rested_app;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workouts, reactions, push_subscriptions, notification_log FROM anon, authenticated;
