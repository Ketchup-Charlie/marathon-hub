create table if not exists race_config (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  race_name     text,
  race_date     date,
  target_time   text not null default '4:15:00',
  pace_mp       text,
  pace_tempo    text,
  pace_interval text,
  pace_easy     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists race_config_user_id_idx on race_config (user_id);

alter table race_config enable row level security;

create policy "Users can manage their own race config"
  on race_config for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
