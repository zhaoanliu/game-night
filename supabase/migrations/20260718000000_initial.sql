-- Game Night — initial schema.
--
-- Capacity (S1) and one-RSVP-per-player (S2) are enforced in the database:
-- every RSVP mutation goes through rsvp_to_event/cancel_rsvp, which serialize
-- on the event row. Route handlers never insert into rsvps directly.

create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  role       text not null check (role in ('player', 'organizer')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.users(id),
  title        text not null check (char_length(title) between 1 and 120),
  game_type    text not null check (game_type in
                 ('boardgame', 'tcg', 'rpg', 'miniatures', 'party', 'other')),
  starts_at    timestamptz not null,
  location     text not null check (char_length(location) between 1 and 200),
  capacity     int not null check (capacity between 1 and 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_organizer_idx on public.events (organizer_id);

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  player_id  uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, player_id)
);

create index if not exists rsvps_event_idx on public.rsvps (event_id);
create index if not exists rsvps_player_idx on public.rsvps (player_id);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.update_updated_at();

-- Attendee counts are computed at read time: exact, never stale. At launch
-- scale this is a trivial grouped count over an indexed FK. The documented
-- path to 100x read volume is a denormalized events.attendee_count maintained
-- inside the functions below — same API, no rewrite.
create or replace view public.events_with_counts
with (security_invoker = true) as
  select e.*, count(r.id)::int as attendee_count
  from public.events e
  left join public.rsvps r on r.event_id = e.id
  group by e.id;

-- S1 + S2. The FOR UPDATE lock on the event row serializes every RSVP for
-- that event, so the count-then-insert below cannot interleave with another
-- transaction's insert. Without the lock, two callers both read capacity - 1
-- under READ COMMITTED and both insert — the classic oversell.
create or replace function public.rsvp_to_event(p_event_id uuid, p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity int;
  v_count    int;
begin
  select capacity into v_capacity
  from public.events
  where id = p_event_id and starts_at > now()
  for update;

  if not found then
    if exists (select 1 from public.events where id = p_event_id) then
      return 'event_started';
    end if;
    return 'event_not_found';
  end if;

  -- Checked before capacity so a retry by a player who already holds a seat
  -- on a now-full event still reads as success rather than 'event_full'.
  if exists (
    select 1 from public.rsvps
    where event_id = p_event_id and player_id = p_player_id
  ) then
    return 'already_rsvpd';
  end if;

  select count(*) into v_count from public.rsvps where event_id = p_event_id;

  if v_count >= v_capacity then
    return 'event_full';
  end if;

  insert into public.rsvps (event_id, player_id) values (p_event_id, p_player_id);
  return 'confirmed';
end;
$$;

create or replace function public.cancel_rsvp(p_event_id uuid, p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rsvps
  where event_id = p_event_id and player_id = p_player_id;

  if found then
    return 'cancelled';
  end if;
  return 'not_rsvpd';
end;
$$;

-- RLS on with no policies: the anon key cannot read or write anything
-- directly. All access is through API route handlers using the service role,
-- which enforce identity and role in application code (lib/auth.ts). Real
-- auth + per-user policies is the first hardening step — see README.
alter table public.users  enable row level security;
alter table public.events enable row level security;
alter table public.rsvps  enable row level security;

-- The Data API exposes nothing by default, so privileges are granted
-- explicitly and only to service_role. anon and authenticated are granted
-- nothing at all: a leaked publishable key reads and writes nothing.
--
-- Note what service_role is deliberately NOT given: insert, update, or delete
-- on rsvps. Seats can only be claimed or released by calling the two functions
-- below, which are security definer and hold the event-row lock. "Don't write
-- rsvps directly" is therefore enforced by the database rather than by
-- convention — no route handler, test, or future contributor can bypass the
-- capacity check even by accident. Deleting an event still clears its RSVPs
-- through the foreign key's on delete cascade.
grant select, insert, update, delete on public.users  to service_role;
grant select, insert, update, delete on public.events to service_role;
grant select on public.rsvps to service_role;
grant select on public.events_with_counts to service_role;

revoke execute on function public.rsvp_to_event(uuid, uuid) from public;
revoke execute on function public.cancel_rsvp(uuid, uuid) from public;
grant execute on function public.rsvp_to_event(uuid, uuid) to service_role;
grant execute on function public.cancel_rsvp(uuid, uuid) to service_role;
