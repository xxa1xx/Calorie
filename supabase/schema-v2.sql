-- Run this after schema.sql to add new features

-- Add GLP-1 flag to profiles
alter table profiles add column if not exists on_glp1 boolean default false;

-- Weight logs
create table if not exists weight_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  weight_kg numeric not null,
  logged_at timestamptz default now()
);

create index if not exists weight_logs_user_date_idx on weight_logs(user_id, date);

alter table weight_logs enable row level security;

create policy "Users can view own weight logs"
  on weight_logs for select using (auth.uid() = user_id);
create policy "Users can insert own weight logs"
  on weight_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own weight logs"
  on weight_logs for update using (auth.uid() = user_id);
create policy "Users can delete own weight logs"
  on weight_logs for delete using (auth.uid() = user_id);

-- Favourites (quick-log saved meals)
create table if not exists favorites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  calories integer not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric default 0,
  items jsonb default '[]',
  use_count integer default 1,
  last_used timestamptz default now()
);

create unique index if not exists favorites_user_desc_idx on favorites(user_id, description);
create index if not exists favorites_user_count_idx on favorites(user_id, use_count desc);

alter table favorites enable row level security;

create policy "Users can view own favorites"
  on favorites for select using (auth.uid() = user_id);
create policy "Users can insert own favorites"
  on favorites for insert with check (auth.uid() = user_id);
create policy "Users can update own favorites"
  on favorites for update using (auth.uid() = user_id);
create policy "Users can delete own favorites"
  on favorites for delete using (auth.uid() = user_id);

-- Water logs (one row per user per day, upserted)
create table if not exists water_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  glasses integer not null default 0,
  updated_at timestamptz default now()
);

create unique index if not exists water_logs_user_date_idx on water_logs(user_id, date);

alter table water_logs enable row level security;

create policy "Users can view own water logs"
  on water_logs for select using (auth.uid() = user_id);
create policy "Users can insert own water logs"
  on water_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own water logs"
  on water_logs for update using (auth.uid() = user_id);
