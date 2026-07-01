-- Recreate delete policies to ensure they exist (safe to re-run)
-- food_logs delete policy may have been missed on initial setup

drop policy if exists "Users can delete own food logs" on food_logs;
create policy "Users can delete own food logs"
  on food_logs for delete
  using (auth.uid() = user_id);

-- Re-confirm other delete policies (idempotent)
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
