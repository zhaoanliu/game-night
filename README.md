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

A Next.js front end talking to Next.js route handlers over HTTP. The browser
never reaches the database: every read and write goes through the API, which
resolves who you are from a session cookie and decides what that role may do.

| Endpoint | Who | What |
|---|---|---|
| `GET/POST/DELETE /api/session` | anyone | read, set, or clear "who am I" |
| `GET /api/users` | anyone | the roster for the identity picker |
| `GET /api/events?q=&game_type=` | any signed-in user | upcoming events, soonest first, with counts and seats left |
| `POST /api/events` | organizer | create an event |
| `GET /api/events/:id` | any signed-in user | one event, plus whether *you* hold a seat |
| `GET /api/events/:id/attendees` | owning organizer | the attendee list for your own event |
| `POST /api/events/:id/rsvp` | player | claim a seat |
| `DELETE /api/events/:id/rsvp` | player | release a seat |
| `GET /api/my-events` | player | events you're attending, soonest first |

Errors share one shape — `{"error": {"code", "message"}}` — with a `fields` map
added for validation failures so a form can show the problem next to the input
that caused it. Every write is validated server-side regardless of what the
client checked.

RSVP responses distinguish outcomes that matter to a player: `201` for a new
seat, `200` for a repeat submission that found the seat already held, `409` when
the event filled up first, `422` for an event that already started.

### Identity

There is no authentication, as the brief allows. You pick a name, and the server
stores that user's id in an httpOnly cookie. What the server does *not* do is
trust the client about anything else: roles and ownership are re-checked from
that session on every request, so a player cannot create events and one
organizer cannot read another's attendee list. Swapping this for real
authentication means changing `lib/auth.ts` and nothing else.

### Capacity and duplicate RSVPs

Both invariants are enforced in the database rather than in application code.
`rsvp_to_event` locks the event row (`SELECT … FOR UPDATE`) before counting
seats and inserting, so concurrent RSVPs for the same event serialize behind
that lock and the count-then-insert can't interleave. The
`primary key (event_id, player_id)` backs up the one-RSVP-per-player rule.

Route handlers never write to `rsvps` directly — and can't. The application's
database role has no `insert`, `update`, or `delete` privilege on that table;
seats are claimed and released only by calling the two locking functions. The
capacity rule isn't a convention the code agrees to follow, it's the only path
the database leaves open.

[`doc/data-model-and-concurrency.md`](doc/data-model-and-concurrency.md)
describes the tables in full and walks through the race this prevents, the
alternatives considered, and the path to the 12-month scale numbers.

The proof is an integration suite that fires concurrent HTTP requests at a
running server — see _Proving it_ below.

### Attendee counts

Counts are computed at read time (`events_with_counts`), so they are exact
rather than eventually consistent. A count can still go stale between page load
and click; the server is the source of truth and the UI handles a "someone beat
you to it" response. The path to much higher read volume is described in
_Scaling_.

## Proving it

```bash
npx supabase start      # if it isn't already running
npm run test:integration
```

This builds the app, starts the real server, and fires concurrent HTTP requests
at it. Testing the SQL function directly would prove less — the brief asks that
the *API* enforce capacity, so the session, the role check, and the route
handler are all in the path.

What it asserts:

- **20 players race for 5 seats.** Exactly 5 get `201`, exactly 15 get `409`,
  and the database holds exactly 5 rows.
- **10 players race for 1 seat.** Exactly one wins.
- **One player submits the same RSVP 10 times in parallel.** One `201`, nine
  `200 already_rsvpd`, one row.
- **A seat-holder retries on an event that has since filled.** Reads as
  `already_rsvpd`, not `event_full` — they have a seat, and a retry shouldn't
  suggest otherwise.
- **Cancelling frees the seat**, two waiting players race for it, exactly one
  wins, and the canceller can claim it again afterwards.
- Cancelling a seat you don't hold is a no-op rather than an error.

Each test creates its own users and events and cleans up after itself, so the
suite doesn't depend on seed data. Note how it cleans up: by deleting the
*event* and letting the foreign key cascade, because the application's database
role has no privilege to delete RSVP rows — the tests live under the same
constraint as production code.

### The test has teeth

A concurrency test that passes proves nothing unless it fails when the
protection is removed. Removing `for update` from the RSVP function and
re-running the suite:

```
× seats exactly capacity when 20 players race for 5 seats
  → expected [ …(13) ] to have a length of 5 but got 13
× holds when the race is for a single remaining seat
  → expected [ …(10) ] to have a length of 1 but got 10
```

Thirteen players seated at a five-seat event, and ten at a one-seat event. That
is the bug this design exists to prevent, and the suite catches it.

### The rest of the tests

`npm run test:coverage` runs the unit tests — validation rules, the error
envelope, the status-to-HTTP mapping — over pure logic with no database. The
data-access modules and route handlers are deliberately excluded from that
coverage report and covered by the integration suite instead: mocking a query
builder would only assert that it was called in a particular order, which is
exactly the kind of test that stays green while the query is wrong.

Every PR is gated by CI: ESLint, `tsc --noEmit`, the route-exports check, and
actionlint (`.github/workflows/lint.yml`); unit tests with coverage thresholds
and a production build (`.github/workflows/test.yml`). The HTTP-level
concurrency suite joins these gates in Phase B.

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
