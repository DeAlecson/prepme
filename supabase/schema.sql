-- ════════════════════════════════════════════════════════
--  PrepMe — Supabase Schema
--  Run this once in: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════

-- ── Tables ───────────────────────────────────────────────

create table public.profiles (
  id                  uuid references auth.users on delete cascade primary key,
  email               text not null,
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

create table public.preps (
  id              uuid default gen_random_uuid() primary key,
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
  context       text, -- 'generation' | 'mock' | 'score'
  created_at    timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.invite_codes enable row level security;
alter table public.preps        enable row level security;
alter table public.usage_logs   enable row level security;

-- Helper: check if current user is admin (avoids circular RLS)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Profiles: own row + admin sees all
create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update" on public.profiles for update
  using (auth.uid() = id);

-- Preps: own rows only (admin can also see all)
create policy "preps_all" on public.preps for all
  using (auth.uid() = user_id or public.is_admin());

-- Invite codes: any authenticated user can read (for validation)
-- Only admin can insert/update/delete
create policy "invite_codes_select" on public.invite_codes for select
  using (auth.role() = 'authenticated');

create policy "invite_codes_modify" on public.invite_codes for all
  using (public.is_admin());

-- Usage logs: insert own, read own + admin reads all
create policy "usage_insert" on public.usage_logs for insert
  with check (auth.uid() = user_id);

create policy "usage_select" on public.usage_logs for select
  using (auth.uid() = user_id or public.is_admin());

-- ── Functions ─────────────────────────────────────────────

-- Increment token totals on profile (called after each API use)
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

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, is_active)
  values (
    new.id,
    new.email,
    case when new.email = 'alecson95@gmail.com' then 'admin' else 'user' end,
    case when new.email = 'alecson95@gmail.com' then true  else false end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
