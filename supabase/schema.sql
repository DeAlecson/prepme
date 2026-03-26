-- ════════════════════════════════════════════════════════
--  PrepMe — Supabase Schema  (safe to re-run)
--  Supabase Dashboard → SQL Editor → paste → Run
-- ════════════════════════════════════════════════════════

-- ── Drop everything first (reverse dependency order) ─────

drop trigger if exists preps_updated_at        on public.preps;
drop trigger if exists on_auth_user_created    on auth.users;

drop function if exists public.update_updated_at()  cascade;
drop function if exists public.handle_new_user()    cascade;
drop function if exists public.increment_tokens(uuid, bigint, bigint) cascade;
drop function if exists public.is_admin()            cascade;

drop table if exists public.usage_logs   cascade;
drop table if exists public.preps        cascade;
drop table if exists public.invite_codes cascade;
drop table if exists public.profiles     cascade;

-- ── Tables ───────────────────────────────────────────────

create table public.profiles (
  id                  uuid references auth.users on delete cascade primary key,
  email               text not null,
  display_name        text,
  role                text not null default 'user' check (role in ('admin', 'user')),
  is_active           boolean not null default false,
  invite_code_used    text,
  total_input_tokens  bigint not null default 0,
  total_output_tokens bigint not null default 0,
  last_active_at      timestamptz,
  created_at          timestamptz not null default now()
);

create table public.invite_codes (
  id          uuid default gen_random_uuid() primary key,
  code        text unique not null,
  created_by  uuid references public.profiles,
  used_by     uuid references public.profiles,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

-- NOTE: id is TEXT (not uuid) — JS generates ids like "lp5abc123"
create table public.preps (
  id              text primary key,
  user_id         uuid references public.profiles on delete cascade not null,
  title           text not null,
  company         text,
  role            text,
  readiness_score int,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.usage_logs (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  context       text,
  created_at    timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.invite_codes enable row level security;
alter table public.preps        enable row level security;
alter table public.usage_logs   enable row level security;

-- ── Helper: is current user an admin? ────────────────────
-- Uses plpgsql + set local row_security = off to avoid RLS recursion

create or replace function public.is_admin()
returns boolean as $$
declare
  result boolean;
begin
  set local row_security = off;
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into result;
  return result;
end;
$$ language plpgsql security definer stable;

-- ── RLS Policies ─────────────────────────────────────────

-- Profiles: read own row (or admin reads all)
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- Profiles: update own row OR admin updates any row
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- Preps: full access to own rows; admin can see/delete all
create policy "preps_select" on public.preps
  for select using (auth.uid() = user_id or public.is_admin());

create policy "preps_insert" on public.preps
  for insert with check (auth.uid() = user_id);

create policy "preps_update" on public.preps
  for update using (auth.uid() = user_id);

create policy "preps_delete" on public.preps
  for delete using (auth.uid() = user_id or public.is_admin());

-- Invite codes: any authenticated user can read (needed for code validation)
create policy "invite_codes_select" on public.invite_codes
  for select using (auth.role() = 'authenticated');

create policy "invite_codes_insert" on public.invite_codes
  for insert with check (public.is_admin());

create policy "invite_codes_update" on public.invite_codes
  for update using (public.is_admin() or auth.uid() is not null);

create policy "invite_codes_delete" on public.invite_codes
  for delete using (public.is_admin());

-- Usage logs: insert own; read own (admin reads all)
create policy "usage_insert" on public.usage_logs
  for insert with check (auth.uid() = user_id);

create policy "usage_select" on public.usage_logs
  for select using (auth.uid() = user_id or public.is_admin());

-- ── Functions ─────────────────────────────────────────────

-- Increment token totals on profile after each API call
create or replace function public.increment_tokens(
  user_id_param   uuid,
  input_delta     bigint,
  output_delta    bigint
)
returns void as $$
begin
  update public.profiles
  set
    total_input_tokens  = total_input_tokens  + input_delta,
    total_output_tokens = total_output_tokens + output_delta,
    last_active_at      = now()
  where id = user_id_param;
end;
$$ language plpgsql security definer;

-- Auto-update updated_at on preps
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger preps_updated_at
  before update on public.preps
  for each row execute procedure public.update_updated_at();

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role, is_active)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    case when new.email = 'alecson95@gmail.com' then 'admin' else 'user' end,
    case when new.email = 'alecson95@gmail.com' then true  else false end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Seed: activate your admin account ────────────────────
-- (needed because the trigger only fires for NEW signups)

insert into public.profiles (id, email, display_name, role, is_active)
select id, email, split_part(email, '@', 1), 'admin', true
from auth.users
where email = 'alecson95@gmail.com'
on conflict (id) do update
  set role = 'admin', is_active = true,
      display_name = coalesce(public.profiles.display_name, split_part(excluded.email, '@', 1));
