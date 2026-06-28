-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (one per user)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  age integer not null check (age > 0 and age < 150),
  gender text not null check (gender in ('male', 'female', 'other')),
  height_cm numeric not null check (height_cm > 0),
  current_weight_kg numeric not null check (current_weight_kg > 0),
  goal_weight_kg numeric not null check (goal_weight_kg > 0),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  daily_calorie_target integer not null,
  daily_protein_target integer not null,
  daily_carbs_target integer not null,
  daily_fat_target integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Food logs table
create table if not exists food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  description text not null,
  calories integer not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric default 0,
  items jsonb default '[]',
  feedback text,
  logged_at timestamptz default now()
);

-- Indexes
create index if not exists food_logs_user_id_idx on food_logs(user_id);
create index if not exists food_logs_date_idx on food_logs(user_id, date);

-- Row Level Security
alter table profiles enable row level security;
alter table food_logs enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Food logs policies
create policy "Users can view own food logs"
  on food_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own food logs"
  on food_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food logs"
  on food_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own food logs"
  on food_logs for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at on profiles
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
