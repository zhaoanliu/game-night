# Assumptions and trade-offs

The brief deliberately leaves gaps and asks for judgment calls to be recorded.
This file is that record: what was assumed beyond the written requirements and
why, and the considered alternatives behind the decisions that could
reasonably have gone another way.

Schema-level decisions (the row-lock concurrency mechanism, the composite
primary key, exact-at-read counts, the no-write grant on `rsvps`) have their own
walkthrough in [data-model-and-concurrency.md](data-model-and-concurrency.md)
and are only cross-referenced here.

---

## Assumptions beyond the brief

### Events have an end time

The brief lists an event's fields as "title, game type, date/time, location,
capacity" — a start, but no end. Built literally, "has it started" becomes the
only available proxy for "is it over", and that proxy fails visibly: an event
that began an hour ago and runs until midnight is *in progress*, yet a
start-time boundary files it under history — it vanishes from its attendees'
lists while they are sitting at the table.

So events carry `ends_at`. Organizers may set it; if they don't, it defaults to
a three-hour session (`DEFAULT_DURATION_MINUTES`), so the create form stays as
small as the brief implies. A check constraint keeps it after the start, and a
sanity bound rejects events longer than a week.

The end time lets the product use two different time boundaries, each honest
for its question:

| List | Boundary | Question it answers |
|---|---|---|
| Browse | `starts_at > now` | What can I still join? (Seats close at start.) |
| My events (upcoming) | `ends_at > now` | What am I part of that isn't over? |
| My events (past) | `ends_at <= now` | What did I play? |

An in-progress event therefore appears in its attendees' upcoming list, is
absent from browse, and refuses new RSVPs (`422 event_started`). An integration
test pins all three behaviours for a single event.

