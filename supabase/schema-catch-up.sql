-- Catch-up migration: covers schema-v7 through schema-v12
-- Safe to run even if some or all of these have already been applied.
-- Run this once in the Supabase SQL Editor to bring your database fully up to date.

-- v7: weekly weight loss rate preference
alter table profiles add column if not exists weekly_loss_lbs numeric default 1.0;

-- v9: recreate all delete policies (idempotent)
drop policy if exists "Users can delete own food logs" on food_logs;
create policy "Users can delete own food logs"
  on food_logs for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on favorites;
create policy "Users can delete own favorites"
  on favorites for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own weight logs" on weight_logs;
create policy "Users can delete own weight logs"
  on weight_logs for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own daily meta" on daily_meta;
create policy "Users can delete own daily meta"
  on daily_meta for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own water logs" on water_logs;
create policy "Users can delete own water logs"
  on water_logs for delete
  using (auth.uid() = user_id);

-- v10: weekly insights cache table
create table if not exists weekly_insights (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  analysis jsonb not null default '{}'::jsonb,
  source_summary jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists weekly_insights_user_period_idx
  on weekly_insights(user_id, period_end desc);

alter table weekly_insights enable row level security;

drop policy if exists "Users can view own weekly insights" on weekly_insights;
create policy "Users can view own weekly insights"
  on weekly_insights for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own weekly insights" on weekly_insights;
create policy "Users can insert own weekly insights"
  on weekly_insights for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own weekly insights" on weekly_insights;
create policy "Users can update own weekly insights"
  on weekly_insights for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own weekly insights" on weekly_insights;
create policy "Users can delete own weekly insights"
  on weekly_insights for delete
  using (auth.uid() = user_id);

-- v11: craving coach usage tracking
alter table ai_usage add column if not exists craving_count integer not null default 0;

-- v12: allow multiple insight generations per period (full history)
alter table weekly_insights drop constraint if exists weekly_insights_user_id_period_start_period_end_key;
