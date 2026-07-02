-- Persist weekly AI insights so they survive refreshes and can be compared over time.
-- Safe to run more than once.

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
