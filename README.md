# Game Night

A community event board for tabletop-game players. Organizers post events with
a fixed number of seats; players browse what's coming up, see how full each
event is, and claim or release a seat. Seats are first-come-first-served and an
event can never be over-booked — including when two players go for the last
seat at the same instant.

Next.js (App Router) + TypeScript on the front, Next.js route handlers +
Postgres (Supabase) on the back, talking over HTTP.

**Hosted preview:** https://game-night-livid.vercel.app — same seed data as
local; pick a seeded user and try to grab the last seat.

## Run it

Prerequisites: Node 20+ and Docker (Docker Desktop running — the local
Postgres runs in a container).

```bash
npm install
npm run setup
```

`setup` starts local Supabase, applies the schema, loads seed data, and starts
the app on http://localhost:3000. Stop the database afterwards with
`npx supabase stop`.

Seed data makes the interesting states visible immediately: several upcoming
events, two with one seat left, one completely full, one with no attendees
yet, and one in the past. A guided tour of every state — including how to
reproduce the last-seat race yourself — is in
[`doc/walkthrough.md`](doc/walkthrough.md).

## Key design decisions

**Capacity and duplicates (S1, S2) are enforced in the database, not in
application code.** `rsvp_to_event` locks the event row (`SELECT … FOR
UPDATE`) before counting seats and inserting, so concurrent RSVPs serialize
behind that lock; a `primary key (event_id, player_id)` backs up the
one-RSVP-per-player rule. Route handlers never write the `rsvps` table
directly — and can't: the application's database role has no
`insert`/`update`/`delete` privilege on it. The capacity rule isn't a
convention the code agrees to follow; it's the only path the database leaves
open.

**Counts / freshness (S3): computed at read time, exact.** The event list
reads from a view that counts RSVPs, so displayed counts are exact rather than
eventually consistent — at launch scale the join is cheap. A count can still
go stale between page load and click; the server is the source of truth and
the UI handles the "someone beat you to it" `409`. The RSVP button is
deliberately *non*-optimistic and settles from the server's response — in this
product, "two people went for the last seat" is not an edge case, it's the
point.

**Identity is a name picker, authorization is real.** No authentication, as
the brief allows: you pick a name and the server stores that user's id in an
httpOnly cookie. But roles and ownership are re-checked server-side on every
request — a player cannot create events, and one organizer cannot read
another's attendee list. Swapping in real auth changes `lib/auth.ts` and
nothing else.

**Scale by adding, not rewriting.** The 12-month numbers (~100× read volume on
the list) are reached without touching the API surface or the enforcement
point: (1) denormalize the count onto `events`, maintained inside the two
locked functions — the only writers, so it can't drift; (2) short-TTL caching
on the list read — exactly the "modest staleness" the brief permits; (3) read
replicas for browsing, writes stay on the primary where the lock lives;
(4) keyset pagination. The write path — the part that must be correct — never
changes.

Assumptions made where the brief is silent (events get an end time; seats
close at start; hard-delete cancellation; exclusive roles; RSVP status codes)
and the trade-offs behind the arguable calls are recorded in
[`doc/decisions.md`](doc/decisions.md). The schema, the oversell race, and the
rejected alternatives are in
[`doc/data-model-and-concurrency.md`](doc/data-model-and-concurrency.md). The
full API surface is in [`doc/api.md`](doc/api.md).

## Proving S1/S2

```bash
npx supabase start
npm run test:integration
```

This builds the app and fires concurrent HTTP requests at the real server: 20
players race for 5 seats and exactly 5 win; 10 race for 1 seat and exactly one
wins; a double-submitted RSVP yields one row. The test has teeth — removing
`for update` from the RSVP function makes it fail with 13 players seated at a
5-seat event. Unit tests (`npm run test:coverage`) and Playwright E2E against
a production build round it out; details in [`doc/testing.md`](doc/testing.md).

## Time spent

About 14 hours wall-clock over three days, reconstructed from the commit and
PR record:

| Work | Time |
|---|---|
| Product thinking, data-model design, PLAN.md | ~2.5 h |
| Phase A — scaffold, schema + seed, local Supabase, CI skeleton | ~3 h |
| Phase B — API, auth boundary, RSVP functions, integration proof | ~3 h |
| Phase C — UI, all states, Playwright e2e vs production build | ~2.5 h |
| Phase D — CI gates + automation pipeline adoption | ~1.5 h |
| Phase E — hosted Supabase, Vercel, CD with hosted smoke | ~2 h |
| Phase F — dogfood run, README, clean-clone drill | ~1 h |

The concurrency path got the disproportionate share deliberately: schema and
locked functions were designed before any application code, and the
integration suite that proves them was written against the API contract, not
the implementation.

## Before real traffic

In rough priority order:

1. **Real authentication.** Identity is a self-asserted picker (the brief's
   stated scope); authorization is already server-side per request, so this is
   a `lib/auth.ts` swap — but until then, anyone can present any user id.
2. **Rate limiting** on the write endpoints — the RSVP path is an obvious
   target for scripted seat-grabbing.
3. **Observability** — structured request logs, latency/error metrics, alerts
   on lock wait time and 409 rates (the early warnings for RSVP contention).
4. **Soft-delete / audit trail for RSVPs.** Cancellation is a hard delete
   today (a recorded trade-off); real disputes ("I had a seat!") need history.
5. **Pagination** on the event list before it's needed, keyset from the start.
6. **Load-test the RSVP path** — the tests prove correctness under
   concurrency, not throughput under contention.
7. **Operational hygiene** — Postgres PITR backups, a staging environment for
   migrations.

## How this was built and verified

With [Claude Code](https://claude.com/claude-code), under a process the repo
itself enforces: `main` is read-only, and every change started as a GitHub
issue and arrived via a PR gated by five required CI checks (lint, unit,
build, the concurrency integration suite, and E2E against a production build).
The graded heart — schema, the locked SQL functions, the auth boundary, and
the integration suite — was built directly and reviewed line-by-line; the
repetitive perimeter (UI states, Playwright specs, CI plumbing) was delegated
to an automation pipeline and reviewed at the PR boundary. Verification never
relied on trust in generation: every claim above maps to a check that fails if
it stops being true, and a clean-clone drill of the run instructions was the
final step. The pipeline, CD to the hosted preview, and what was delegated
vs. hand-built are described in
[`doc/ci-and-automation.md`](doc/ci-and-automation.md).
