-- ThesisTrack — Supabase schema
-- Run this once in the Supabase SQL Editor after creating your project.
-- Dashboard → SQL Editor → New query → paste → Run

-- ── user_data ────────────────────────────────────────────────────────────────
-- One row per user. Stores the full serialised app state as JSONB.
create table if not exists public.user_data (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_user_id_unique unique (user_id)
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_data_updated_at on public.user_data;
create trigger trg_user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.user_data enable row level security;

-- Each user can only see and modify their own row
create policy "select own row"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "insert own row"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "update own row"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own row"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- ── Email auth only ───────────────────────────────────────────────────────────
-- No additional SQL needed; enable Email provider in:
--   Dashboard → Authentication → Providers → Email
-- Recommended: disable "Confirm email" for simpler onboarding,
-- or keep it enabled for production.
