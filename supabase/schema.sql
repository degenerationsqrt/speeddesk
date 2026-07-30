-- SpeedDesk secure team accounts, invitations, player progress, and wearable-ready data.
-- This script is intentionally idempotent so it can be reviewed in the SQL editor
-- and applied to the existing prototype project without deleting its legacy snapshot.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Lock the original prototype table. Its one existing row is preserved so the
-- coach can sign in and resync it into the secure tables below.
create table if not exists public.team_snapshots (
  team_id text primary key,
  team_name text not null,
  invite_code text not null unique,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop policy if exists "team snapshots prototype read" on public.team_snapshots;
drop policy if exists "team snapshots prototype write" on public.team_snapshots;
drop policy if exists "team snapshots prototype update" on public.team_snapshots;
revoke all on public.team_snapshots from anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  account_type text not null default 'player'
    check (account_type in ('coach', 'player', 'guardian')),
  guardian_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coach_label text not null default 'Coach',
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_staff (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role in ('owner', 'head_coach', 'assistant_coach')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (team_id, name),
  unique (id, team_id)
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  source_key text,
  profile_id uuid references public.profiles(id) on delete set null,
  guardian_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  email text,
  status text not null default 'Active'
    check (status in ('Active', 'Injured', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, source_key),
  unique (id, team_id)
);

create table if not exists public.athlete_groups (
  athlete_id uuid not null,
  group_id uuid not null,
  team_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (athlete_id, group_id),
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade,
  foreign key (group_id, team_id)
    references public.groups(id, team_id) on delete cascade
);

create table if not exists public.athlete_private_notes (
  athlete_id uuid primary key,
  team_id uuid not null,
  note text not null default '',
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  group_id uuid,
  athlete_id uuid,
  code_hash text not null unique
    check (char_length(code_hash) = 64),
  code_hint text not null,
  role text not null default 'player'
    check (role in ('player', 'guardian')),
  auto_approve boolean not null default false,
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (group_id, team_id)
    references public.groups(id, team_id) on delete cascade,
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.team_invites(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  group_id uuid,
  athlete_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null default 'player'
    check (requested_role in ('player', 'guardian')),
  player_name text not null,
  email text,
  submitted_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (invite_id, user_id),
  foreign key (group_id, team_id)
    references public.groups(id, team_id) on delete cascade,
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade
);

create table if not exists public.team_plan_snapshots (
  team_id uuid primary key references public.teams(id) on delete cascade,
  payload jsonb not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  athlete_id uuid not null,
  workout_key text not null,
  workout_date date not null default current_date,
  workout_title text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  checked_steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checked_steps) = 'array'),
  effort smallint check (effort between 1 and 10),
  pain smallint check (pain between 0 and 10),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  player_note text not null default '',
  sync_source text not null default 'web'
    check (sync_source in ('web', 'offline_queue', 'native_bridge')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, workout_key, workout_date),
  unique (id, team_id),
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade
);

create table if not exists public.workout_reviews (
  attempt_id uuid primary key,
  team_id uuid not null,
  coach_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null
    check (decision in ('verified', 'needs_followup')),
  note text not null default '',
  reviewed_at timestamptz not null default now(),
  foreign key (attempt_id, team_id)
    references public.workout_attempts(id, team_id) on delete cascade
);

create table if not exists public.wearable_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  athlete_id uuid not null,
  provider text not null
    check (provider in ('apple_health', 'samsung_health', 'strava', 'garmin', 'playermaker')),
  provider_activity_id text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_meters numeric check (distance_meters is null or distance_meters >= 0),
  average_heart_rate numeric check (average_heart_rate is null or average_heart_rate >= 0),
  ingestion_method text not null default 'client_import'
    check (ingestion_method in ('client_import', 'provider_webhook', 'native_bridge')),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_activity_id),
  foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete cascade
);

create index if not exists athletes_profile_id_idx
  on public.athletes(profile_id);
create index if not exists athletes_guardian_profile_id_idx
  on public.athletes(guardian_profile_id);
create index if not exists athletes_team_id_idx
  on public.athletes(team_id);
create index if not exists join_requests_team_status_idx
  on public.join_requests(team_id, status);
create index if not exists workout_attempts_team_date_idx
  on public.workout_attempts(team_id, workout_date desc);
create index if not exists wearable_activities_athlete_started_idx
  on public.wearable_activities(athlete_id, started_at desc);
create index if not exists teams_owner_user_id_idx
  on public.teams(owner_user_id);
create index if not exists team_staff_user_id_idx
  on public.team_staff(user_id);
