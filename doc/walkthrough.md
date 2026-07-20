# Demo walkthrough

The seed data (`supabase/seed.sql`) is arranged so every interesting state is
visible immediately: several upcoming events, two with a single seat left, one
completely full, one with no attendees yet, and one in the past. The same seed
runs locally and on the hosted demo.

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

## Resetting the hosted demo

To put the live site back into the pristine demo state after playing with it,
run from the repo root:

```bash
npx supabase db reset --linked
```

This drops the hosted database, re-applies the migrations, and re-runs
`supabase/seed.sql`, restoring every state the walkthrough relies on — with the
relative event times re-anchored to now. Merely re-running the seed would not
do this: its inserts are `on conflict do nothing`, so leftover RSVPs would
survive. You need the Supabase CLI logged in (`npx supabase login`) and the
project linked (`npx supabase link --project-ref <ref>`); no redeploy is
needed, only the data changes. Don't run it while a deploy from `main` is in
flight — the CD smoke test RSVPs against the seeded events.
