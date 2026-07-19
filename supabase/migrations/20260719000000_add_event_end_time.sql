-- Events had a start but no end, so "has it started" was standing in for "is it
-- over". An event running right now was therefore filed as history, and
-- disappeared from a player's upcoming list while they were still at the table.
--
-- With an end time the three states are expressible: not started, in progress,
-- finished. A player's upcoming list keys off ends_at (what you are part of and
-- isn't over), while browsing keeps keying off starts_at (what you can still
-- join) — see doc/data-model-and-concurrency.md.

alter table public.events add column if not exists ends_at timestamptz;

-- Existing rows predate the column; assume the default session length.
update public.events
set ends_at = starts_at + interval '3 hours'
where ends_at is null;

alter table public.events alter column ends_at set not null;

do $$
begin
  alter table public.events
    add constraint events_ends_after_starts check (ends_at > starts_at);
exception
  when duplicate_object then null;
end $$;

-- "My events" partitions on ends_at, so it gets its own index; events_starts_at_idx
-- continues to serve the browse list.
create index if not exists events_ends_at_idx on public.events (ends_at);

-- A view's column list is expanded from e.* when the view is created, not when
-- it is queried — so the view predates ends_at and must be recreated to see it.
-- "create or replace" cannot add columns to a view; drop and recreate, then
-- re-grant (drop discards the grant).
drop view if exists public.events_with_counts;
create view public.events_with_counts
with (security_invoker = true) as
  select e.*, count(r.player_id)::int as attendee_count
  from public.events e
  left join public.rsvps r on r.event_id = e.id
  group by e.id;

grant select on public.events_with_counts to service_role;
