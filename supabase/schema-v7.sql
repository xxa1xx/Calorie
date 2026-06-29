-- Add weekly weight loss rate preference to profiles (lbs/week, default 1.0 = ~500 kcal/day deficit)
alter table profiles add column if not exists weekly_loss_lbs numeric default 1.0;
