-- Run after schema-v3.sql

-- Recipes (ingredients stored as JSONB for simplicity)
create table if not exists recipes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  servings numeric default 1 check (servings > 0),
  ingredients jsonb default '[]',
  calories_per_serving integer not null default 0,
  protein_per_serving numeric default 0,
  carbs_per_serving numeric default 0,
  fat_per_serving numeric default 0,
  fiber_per_serving numeric default 0,
  created_at timestamptz default now()
);

create index if not exists recipes_user_id_idx on recipes(user_id);
alter table recipes enable row level security;

create policy "Users can view own recipes" on recipes for select using (auth.uid() = user_id);
create policy "Users can insert own recipes" on recipes for insert with check (auth.uid() = user_id);
create policy "Users can update own recipes" on recipes for update using (auth.uid() = user_id);
create policy "Users can delete own recipes" on recipes for delete using (auth.uid() = user_id);

-- Daily metadata: mood, notes, workout day
create table if not exists daily_meta (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  is_workout_day boolean default false,
  mood smallint check (mood between 1 and 5),
  notes text,
  updated_at timestamptz default now()
);

create unique index if not exists daily_meta_user_date_idx on daily_meta(user_id, date);
alter table daily_meta enable row level security;

create policy "Users can view own daily meta" on daily_meta for select using (auth.uid() = user_id);
create policy "Users can insert own daily meta" on daily_meta for insert with check (auth.uid() = user_id);
create policy "Users can update own daily meta" on daily_meta for update using (auth.uid() = user_id);

-- Workout calorie bonus on profiles (extra kcal on workout days)
alter table profiles add column if not exists workout_calorie_bonus integer default 200;
