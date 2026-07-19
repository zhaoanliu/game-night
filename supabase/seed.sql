-- Seed data for local development and demos.
--
-- Guarantees the brief asks for: several upcoming events, two with a single
-- seat left, exactly one full event, one event with no attendees, and one past
-- event (proves upcoming-only filtering). Times are relative to now() so the
-- seed never goes stale; 02:00 UTC lands on a US Pacific evening.

insert into public.users (id, name, role) values
  ('22222222-2222-2222-2222-222222222201', 'Alice Chen (Mox Boarding House)', 'organizer'),
  ('22222222-2222-2222-2222-222222222202', 'Ben Okafor (Card Kingdom)',       'organizer'),
  ('22222222-2222-2222-2222-222222222203', 'Chandra Iyer (Guild Hall Games)', 'organizer'),
  ('33333333-3333-3333-3333-333333330001', 'Amara Okonkwo', 'player'),
  ('33333333-3333-3333-3333-333333330002', 'Devon Clarke',  'player'),
  ('33333333-3333-3333-3333-333333330003', 'Elena Rossi',   'player'),
  ('33333333-3333-3333-3333-333333330004', 'Jasmine Park',  'player'),
  ('33333333-3333-3333-3333-333333330005', 'Marcus Webb',   'player'),
  ('33333333-3333-3333-3333-333333330006', 'Nina Kowalski', 'player'),
  ('33333333-3333-3333-3333-333333330007', 'Omar Haddad',   'player'),
  ('33333333-3333-3333-3333-333333330008', 'Priya Raman',   'player'),
  ('33333333-3333-3333-3333-333333330009', 'Ravi Menon',    'player'),
  ('33333333-3333-3333-3333-333333330010', 'Sofia Duarte',  'player'),
  ('33333333-3333-3333-3333-333333330011', 'Theo Lindqvist','player'),
  ('33333333-3333-3333-3333-333333330012', 'Yuki Tanaka',   'player')
on conflict (id) do nothing;

-- Durations are per-event because a draft pod and an all-day RPG session are
-- not the same commitment. ends_at is derived from starts_at so the two can
-- never drift apart in the seed.
insert into public.events (id, organizer_id, title, game_type, starts_at, ends_at, location, capacity)
select id, organizer_id, title, game_type, starts_at, starts_at + duration, location, capacity
from (values
  ('11111111-1111-1111-1111-111111110001'::uuid, '22222222-2222-2222-2222-222222222201'::uuid,
   'Friday Night Magic — Standard', 'tcg',
   date_trunc('day', now()) + interval '2 days 2 hours', interval '4 hours',
   'Mox Boarding House, Bellevue', 12),

  ('11111111-1111-1111-1111-111111110002', '22222222-2222-2222-2222-222222222202',
   'Commander Pod — Casual Night', 'tcg',
   date_trunc('day', now()) + interval '3 days 2 hours', interval '3 hours',
   'Card Kingdom, Ballard', 4),

  ('11111111-1111-1111-1111-111111110003', '22222222-2222-2222-2222-222222222203',
   'Heavy Euro Board Game Meetup', 'boardgame',
   date_trunc('day', now()) + interval '5 days 2 hours', interval '5 hours',
   'Guild Hall Games, Capitol Hill', 8),

  ('11111111-1111-1111-1111-111111110004', '22222222-2222-2222-2222-222222222201',
   'Learn to Play: Gloomhaven', 'boardgame',
   date_trunc('day', now()) + interval '6 days 2 hours', interval '3 hours',
   'Mox Boarding House, Bellevue', 6),

  ('11111111-1111-1111-1111-111111110005', '22222222-2222-2222-2222-222222222203',
   'D&D 5e One-Shot: Tomb of Horrors', 'rpg',
   date_trunc('day', now()) + interval '8 days 2 hours', interval '6 hours',
   'Guild Hall Games, Capitol Hill', 5),

  ('11111111-1111-1111-1111-111111110006', '22222222-2222-2222-2222-222222222202',
   'Warhammer 40k Paint & Play', 'miniatures',
   date_trunc('day', now()) + interval '11 days 2 hours', interval '4 hours',
   'Card Kingdom, Ballard', 10),

  ('11111111-1111-1111-1111-111111110007', '22222222-2222-2222-2222-222222222201',
   'Party Games & Pizza', 'party',
   date_trunc('day', now()) + interval '13 days 2 hours', interval '3 hours',
   'Mox Boarding House, Bellevue', 16),

  ('11111111-1111-1111-1111-111111110008', '22222222-2222-2222-2222-222222222202',
   'Draft Night: Newest Set', 'tcg',
   date_trunc('day', now()) + interval '19 days 2 hours', interval '4 hours',
   'Card Kingdom, Ballard', 8),

  -- Happening right now: started an hour ago, runs for two more. Seats are
  -- closed, but it still belongs in its attendees' upcoming list.
  ('11111111-1111-1111-1111-111111110010', '22222222-2222-2222-2222-222222222201',
   'Midweek Board Game Night', 'boardgame',
   now() - interval '1 hour', interval '3 hours',
   'Mox Boarding House, Bellevue', 8),

  ('11111111-1111-1111-1111-111111110009', '22222222-2222-2222-2222-222222222203',
   'Retro Game Night', 'boardgame',
   date_trunc('day', now()) - interval '6 days', interval '4 hours',
   'Guild Hall Games, Capitol Hill', 10)
) as e(id, organizer_id, title, game_type, starts_at, duration, location, capacity)
on conflict (id) do nothing;

-- The first N players (alphabetically) attend each event. Yuki Tanaka, last
-- alphabetically, holds no RSVPs — pick that player to demo the empty
-- "My events" state and to claim the last seat at Friday Night Magic.
with players as (
  select id, row_number() over (order by name) as rn
  from public.users
  where role = 'player'
)
insert into public.rsvps (event_id, player_id)
select e.event_id, p.id
from (values
  ('11111111-1111-1111-1111-111111110001'::uuid, 11),  -- 1 seat left of 12
  ('11111111-1111-1111-1111-111111110002'::uuid, 4),   -- FULL (capacity 4)
  ('11111111-1111-1111-1111-111111110003'::uuid, 3),
  ('11111111-1111-1111-1111-111111110004'::uuid, 5),   -- 1 seat left of 6
  ('11111111-1111-1111-1111-111111110005'::uuid, 2),
  ('11111111-1111-1111-1111-111111110007'::uuid, 4),
  ('11111111-1111-1111-1111-111111110008'::uuid, 1),
  ('11111111-1111-1111-1111-111111110010'::uuid, 5),   -- happening right now
  ('11111111-1111-1111-1111-111111110009'::uuid, 3)    -- finished
) as e(event_id, n)
join players p on p.rn <= e.n
on conflict (event_id, player_id) do nothing;