Alternatives considered: a grace window ("treat events as current for N hours
after start") avoids the schema change but replaces a real timestamp with an
arbitrary constant that some events outrun and others don't; a third
`current` window in the API just relocates the same arbitrary cutoff. Modelling
the end properly was one column and one constraint.

### RSVP history is queryable, and upcoming is the default

Story P5 reads: *"I can see 'My events' — everything I've RSVP'd to, soonest
first."* Read literally, "everything" includes events that already happened;
read by intent, a commuting player deciding what to attend wants the future
list with nothing buried under last month's game nights.

Both readings are served: `GET /api/my-events?when=upcoming|past`. `upcoming`
is the default and sorts soonest first; `past` sorts most recent first, because
history is read backwards from now. In the UI, upcoming is the primary view and
history sits behind a secondary tab — deliberately low priority, but the API
treats both as first-class so the UI choice stays a UI choice.

An unrecognised `when` value is a `400 invalid_window`, not a silent fallback
to upcoming — a typo in a client should surface, not render plausible but
wrong data.

Without history, a past RSVP simply vanished from the player's view while the
organizer's attendee list still showed them — an asymmetry with no story to
justify it.

### Roles are exclusive

The brief describes two personas and gives each a distinct need; it never
shows an organizer RSVPing or a player creating events. Users therefore hold
exactly one role: organizers cannot RSVP (`403`), players cannot create events
(`403`), and "my events" is a player concept. This keeps every authorization
check crisp and testable. Real accounts would plausibly hold both roles; that
generalisation belongs with real auth (below).

### Identity is a picker, and what that does and doesn't claim

The brief allows "a 'who am I' name picker or similar" with **no real
authentication**, but insists the API be clear about which role may do what.
The split implemented:

- Identity is self-asserted: pick a seeded user, the server sets an httpOnly
  cookie with that user's id. Anyone can present any user id — that is the
  stated, accepted scope of the exercise.
- Authorization is not self-asserted: every request re-resolves the user from
  the cookie server-side and enforces role and ownership there. `organizer_id`
  on a created event comes from the session, never the request body. One
  organizer cannot read another's attendee list.

The boundary is drawn so that swapping in real authentication (Supabase Auth +
RLS read policies) changes `lib/auth.ts` and nothing else. That is the first
item on the hardening list.

### Seats close when the event starts

The brief doesn't say when RSVPs stop. Decided: at `starts_at` — you cannot
reserve a seat at something already underway, and a capacity count that keeps
moving mid-event serves nobody. This is enforced inside the locked SQL function
(the same statement that takes the row lock filters on `starts_at > now()`), so
it cannot drift from the capacity check. Consequence, tested explicitly: an
in-progress event is on its attendees' list *and* refuses newcomers.

### Cancellation is a hard delete — no RSVP audit trail

Cancel removes the row; re-RSVP after cancel is a fresh insert. No `status`
column, no history of who cancelled when. This is what lets
`(event_id, player_id)` be the primary key at all (a status column would allow
multiple rows per pairing over time, forcing uniqueness down to a partial
index). The product as briefed needs current truth, not provenance. An audit
trail is on the hardening list, and belongs inside the same locked functions so
history and seat count can never disagree.

### The bounded vocabulary and limits

Where the brief says "game type" without enumerating, a fixed six-value set
(`boardgame | tcg | rpg | miniatures | party | other`) is assumed — it makes
the filter UI cheap and validates identically on both sides; `other` is the
escape hatch. Enforced as a check constraint rather than a Postgres enum so
widening it later is an ordinary migration.

Numeric and length bounds not in the brief: capacity 1–1000 (a 0-capacity
event is nonsense; 1000 is beyond any store's tables), title ≤ 120, location ≤
200, start time must be in the future, duration ≤ 7 days. All enforced
server-side (S4) and mirrored as database check constraints.

### Search is `ilike`, not full-text

"Simple search or filter" at 50-event scale is a case-insensitive substring
match over title and location, with `%`/`_` escaped. Trigram or full-text
indexes are a scale-path item, not a launch need.

### Seed data is a demo script in disguise

Beyond the brief's "several events, some near-full, at least one full": times
are relative to `now()` so the seed never goes stale; exactly one event is
full, two sit at one seat left (the interesting RSVP moments), one is empty
(the empty attendee list state), one is past and one is happening right now
(the two non-upcoming states). One seeded player (Yuki Tanaka) holds no RSVPs,
to demo the empty "my events" state and be the natural protagonist for
claiming a last seat. An integration test asserts the seed keeps these
promises.

---

## Trade-offs considered

### Pending vs. optimistic RSVP

The RSVP button uses a **pending state** — tap, "Reserving…", settle on the
server's answer — rather than optimistically flipping to "You're in" and
rolling back on failure. This diverges from the optimistic-everywhere
convention of adjacent projects, deliberately:

- **The failure isn't rare here; it's the premise.** The brief's central
  scenario is two players going for the last seat at the same moment, the seed
  ships near-full events pointing at it, and it's the first thing a reviewer
  will try. Showing "You're in ✓" and retracting it 200ms later is a false
  promise about a scarce resource.
- **The latency isn't worth hiding.** The RSVP path is one round trip to a
  row-locked function — tens of milliseconds locally. Optimism buys its
  complexity back when it hides hundreds of milliseconds; here there's nothing
  to hide.
- **The count isn't the client's to predict.** Optimistic updates are safe on
  state you own (your card, your list order). `attendee_count` is shared state
  being mutated concurrently by strangers; incrementing it locally asserts
  something the client cannot know.

Supporting decisions that came with it:

- **Mutation responses carry the truth.** `POST`/`DELETE …/rsvp` return
  `{status, attendee_count, seats_left}`, so the UI settles from a single
  round trip instead of a follow-up fetch. This also removes most of the speed
  argument optimism had.
- **The status region is a live region** (`role="status"`), so
  "Reserving…" → "You're in" / "Event is full" is announced by screen readers,
  not just seen.
- **Rejected hybrid:** optimistic when seats are plentiful, pending when
  nearly full. Adapts to actual risk, but behaviour then depends on a
  threshold no user can see.
- **Revisit trigger:** if the hosted deployment puts the database far enough
  away that the round trip genuinely drags (several hundred ms), the calculus
  changes — measure in the hosting phase rather than assume.

### The idempotency contract

A retried or double-submitted RSVP had to be made safe (S2). The contract
chosen: a repeat submission returns `200 already_rsvpd` — an idempotent
*success*, not an error, because the caller asked for a seat and has one. Only
a genuinely full event is a `409`. Inside the SQL function the duplicate check
deliberately runs **before** the capacity check, so a seat-holder retrying
against a now-full event still hears "you're in" rather than a false
`event_full`. Cancel mirrors this: releasing a seat you don't hold is a `200
not_rsvpd` no-op — though cancelling against an event that doesn't exist at
all is a `404`, because "that event isn't real" is information, not
idempotency.

### Proving S1/S2 over HTTP rather than against the database

The concurrency suite drives a production build of the real server with
concurrent `fetch` calls — 20 players racing 5 seats, one player submitting 10
times in parallel — and then asserts against the database rows, not just the
responses. Testing the SQL function directly would have been easier and would
prove less: the brief demands the *API* enforce the invariants, so the
session, role check, and route handler belong inside the tested path.

Two deliberate habits in the harness:

- **The suite was mutation-tested.** With `for update` removed, it fails —
  13 players seated at a 5-seat event. A concurrency test that cannot fail
  when the protection is deleted is theatre.
- **Fixtures obey production constraints.** Tests create their own users and
  events (never leaning on seed rows) and clean up by deleting *events*,
  letting the cascade clear RSVPs — because the application role has no delete
  privilege on `rsvps`, and the tests should live under the same rules as the
  code they test.

### Unit coverage deliberately excludes the data-access layer

Route handlers and the modules that talk to Postgres are excluded from the
unit-coverage thresholds and owned by the integration suite instead. A mocked
query-builder test asserts only that methods were called in an expected order —
it stays green when the query is wrong, the lock is missing, or the grant is
absent, which are exactly the failures that matter here. Pure logic
(validation, the error envelope, status→HTTP mapping) was split into its own
modules and held to the thresholds honestly rather than diluting the number.

### Errors: one envelope, all fields at once

Every error is `{"error": {code, message}}`; validation failures add a
`fields` map and report **all** invalid fields in one response rather than
stopping at the first, so a form renders every problem in one pass. Unknown
ids are `404`s, not `500`s — including malformed UUIDs, which Postgres reports
as a cast error that the API translates rather than leaks.

### Local environment choices

Local Supabase runs on ports offset to 544xx so this stack coexists with other
local Supabase projects instead of fighting over the default 54322. Unused
services (auth, storage, realtime, edge runtime, analytics) are disabled in
`config.toml` — fewer containers for a reviewer's first `npm run setup`. The
local demo JWTs committed in `.env.example` are the Supabase CLI's standard
shared defaults, identical on every machine and only ever valid against a
container on localhost; the hosted deployment's keys live in the deployment
platform and are real secrets.

### Decisions inherited from the schema design

Recorded in [data-model-and-concurrency.md](data-model-and-concurrency.md)
with their rejected alternatives: the `FOR UPDATE` row lock (vs. unlocked
check-then-insert, SERIALIZABLE, advisory locks, app-level locks, optimistic
versioning); `(event_id, player_id)` as the primary key (vs. a surrogate id);
exact-at-read counts with a no-rewrite path to denormalization, caching,
replicas, and keyset pagination; and the privilege model that leaves the
locked functions as the only writable path to a seat.
