-- Srusti Academy of Management and Technology (SAMT)
-- Campus Event & LAN Esports Championship (2K26) — Supabase Free PostgreSQL Schema

create extension if not exists pgcrypto;

-- 1. Events Table (Esports flagship + extensible college events)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  game_title text not null,
  event_type text not null default 'esports_squad',
  max_teams integer not null default 24 check (max_teams > 0),
  base_fee integer not null default 299 check (base_fee >= 0),
  lunch_fee integer not null default 100 check (lunch_fee >= 0),
  prize_pool_total integer not null default 10000 check (prize_pool_total >= 0),
  prize_breakdown jsonb not null default '[]'::jsonb,
  qr_image_url text not null default '',
  upi_vpa text,
  upi_payee_name text default 'Srusti Academy of Management and Technology',
  event_date_label text not null default 'Dates to be announced',
  registration_deadline text not null default 'Open until 24 slots fill',
  venue_label text not null default 'SAMT Campus LAN Arena',
  rules_json jsonb not null default '{}'::jsonb,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Admin Allowlist Table (links to Supabase Auth users)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default 'Tournament Admin',
  role text not null default 'verifier' check (role in ('super_admin', 'verifier')),
  created_at timestamptz not null default now()
);

-- 3. Registrations Table
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  team_code text not null unique,
  event_id uuid not null references public.events(id) on delete restrict,
  team_name text not null,
  college_name text not null,
  igl_phone text not null,
  igl_email text not null,
  has_substitute boolean not null default false,
  lunch_count integer not null default 0 check (lunch_count >= 0 and lunch_count <= 5),
  veg_count integer not null default 0 check (veg_count >= 0 and veg_count <= 5),
  non_veg_count integer not null default 0 check (non_veg_count >= 0 and non_veg_count <= 5),
  base_fee integer not null default 299,
  lunch_total integer not null default 0,
  total_fee integer not null check (total_fee >= 0),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'reupload_required', 'waitlisted')),
  slot_number text,
  group_name text,
  eligibility_confirmed boolean not null default false,
  fair_play_confirmed boolean not null default false,
  active_skill_confirmed boolean not null default false,
  rejection_reason text,
  last_email_status text default 'none',
  last_email_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_registrations_event_team_name
  on public.registrations (event_id, lower(team_name))
  where status <> 'rejected';

-- 4. Team Members Table (4 Active + 1 Optional Substitute)
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  slot_role text not null check (slot_role in ('IGL', 'P2', 'P3', 'P4', 'SUB')),
  full_name text not null,
  in_game_name text not null,
  character_id text not null,
  academic_level text not null default 'UG',
  college_override text,
  wants_lunch boolean not null default false,
  diet_type text not null default 'NONE' check (diet_type in ('VEG', 'NON_VEG', 'NONE')),
  created_at timestamptz not null default now()
);

-- Prevent duplicate active Character IDs within the same event
create unique index if not exists idx_team_members_event_character_id
  on public.team_members (event_id, lower(character_id));

-- 5. Payment Proofs Table
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  utr_number text not null,
  upi_app text not null default 'UPI',
  paid_amount integer not null check (paid_amount >= 0),
  screenshot_path text not null,
  file_sha256 text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'reupload_required')),
  rejection_reason text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_payment_proofs_utr_unique
  on public.payment_proofs (upper(utr_number))
  where review_status <> 'rejected';

create unique index if not exists idx_payment_proofs_sha256_unique
  on public.payment_proofs (file_sha256)
  where review_status <> 'rejected';

-- 6. Immutable Payment & Notification Audit Logs
create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_label text not null default 'SYSTEM',
  action text not null check (action in ('SUBMIT', 'REUPLOAD', 'APPROVE', 'REJECT', 'REQUEST_REUPLOAD', 'EMAIL_SENT', 'EMAIL_FAIL', 'REFUNDED')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Enable Row-Level Security (RLS)
alter table public.events enable row level security;
alter table public.admin_users enable row level security;
alter table public.registrations enable row level security;
alter table public.team_members enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.payment_audit_logs enable row level security;

-- Public read only on open events (no PII exposed)
drop policy if exists "Public can view open events" on public.events;
create policy "Public can view open events"
  on public.events for select
  to anon, authenticated
  using (is_open = true);

-- Admins can manage all tables
drop policy if exists "Admins full access events" on public.events;
create policy "Admins full access events"
  on public.events for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins view self" on public.admin_users;
create policy "Admins view self"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins manage registrations" on public.registrations;
create policy "Admins manage registrations"
  on public.registrations for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins manage team_members" on public.team_members;
create policy "Admins manage team_members"
  on public.team_members for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins manage payment_proofs" on public.payment_proofs;
create policy "Admins manage payment_proofs"
  on public.payment_proofs for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins view audit_logs" on public.payment_audit_logs;
create policy "Admins view audit_logs"
  on public.payment_audit_logs for select
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Storage Buckets (run once in Supabase SQL Editor)
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;