create index if not exists athlete_groups_athlete_team_idx
  on public.athlete_groups(athlete_id, team_id);
create index if not exists athlete_groups_group_team_idx
  on public.athlete_groups(group_id, team_id);
create index if not exists athlete_private_notes_athlete_team_idx
  on public.athlete_private_notes(athlete_id, team_id);
create index if not exists athlete_private_notes_updated_by_idx
  on public.athlete_private_notes(updated_by);
create index if not exists team_invites_team_id_idx
  on public.team_invites(team_id);
create index if not exists team_invites_group_team_idx
  on public.team_invites(group_id, team_id);
create index if not exists team_invites_athlete_team_idx
  on public.team_invites(athlete_id, team_id);
create index if not exists team_invites_created_by_idx
  on public.team_invites(created_by);
create index if not exists join_requests_user_id_idx
  on public.join_requests(user_id);
create index if not exists join_requests_group_team_idx
  on public.join_requests(group_id, team_id);
create index if not exists join_requests_athlete_team_idx
  on public.join_requests(athlete_id, team_id);
create index if not exists join_requests_reviewed_by_idx
  on public.join_requests(reviewed_by);
create index if not exists team_plan_snapshots_updated_by_idx
  on public.team_plan_snapshots(updated_by);
create index if not exists workout_attempts_athlete_team_idx
  on public.workout_attempts(athlete_id, team_id);
create index if not exists workout_reviews_attempt_team_idx
  on public.workout_reviews(attempt_id, team_id);
create index if not exists workout_reviews_coach_user_id_idx
  on public.workout_reviews(coach_user_id);
create index if not exists wearable_activities_athlete_team_idx
  on public.wearable_activities(athlete_id, team_id);

create or replace function private.is_team_staff(
  p_team_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.team_staff staff
      where staff.team_id = p_team_id
        and staff.user_id = (select auth.uid())
        and (p_roles is null or staff.role = any(p_roles))
    );
$$;

create or replace function private.can_manage_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.teams team_row
        where team_row.id = p_team_id
          and team_row.owner_user_id = (select auth.uid())
      )
      or private.is_team_staff(p_team_id, array['owner', 'head_coach'])
    );
$$;

create or replace function private.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      private.is_team_staff(p_team_id, null)
      or exists (
        select 1
        from public.athletes athlete
        where athlete.team_id = p_team_id
          and (
            athlete.profile_id = (select auth.uid())
            or athlete.guardian_profile_id = (select auth.uid())
          )
      )
    );
$$;

create or replace function private.can_access_athlete(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.athletes athlete
      where athlete.id = p_athlete_id
        and (
          athlete.profile_id = (select auth.uid())
          or athlete.guardian_profile_id = (select auth.uid())
          or private.is_team_staff(athlete.team_id, null)
        )
    );
$$;

