-- easy-Calender: Grundschema
--
-- Jede Zeile gehört einem Supabase-Benutzer (user_id). Row Level Security
-- sorgt dafür, dass jeder Benutzer nur seine eigenen Zeilen sieht und ändert.
-- Tokens von Google und Microsoft werden hier NICHT gespeichert, sie bleiben
-- verschlüsselt auf dem Gerät (Electron safeStorage).

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'demo')),
  email text not null,
  -- Verweis auf das lokal gespeicherte Token, nie das Token selbst
  token_ref text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  remote_id text not null,
  name text not null,
  color text,
  sync_enabled boolean not null default false,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, remote_id)
);

create table public.sync_pairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_calendar_id uuid not null references public.calendars (id) on delete cascade,
  ms_calendar_id uuid not null references public.calendars (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (google_calendar_id, ms_calendar_id)
);

create table public.event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pair_id uuid not null references public.sync_pairs (id) on delete cascade,
  google_event_id text,
  ms_event_id text,
  last_hash text,
  google_etag text,
  ms_changekey text,
  updated_at timestamptz not null default now(),
  unique (pair_id, google_event_id),
  unique (pair_id, ms_event_id)
);

create table public.sync_state (
  calendar_id uuid primary key references public.calendars (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  delta_token text,
  updated_at timestamptz not null default now()
);

create index calendars_account_id_idx on public.calendars (account_id);
create index sync_pairs_ms_calendar_id_idx on public.sync_pairs (ms_calendar_id);

alter table public.accounts enable row level security;
alter table public.calendars enable row level security;
alter table public.sync_pairs enable row level security;
alter table public.event_links enable row level security;
alter table public.sync_state enable row level security;

create policy "Eigene Zeilen" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Zeilen" on public.calendars
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Zeilen" on public.sync_pairs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Zeilen" on public.event_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Zeilen" on public.sync_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
