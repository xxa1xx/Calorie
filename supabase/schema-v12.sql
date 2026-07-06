-- Allow multiple insight generations per period (keep full history).
-- Drops the unique constraint so every "New Analysis" click creates a new row.
-- Safe to run more than once.
alter table weekly_insights drop constraint if exists weekly_insights_user_id_period_start_period_end_key;