revoke all on function private.is_team_staff(uuid, text[]) from public, anon;
revoke all on function private.can_manage_team(uuid) from public, anon;
revoke all on function private.is_team_member(uuid) from public, anon;
revoke all on function private.can_access_athlete(uuid) from public, anon;
grant execute on function private.is_team_staff(uuid, text[]) to authenticated;
grant execute on function private.can_manage_team(uuid) to authenticated;
grant execute on function private.is_team_member(uuid) to authenticated;
grant execute on function private.can_access_athlete(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.attach_join_request(
  p_team_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_user_id uuid,
  p_role text,
  p_player_name text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid;
begin
  if p_role not in ('player', 'guardian') then
    raise exception 'This invitation cannot grant that role.';
  end if;

  if p_athlete_id is not null then
    select athlete.id
      into v_athlete_id
      from public.athletes athlete
      where athlete.id = p_athlete_id
        and athlete.team_id = p_team_id
      for update;
  end if;

  if v_athlete_id is null and nullif(trim(coalesce(p_email, '')), '') is not null then
    select athlete.id
      into v_athlete_id
      from public.athletes athlete
      where athlete.team_id = p_team_id
        and lower(athlete.email) = lower(trim(p_email))
      order by athlete.created_at
      limit 1
      for update;
  end if;

  if v_athlete_id is null then
    insert into public.athletes (
      team_id,
      source_key,
      display_name,
      email,
      status
    )
    values (
      p_team_id,
      'joined-' || gen_random_uuid()::text,
      trim(p_player_name),
      nullif(trim(coalesce(p_email, '')), ''),
      'Active'
    )
    returning id into v_athlete_id;
  end if;

  if p_role = 'guardian' then
    update public.athletes
      set guardian_profile_id = p_user_id
      where id = v_athlete_id
        and (guardian_profile_id is null or guardian_profile_id = p_user_id);

    if not found then
      raise exception 'This athlete already has a different guardian account.';
    end if;
  else
    update public.athletes
      set profile_id = p_user_id
      where id = v_athlete_id
        and (profile_id is null or profile_id = p_user_id);

    if not found then
      raise exception 'This athlete is already linked to another player account.';
    end if;
  end if;

  if p_group_id is not null then
    insert into public.athlete_groups (athlete_id, group_id, team_id)
    values (v_athlete_id, p_group_id, p_team_id)
    on conflict (athlete_id, group_id) do nothing;
  end if;

  return v_athlete_id;
end;
$$;

create or replace function private.prepare_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.team_invites%rowtype;
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'Sign in before joining a team.';
  end if;

  if nullif(trim(coalesce(new.submitted_code, '')), '') is null then
    raise exception 'Enter a valid invitation code.';
  end if;

  select invite.*
    into v_invite
    from public.team_invites invite
    where invite.code_hash = encode(
      extensions.digest(upper(trim(new.submitted_code)), 'sha256'),
      'hex'
    )
      and invite.revoked_at is null
      and invite.expires_at > now()
      and (invite.max_uses is null or invite.uses < invite.max_uses)
    for update;

  if not found then
    raise exception 'This invitation is invalid, expired, or full.';
  end if;

  new.invite_id := v_invite.id;
  new.team_id := v_invite.team_id;
  new.group_id := v_invite.group_id;
  new.athlete_id := v_invite.athlete_id;
  new.requested_role := case
    when new.requested_role in ('player', 'guardian') then new.requested_role
    else v_invite.role
  end;
  new.email := coalesce(
    nullif(trim(coalesce(new.email, '')), ''),
    (select auth_user.email from auth.users auth_user where auth_user.id = v_user_id)
  );
  new.player_name := trim(new.player_name);
  new.submitted_code := null;
  new.status := case when v_invite.auto_approve then 'approved' else 'pending' end;

  if new.player_name = '' then
    raise exception 'Enter the player name.';
  end if;

  update public.team_invites
    set uses = uses + 1
    where id = v_invite.id;

  return new;
end;
$$;

create or replace function private.apply_auto_join_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  v_athlete_id := private.attach_join_request(
    new.team_id,
    new.group_id,
    new.athlete_id,
    new.user_id,
    new.requested_role,
    new.player_name,
    new.email
  );

  update public.join_requests
    set athlete_id = v_athlete_id
    where id = new.id;

  return new;
end;
$$;

create or replace function private.apply_manual_join_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.athlete_id := private.attach_join_request(
      new.team_id,
      new.group_id,
      new.athlete_id,
      new.user_id,
      new.requested_role,
      new.player_name,
      new.email
    );
    new.reviewed_at := now();
    new.reviewed_by := (select auth.uid());
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_at := now();
    new.reviewed_by := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.attach_join_request(uuid, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.prepare_join_request() from public, anon, authenticated;
revoke execute on function private.apply_auto_join_approval() from public, anon, authenticated;
revoke execute on function private.apply_manual_join_approval() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row execute function private.set_updated_at();

drop trigger if exists athletes_set_updated_at on public.athletes;
create trigger athletes_set_updated_at
before update on public.athletes
for each row execute function private.set_updated_at();

drop trigger if exists workout_attempts_set_updated_at on public.workout_attempts;
create trigger workout_attempts_set_updated_at
before update on public.workout_attempts
for each row execute function private.set_updated_at();

drop trigger if exists join_requests_prepare on public.join_requests;
create trigger join_requests_prepare
before insert on public.join_requests
for each row execute function private.prepare_join_request();

drop trigger if exists join_requests_auto_approval on public.join_requests;
create trigger join_requests_auto_approval
after insert on public.join_requests
for each row execute function private.apply_auto_join_approval();

drop trigger if exists join_requests_manual_approval on public.join_requests;
create trigger join_requests_manual_approval
before update of status on public.join_requests
for each row execute function private.apply_manual_join_approval();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_staff enable row level security;
alter table public.groups enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_groups enable row level security;
alter table public.athlete_private_notes enable row level security;
alter table public.team_invites enable row level security;
alter table public.join_requests enable row level security;
alter table public.team_plan_snapshots enable row level security;
alter table public.workout_attempts enable row level security;
alter table public.workout_reviews enable row level security;
alter table public.wearable_activities enable row level security;

drop policy if exists "legacy team snapshots denied" on public.team_snapshots;
create policy "legacy team snapshots denied"
on public.team_snapshots for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "teams member select" on public.teams;
create policy "teams member select"
on public.teams for select
to authenticated
using (private.is_team_member(id) or owner_user_id = (select auth.uid()));

drop policy if exists "teams owner insert" on public.teams;
create policy "teams owner insert"
on public.teams for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "teams coach update" on public.teams;
create policy "teams coach update"
on public.teams for update
to authenticated
using (private.can_manage_team(id) or owner_user_id = (select auth.uid()))
with check (private.can_manage_team(id) or owner_user_id = (select auth.uid()));

drop policy if exists "team staff member select" on public.team_staff;
create policy "team staff member select"
on public.team_staff for select
to authenticated
using (user_id = (select auth.uid()) or private.is_team_staff(team_id, null));

drop policy if exists "team staff owner insert" on public.team_staff;
create policy "team staff owner insert"
on public.team_staff for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams team_row
    where team_row.id = team_id
      and team_row.owner_user_id = (select auth.uid())
  )
  or (
    private.is_team_staff(team_id, array['owner', 'head_coach'])
    and role = 'assistant_coach'
  )
);

drop policy if exists "groups member select" on public.groups;
create policy "groups member select"
on public.groups for select
to authenticated
using (private.is_team_member(team_id));

drop policy if exists "groups coach manage" on public.groups;
drop policy if exists "groups coach insert" on public.groups;
drop policy if exists "groups coach update" on public.groups;
drop policy if exists "groups coach delete" on public.groups;
create policy "groups coach insert"
on public.groups for insert
to authenticated
with check (private.can_manage_team(team_id));
create policy "groups coach update"
on public.groups for update
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));
create policy "groups coach delete"
on public.groups for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "athletes self or coach select" on public.athletes;
create policy "athletes self or coach select"
on public.athletes for select
to authenticated
using (private.can_access_athlete(id));

