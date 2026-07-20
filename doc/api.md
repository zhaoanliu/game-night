# API and UI surface

A Next.js front end talking to Next.js route handlers over HTTP. The browser
never reaches the database: every read and write goes through the API, which
resolves who you are from a session cookie and decides what that role may do.

## Endpoints

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

## Pages

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
skeletons, a designed empty state, and an error state with a Retry button;
every mutation disables its control while pending and settles from the
server's response.

## Errors and status codes

Errors share one shape — `{"error": {"code", "message"}}` — with a `fields`
map added for validation failures so a form can show the problem next to the
input that caused it. Every write is validated server-side regardless of what
the client checked.

RSVP responses distinguish outcomes that matter to a player: `201` for a new
seat, `200` for a repeat submission that found the seat already held, `409`
when the event filled up first, `422` for an event that already started.

## List semantics

"My events" answers two different questions, so it takes a `when` parameter
rather than returning one merged list. `upcoming` is the default and sorts
soonest first — the commuting player asking what's next. `past` sorts most
recent first, because history is read backwards from now. An unrecognised
value is a `400` rather than a silent fallback to upcoming, so a typo in a
client surfaces immediately instead of showing plausible but wrong data.

Events have an end time as well as a start (organizers may set it; it defaults
to a three-hour session), and the lists deliberately use different boundaries.
Browsing keys off the start time — it's about what you can still join, and
seats close when an event begins. "My events" and the organizer's own list key
off the end time — an event happening right now is something you're part of,
or running, and haven't finished. It stays on the player's list while they're
at the table, and on the organizer's page at check-in time, when the attendee
roster matters most.

RSVP and cancel responses include the updated `attendee_count` and
`seats_left`, so the UI settles from a single round trip: the number a player
sees after acting is the server's answer, not a client-side guess. This pairs
with the deliberately *non*-optimistic RSVP button — under contention the
server is the source of truth, and "You're in!" should never be shown and then
taken back.
