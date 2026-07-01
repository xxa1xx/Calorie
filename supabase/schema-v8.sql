-- Add missing DELETE policies for daily_meta and water_logs
create policy "Users can delete own daily meta"
  on daily_meta for delete
  using (auth.uid() = user_id);

create policy "Users can delete own water logs"
  on water_logs for delete
  using (auth.uid() = user_id);