drop policy if exists "athletes coach manage" on public.athletes;
drop policy if exists "athletes coach insert" on public.athletes;
drop policy if exists "athletes coach update" on public.athletes;
drop policy if exists "athletes coach delete" on public.athletes;
create policy "athletes coach insert"
on public.athletes for insert
to authenticated
with check (private.can_manage_team(team_id));
create policy "athletes coach update"
on public.athletes for update
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));
create policy "athletes coach delete"
on public.athletes for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "athlete groups self or coach select" on public.athlete_groups;
create policy "athlete groups self or coach select"
on public.athlete_groups for select
to authenticated
using (private.can_access_athlete(athlete_id));

drop policy if exists "athlete groups coach manage" on public.athlete_groups;
drop policy if exists "athlete groups coach insert" on public.athlete_groups;
drop policy if exists "athlete groups coach update" on public.athlete_groups;
drop policy if exists "athlete groups coach delete" on public.athlete_groups;
create policy "athlete groups coach insert"
on public.athlete_groups for insert
to authenticated
with check (private.can_manage_team(team_id));
create policy "athlete groups coach update"
on public.athlete_groups for update
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));
create policy "athlete groups coach delete"
on public.athlete_groups for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "athlete notes coach manage" on public.athlete_private_notes;
create policy "athlete notes coach manage"
on public.athlete_private_notes for all
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));

drop policy if exists "invites coach manage" on public.team_invites;
drop policy if exists "invites coach select" on public.team_invites;
drop policy if exists "invites coach insert" on public.team_invites;
drop policy if exists "invites coach update" on public.team_invites;
drop policy if exists "invites coach delete" on public.team_invites;

create policy "invites coach select"
on public.team_invites for select
to authenticated
using (private.can_manage_team(team_id));

create policy "invites coach insert"
on public.team_invites for insert
to authenticated
with check (
  private.can_manage_team(team_id)
  and created_by = (select auth.uid())
);

create policy "invites coach update"
on public.team_invites for update
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));

create policy "invites coach delete"
on public.team_invites for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "join requests own or coach select" on public.join_requests;
create policy "join requests own or coach select"
on public.join_requests for select
to authenticated
using (user_id = (select auth.uid()) or private.can_manage_team(team_id));

drop policy if exists "join requests own insert" on public.join_requests;
create policy "join requests own insert"
on public.join_requests for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "join requests coach update" on public.join_requests;
create policy "join requests coach update"
on public.join_requests for update
to authenticated
using (private.can_manage_team(team_id))
with check (private.can_manage_team(team_id));

