# Testing

## The concurrency proof

```bash
npx supabase start      # if it isn't already running
npm run test:integration
```

This builds the app, starts the real server, and fires concurrent HTTP
requests at it. Testing the SQL function directly would prove less — the brief
asks that the *API* enforce capacity, so the session, the role check, and the
route handler are all in the path.

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
*event* and letting the foreign key cascade, because the application's
database role has no privilege to delete RSVP rows — the tests live under the
same constraint as production code.

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

Thirteen players seated at a five-seat event, and ten at a one-seat event.
That is the bug this design exists to prevent, and the suite catches it.

## The rest of the tests

`npm run test:coverage` runs the unit tests — validation rules, the error
envelope, the status-to-HTTP mapping, and every UI component (the RSVP
button's pending/409/422 branches, the form's field errors, the
loading/empty/error states) — with no database. The data-access modules and
route handlers are deliberately excluded from that coverage report and covered
by the integration suite instead: mocking a query builder would only assert
that it was called in a particular order, which is exactly the kind of test
that stays green while the query is wrong.

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
actionlint (`.github/workflows/lint.yml`); unit tests with coverage
thresholds, a production build, and the HTTP-level concurrency suite against a
real Postgres (`.github/workflows/test.yml`); the full Playwright suite
against a production build. The guarantee this product rests on is checked on
every pull request, not just on my machine. See
[ci-and-automation.md](ci-and-automation.md) for the full pipeline.
