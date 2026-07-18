# Game Night

A community event board for tabletop-game players. Organizers post events with
a fixed number of seats; players browse what's coming up, see how full each
event is, and claim or release a seat. Seats are first-come-first-served and an
event can never be over-booked — including when two players go for the last
seat at the same instant.

Built as a take-home project. Next.js (App Router) + TypeScript on the front,
Next.js route handlers + Postgres (Supabase) on the back.

> **Status:** in progress. Sections marked _TBD_ are filled in as the phases land.

## Run it

Prerequisites: Node 20+ and Docker (Docker Desktop running — the local Postgres
runs in a container).

```bash
npm install
npm run setup
```

`setup` starts local Supabase, applies the schema, loads seed data, and starts
the app on http://localhost:3000. Stop the database afterwards with
`npx supabase stop`.

Seeded so the interesting states are visible immediately: several upcoming
events, two with a single seat left, one completely full, one with no attendees
yet, and one in the past.

_Demo walkthrough: TBD (Phase C)._

## How it works

_TBD — API surface and page structure land in Phases B and C._

### Capacity and duplicate RSVPs

Both invariants are enforced in the database rather than in application code.
`rsvp_to_event` locks the event row (`SELECT … FOR UPDATE`) before counting
seats and inserting, so concurrent RSVPs for the same event serialize behind
that lock and the count-then-insert can't interleave. A
`unique (event_id, player_id)` constraint backs up the one-RSVP-per-player rule.

Route handlers never write to `rsvps` directly — and can't. The application's
database role has no `insert`, `update`, or `delete` privilege on that table;
seats are claimed and released only by calling the two locking functions. The
capacity rule isn't a convention the code agrees to follow, it's the only path
the database leaves open.

The proof is an integration suite that fires concurrent HTTP requests at a
running server — see _Proving it_ below.

### Attendee counts

Counts are computed at read time (`events_with_counts`), so they are exact
rather than eventually consistent. A count can still go stale between page load
and click; the server is the source of truth and the UI handles a "someone beat
you to it" response. The path to much higher read volume is described in
_Scaling_.

## Proving it

_TBD (Phase B) — concurrency suite: N players racing for the last seat, and one
player double-submitting._

## Design decisions

_TBD._

## Scaling

_TBD._

## Time spent

_TBD._

## Before real traffic

_TBD._

## How this was built

_TBD._