drop policy if exists "team plans member select" on public.team_plan_snapshots;
create policy "team plans member select"
on public.team_plan_snapshots for select
to authenticated
using (private.is_team_member(team_id));

drop policy if exists "team plans coach manage" on public.team_plan_snapshots;
drop policy if exists "team plans coach insert" on public.team_plan_snapshots;
drop policy if exists "team plans coach update" on public.team_plan_snapshots;
drop policy if exists "team plans coach delete" on public.team_plan_snapshots;
create policy "team plans coach insert"
on public.team_plan_snapshots for insert
to authenticated
with check (
  private.can_manage_team(team_id)
  and updated_by = (select auth.uid())
);
create policy "team plans coach update"
on public.team_plan_snapshots for update
to authenticated
using (private.can_manage_team(team_id))
with check (
  private.can_manage_team(team_id)
  and updated_by = (select auth.uid())
);
create policy "team plans coach delete"
on public.team_plan_snapshots for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "workout attempts self or coach select" on public.workout_attempts;
create policy "workout attempts self or coach select"
on public.workout_attempts for select
to authenticated
using (private.can_access_athlete(athlete_id));

drop policy if exists "workout attempts athlete insert" on public.workout_attempts;
create policy "workout attempts athlete insert"
on public.workout_attempts for insert
to authenticated
with check (private.can_access_athlete(athlete_id));

drop policy if exists "workout attempts athlete update" on public.workout_attempts;
create policy "workout attempts athlete update"
on public.workout_attempts for update
to authenticated
using (private.can_access_athlete(athlete_id))
with check (private.can_access_athlete(athlete_id));

drop policy if exists "workout reviews athlete or coach select" on public.workout_reviews;
create policy "workout reviews athlete or coach select"
on public.workout_reviews for select
to authenticated
using (
  exists (
    select 1
    from public.workout_attempts attempt
    where attempt.id = public.workout_reviews.attempt_id
      and private.can_access_athlete(attempt.athlete_id)
  )
);

drop policy if exists "workout reviews coach manage" on public.workout_reviews;
drop policy if exists "workout reviews coach insert" on public.workout_reviews;
drop policy if exists "workout reviews coach update" on public.workout_reviews;
drop policy if exists "workout reviews coach delete" on public.workout_reviews;
create policy "workout reviews coach insert"
on public.workout_reviews for insert
to authenticated
with check (
  private.can_manage_team(team_id)
  and coach_user_id = (select auth.uid())
);
create policy "workout reviews coach update"
on public.workout_reviews for update
to authenticated
using (private.can_manage_team(team_id))
with check (
  private.can_manage_team(team_id)
  and coach_user_id = (select auth.uid())
);
create policy "workout reviews coach delete"
on public.workout_reviews for delete
to authenticated
using (private.can_manage_team(team_id));

drop policy if exists "wearables athlete or coach select" on public.wearable_activities;
create policy "wearables athlete or coach select"
on public.wearable_activities for select
to authenticated
using (private.can_access_athlete(athlete_id));

drop policy if exists "wearables athlete bridge insert" on public.wearable_activities;
create policy "wearables athlete bridge insert"
on public.wearable_activities for insert
to authenticated
with check (
  private.can_access_athlete(athlete_id)
  and ingestion_method in ('client_import', 'native_bridge')
);

revoke all on public.profiles from anon;
revoke all on public.teams from anon;
revoke all on public.team_staff from anon;
revoke all on public.groups from anon;
revoke all on public.athletes from anon;
revoke all on public.athlete_groups from anon;
revoke all on public.athlete_private_notes from anon;
revoke all on public.team_invites from anon;
revoke all on public.join_requests from anon;
revoke all on public.team_plan_snapshots from anon;
revoke all on public.workout_attempts from anon;
revoke all on public.workout_reviews from anon;
revoke all on public.wearable_activities from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.teams to authenticated;
grant update (name, coach_label, updated_at) on public.teams to authenticated;
grant select, insert on public.team_staff to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.athletes to authenticated;
grant select, insert, update, delete on public.athlete_groups to authenticated;
grant select, insert, update, delete on public.athlete_private_notes to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;
grant select, insert, update on public.join_requests to authenticated;
grant select, insert, update, delete on public.team_plan_snapshots to authenticated;
grant select, insert, update on public.workout_attempts to authenticated;
grant select, insert, update, delete on public.workout_reviews to authenticated;
grant select, insert on public.wearable_activities to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'join_requests'
  ) then
    alter publication supabase_realtime add table public.join_requests;
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_attempts'
  ) then
    alter publication supabase_realtime add table public.workout_attempts;
  end if;
end
$$;
