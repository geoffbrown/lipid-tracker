-- LipidLog — schema and row-level security.
-- Apply via the Supabase SQL editor, or the Supabase CLI.
--
-- Readings store raw inputs only. Every derived value — both LDL estimates,
-- ApoB, the ratios — is computed at read time by lib/calc.js, so changing the
-- ApoB or LDL method reprices all history with no migration, which is what
-- Cholesterol_PRD_v3_3.md requires.

create extension if not exists "pgcrypto";

create table if not exists public.readings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ts            timestamptz not null,
  source        text not null check (source in ('POC', 'Lab')),
  source_name   text not null,
  tc            double precision check (tc  >= 0),
  hdl           double precision check (hdl >  0),   -- HDL of 0 blocks a save
  ldl           double precision check (ldl >= 0),
  tg            double precision check (tg  >= 0),
  apob_measured double precision check (apob_measured >= 0),
  notes         text check (char_length(notes) <= 300),
  created_at    timestamptz not null default now(),

  -- A reading needs at least one lipid value.
  constraint readings_min_one_value check (num_nonnulls(tc, hdl, ldl, tg) >= 1),
  -- Manual ApoB is collected for lab sources only.
  constraint readings_apob_lab_only check (apob_measured is null or source = 'Lab')
);

-- NOTE ON CONSTRAINTS: only the app's *block* rules appear above. The warn
-- ranges (TC 80-500, HDL 10-150, LDL 20-400, TG 20-1000, ApoB 20-250) are
-- deliberately absent. The PRD allows an out-of-range value to be saved after
-- confirmation, and a physiologically implausible reading is still real data.
-- Do not copy the grip tracker's hard bounds here.

create index if not exists readings_user_ts_idx
  on public.readings (user_id, ts desc, id desc);

-- Account-level settings: these follow the user across devices. Device-local
-- view state (theme, selected range, chart metric) stays in localStorage.
create table if not exists public.profiles (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ldl_method         text not null default 'martin-hopkins'
                       check (ldl_method in ('none', 'friedewald', 'martin-hopkins')),
  apob_method        text not null default 'interheart'
                       check (apob_method in ('interheart', 'aggressive')),
  -- Lp(a) is a stable genetic marker, so it is stored once per user rather
  -- than per reading.
  lpa                double precision check (lpa >= 0),
  lpa_unit           text not null default 'mg/dL' check (lpa_unit in ('mg/dL', 'nmol/L')),
  default_source     text not null default 'POC' check (default_source in ('POC', 'Lab')),
  default_device     text,
  default_lab_source text,
  home_devices       text[] not null default '{}',
  lab_sources        text[] not null default '{}',
  cards              text[] not null default '{ldl,hdl,apob}',
  onboarded_at       timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.readings enable row level security;
alter table public.profiles enable row level security;

-- Row-level security is the only barrier between users' data. It is enforced
-- in Postgres rather than in the client, which is what makes the anon key safe
-- to ship in the browser bundle.
do $$
declare t text;
begin
  foreach t in array array['readings', 'profiles'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)',
                   t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)',
                   t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
                   t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)',
                   t || '_delete_own', t);
  end loop;
end $$;
