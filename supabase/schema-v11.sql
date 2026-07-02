-- Harden the AI usage rate-limit RPC.
-- Run after schema-v10.sql. Safe to run more than once.

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
  v_max_limit integer;
  v_effective_limit integer;
begin
  if v_user_id is null then
    return false;
  end if;

  v_max_limit := case p_column
    when 'log_food_count' then 30
    when 'suggestions_count' then 10
    when 'insights_count' then 5
    else null
  end;

  if v_max_limit is null or p_limit is null or p_limit < 1 then
    return false;
  end if;

  -- A caller may request a stricter limit, but can never raise the server maximum.
  v_effective_limit := least(p_limit, v_max_limit);

  insert into ai_usage (user_id, date)
  values (v_user_id, v_today)
  on conflict (user_id, date) do nothing;

  execute format(
    'update ai_usage set %I = %I + 1 where user_id = $1 and date = $2 and %I < $3 returning %I',
    p_column, p_column, p_column, p_column
  )
  using v_user_id, v_today, v_effective_limit
  into v_count;

  return v_count is not null;
end;
$$;

revoke all on function check_and_increment_ai_usage(text, integer) from public;
revoke all on function check_and_increment_ai_usage(text, integer) from anon;
grant execute on function check_and_increment_ai_usage(text, integer) to authenticated;
