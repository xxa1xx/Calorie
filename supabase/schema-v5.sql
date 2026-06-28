-- Run after schema-v4.sql

-- Fasting timer support on daily_meta
ALTER TABLE daily_meta ADD COLUMN IF NOT EXISTS fast_started_at timestamptz;
ALTER TABLE daily_meta ADD COLUMN IF NOT EXISTS fast_target_hours numeric DEFAULT 16;

-- Email summary preference on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_summary boolean DEFAULT false;
