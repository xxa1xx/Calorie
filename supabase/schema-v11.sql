-- Add craving coach usage tracking to ai_usage table
alter table ai_usage add column if not exists craving_count integer not null default 0;
