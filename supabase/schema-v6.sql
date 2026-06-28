-- schema-v6: AI usage tracking for per-user rate limiting

create table if not exists ai_usage (
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  log_food_count integer not null default 0,
  suggestions_count integer not null default 0,
  insights_count integer not null default 0,
  primary key (user_id, date)
);

alter table ai_usage enable row level security;

-- Users can only read their own usage
create policy "Users can view own ai_usage"
  on ai_usage for select
  using (auth.uid() = user_id);

-- Atomic check-and-increment via security definer so it runs as the table owner,
-- bypassing RLS for the upsert while still using auth.uid() for the identity check.
-- Returns true if the action is allowed (under limit), false if the daily cap is hit.
create or replace function check_and_increment_ai_usage(p_column text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_count integer;
begin
  if v_user_id is null then
    return false;
  end if;

  -- Upsert a row for today if it doesn't exist, then read current count
  insert into ai_usage (user_id, date)
  values (v_user_id, v_today)
  on conflict (user_id, date) do nothing;

  -- Read and increment atomically using dynamic column name
  execute format(
    'update ai_usage set %I = %I + 1 where user_id = $1 and date = $2 and %I < $3 returning %I',
    p_column, p_column, p_column, p_column
  )
  using v_user_id, v_today, p_limit
  into v_count;

  -- If the update returned a row, the increment succeeded (under limit)
  return v_count is not null;
end;
$$;
