-- Apply to an existing project after the base schema. Safe to rerun.
create table if not exists public.check_in_volunteers (
  login_id text primary key check (login_id ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  password_hash text not null
);

create table if not exists public.check_in_attendance (
  member_id uuid primary key references public.team_members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by text not null
);

create index if not exists idx_check_in_attendance_time
  on public.check_in_attendance (checked_in_at desc, member_id);

alter table public.check_in_volunteers enable row level security;
alter table public.check_in_attendance enable row level security;
revoke all on public.check_in_volunteers, public.check_in_attendance from public, anon, authenticated;
grant select, insert, update on public.check_in_volunteers to service_role;
grant select, insert on public.check_in_attendance to service_role;

create or replace function public.mark_check_in_present(p_team_code text, p_member_id uuid, p_actor text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  mark public.check_in_attendance;
begin
  perform 1 from public.registrations r join public.team_members m on m.registration_id = r.id
    where r.team_code = p_team_code and m.id = p_member_id
      and r.status = 'verified' and nullif(btrim(r.slot_number), '') is not null
      and btrim(r.slot_number) not ilike 'WL-%' and lower(btrim(coalesce(r.group_name, ''))) <> 'waitlist'
    for share of r, m;
  if not found then return null; end if;

  insert into public.check_in_attendance (member_id, checked_in_by) values (p_member_id, p_actor)
    on conflict (member_id) do nothing;
  select * into mark from public.check_in_attendance where member_id = p_member_id;
  return to_jsonb(mark);
end;
$$;

revoke execute on function public.mark_check_in_present(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_check_in_present(text, uuid, text) to service_role;
