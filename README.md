# Game Night

A community event board for tabletop-game players. Organizers post events with
a fixed number of seats; players browse what's coming up, see how full each
event is, and claim or release a seat. Seats are first-come-first-served and an
event can never be over-booked — including when two players go for the last
seat at the same instant.

Built as a take-home project. Next.js (App Router) + TypeScript on the front,
Next.js route handlers + Postgres (Supabase) on the back.

**Live demo:** https://game-night-livid.vercel.app — hosted on Vercel against a
hosted Supabase project, deployed automatically from `main` (see
[CI and automation](#ci-and-automation)). Same seed data as local: pick a
seeded user and try to grab the last seat.

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

### Demo walkthrough

1. Pick **Yuki Tanaka** — the seeded player who holds no RSVPs, so every state
   below starts clean.
2. Browse the board: **Commander Pod** is FULL (red), **Friday Night Magic**
   and **Learn to Play: Gloomhaven** each show an amber "1 seat left".
3. Open Gloomhaven and take the last seat — the badge flips to FULL for
   everyone. Cancel, and the seat comes back. RSVP again; it's a fresh claim.
4. Open Commander Pod: the RSVP button is disabled, with "Event is full"
   inline. The server's 409 still backs the one case a disabled button can't
   foresee — a page whose count went stale before the click (step 7's race
   loser sees exactly that).
5. **My events** tracks what you claimed, soonest first, with inline cancel;
   empty again once you release everything.
6. Sign out and pick **Alice Chen**. On the organizer page, **Midweek Board
   Game Night** is marked *in progress* and still listed — open it and the
   attendee roster is right there, at the moment an organizer actually needs
   it. Sign out, pick **Ben Okafor**, and revisit: same page, no roster.
7. The race the product exists for: open a one-seat event as two different
   players in a normal and a private window, and click RSVP in both at once.
   Exactly one wins; the other reads "Event is full".

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
| `POST /api/events/:id/rsvp` | player | claim a seat; returns fresh `attendee_count`/`seats_left` |
| `DELETE /api/events/:id/rsvp` | player | release a seat; returns fresh `attendee_count`/`seats_left` |
| `GET /api/my-events?when=` | player | `upcoming` (default) soonest first, or `past` most recent first |
| `GET /api/organizer/events` | organizer | your own not-yet-ended events, in-progress first |

The pages are thin server shells over client components that fetch from those
endpoints — one data path, whether the request comes from the UI or curl:

| Page | Who | What |
|---|---|---|
| `/` | any signed-in user | browse upcoming events: search, game-type chips, seat badges |
| `/events/:id` | any signed-in user | detail; players claim/release a seat, the owning organizer sees the roster |
| `/my-events` | player | upcoming RSVPs soonest first, inline cancel |
| `/organizer` | organizer | create form plus your own not-yet-ended events |

Identity is resolved once, in the root layout: with no session cookie a
full-screen login page (one dropdown, no password) replaces the app. Identity
then sticks until you sign out — the header shows who you are, and changing
users means signing out and picking again. Signing in lands you on your role's
home (players → the board, organizers → their page) unless you deep-linked to
a page your role can use, which is preserved. Every fetch surface has loading
skeletons,
a designed empty state, and an error state with a Retry button; every mutation
disables its control while pending and settles from the server's response.

Errors share one shape — `{"error": {"code", "message"}}` — with a `fields` map
added for validation failures so a form can show the problem next to the input
that caused it. Every write is validated server-side regardless of what the
client checked.

RSVP responses distinguish outcomes that matter to a player: `201` for a new
seat, `200` for a repeat submission that found the seat already held, `409` when
the event filled up first, `422` for an event that already started.

"My events" answers two different questions, so it takes a `when` parameter
rather than returning one merged list. `upcoming` is the default and sorts
soonest first — the commuting player asking what's next. `past` sorts most
recent first, because history is read backwards from now. An unrecognised value
is a `400` rather than a silent fallback to upcoming, so a typo in a client
surfaces immediately instead of showing plausible but wrong data.

Events have an end time as well as a start (organizers may set it; it defaults
to a three-hour session), and the lists deliberately use different boundaries.
Browsing keys off the start time — it's about what you can still join, and
seats close when an event begins. "My events" and the organizer's own list key
off the end time — an event happening right now is something you're part of, or
running, and haven't finished. It stays on the player's list while they're at
the table, and on the organizer's page at check-in time, when the attendee
roster matters most.

RSVP and cancel responses include the updated `attendee_count` and `seats_left`,
so the UI settles from a single round trip: the number a player sees after
acting is the server's answer, not a client-side guess. This pairs with the
deliberately *non*-optimistic RSVP button — under contention the server is the
source of truth, and "You're in!" should never be shown and then taken back.

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
envelope, the status-to-HTTP mapping, and every UI component (the RSVP button's
pending/409/422 branches, the form's field errors, the loading/empty/error
states) — with no database. The data-access modules and route handlers are
deliberately excluded from that coverage report and covered by the integration
suite instead: mocking a query builder would only assert that it was called in
a particular order, which is exactly the kind of test that stays green while
the query is wrong.

`npx playwright test -c playwright.config.local.ts` drives the built app in a
real browser through eight specs — the identity gate, browse filters, the
pending RSVP flow, the full-event rejection, cancel-frees-a-seat, my-events,
the organizer form and the roster ownership boundary, and the
loading/empty/error states. Each is tagged with the acceptance criterion it
proves (`[AC-11-n]`). The config builds and serves a production bundle on
purpose: dev servers hide hydration and chunking bugs. Specs restore whatever
they change through the public API — the service role can't write `rsvps`, and
the tests live under the same rules as everything else.

Every PR is gated by CI: ESLint, `tsc --noEmit`, the route-exports check, and
actionlint (`.github/workflows/lint.yml`); unit tests with coverage thresholds,
a production build, and the HTTP-level concurrency suite against a real Postgres
(`.github/workflows/test.yml`). The guarantee this product rests on is checked
on every pull request, not just on my machine.

## Design decisions

The brief leaves gaps on purpose and asks for the judgment calls to be
recorded. They live in two documents:

- [`doc/decisions.md`](doc/decisions.md) — assumptions made beyond the brief
  and why (events get an end time; RSVP history is queryable; roles are
  exclusive; seats close at start; hard-delete cancellation; the bounded
  vocabularies), and the trade-offs behind the arguable calls (pending vs.
  optimistic RSVP, the idempotency contract, proving concurrency over HTTP,
  what unit coverage deliberately excludes).
- [`doc/data-model-and-concurrency.md`](doc/data-model-and-concurrency.md) —
  the schema itself: the row-lock mechanism and the oversell race it prevents,
  the composite primary key, exact-at-read counts, the privilege model, and
  the rejected alternatives for each.

The short version of the two most load-bearing choices: capacity is enforced
by a `FOR UPDATE` row lock inside a SQL function that is the *only* writable
path to a seat (the application role cannot touch the RSVP table directly),
and the RSVP button reports what the server said rather than guessing —
because in this product, "two people went for the last seat" is not an edge
case, it's the point.

## Scaling

_TBD._

## Time spent

_TBD._

## Before real traffic

_TBD._

## How this was built

_Full write-up TBD (Phase F)._

### CI and automation

Every PR is gated by five required checks: `lint` (ESLint, tsc, route-export
check, actionlint), `unit` (coverage thresholds plus an acceptance-criteria
gate), `build`, `integration` (the S1/S2 concurrency proof against a real
Postgres), and `e2e` (the full Playwright suite against a **production build**
and a real local Supabase). Docs-only PRs skip the heavy jobs via a
detect-doc-only gate while still satisfying branch protection.

The repo runs the [claude-dev-automation](https://github.com/zhaoanliu/claude-dev-automation)
pipeline, pinned at `@v2.0.0` (a release cut for this adoption: the previously
vendor-and-adapt pieces — `verify-ac`, the retry script, the AC-coverage gate —
were generalized behind action inputs, so this repo vendors nothing):

- **Feature factory** — labeling an issue `status: approved` generates a design
  issue with acceptance criteria (`[AC-<design>-<n>]` tags) and a
  machine-readable plan; `status: auto-implement` implements it sub-task by
  sub-task, generates Playwright tests from the acceptance criteria, self-heals
  failures, and opens a PR that is always human-merged (`manual merge required`).
- **Self-healing CI** — a failing check dispatches `ci-failure`; an auto-fix
  workflow reads the logs, fixes the branch, verifies against the same local
  gate set (including the integration suite), and pushes only if green.
- **Bug-fix bot** — `bug`-labeled issues get a root-cause fix PR with
  risk-gated auto-merge (low-risk ≤2-file fixes only).
- **Rebase bot** — every push to main rebases conflicting PRs, with rule-based
  AI conflict resolution.
- **CD** — every push to `main` re-runs the full gate set (lint, test,
  integration, e2e), applies migrations to the hosted Supabase project
  (**before** the deploy — a failing migration blocks the release), deploys to
  Vercel, then runs a hosted smoke test: the RSVP round-trip against the live
  seeded events (`201 confirmed` on the last seat → `200 already_rsvpd` →
  `409 event_full` on the full event → `200 cancelled`, seed restored). A
  migration failure dispatches `db-fix` (constrained fix PR, never
  auto-merged); any other deploy failure dispatches `cd-auto-fix`
  (reproduce-locally → classify infra vs code → fix or file an issue); a
  monitor workflow catches CD runs that die before they can dispatch.

Bot runs use the library-default model (claude-sonnet-5 at v2.0.0). The bots'
prompts encode this repo's invariants — most importantly that nothing writes
`rsvps` outside the two locked SQL functions.
