_Design for feature request #13: Confirm before cancelling an RSVP_

# Design: Confirm before cancelling an RSVP (issue #13)

## What the user wants

Cancelling an RSVP is currently a single click on both the event detail page
(`RsvpButton`'s "Cancel RSVP") and the inline "Cancel" button on `/my-events`
(`MyEventsList`). Because a cancelled seat is released instantly and can be
grabbed by someone else, an accidental click permanently loses the seat with
no undo. The user wants a confirmation step interposed before the
`DELETE /api/events/:id/rsvp` call fires, in both places, while preserving the
existing pending/spinner UX and without breaking the e2e specs that currently
click "Cancel"/"Cancel RSVP" directly.

**Ambiguity:** the request offers two options — "a dialog or two-step button."
This design picks the two-step button (see Design decisions) since the
codebase has no existing modal/dialog pattern to build on, and a two-step
inline control is simpler to reason about and test.

## Proposed implementation

Add one new shared UI primitive, `components/ui/ConfirmButton.tsx`, that
wraps a click into a two-step "click → confirm/never-mind → fire" flow while
delegating the actual mutation to a caller-supplied `onConfirm` callback.
`RsvpButton` and `MyEventsList` each swap their existing plain `<button
onClick={cancel}>` for `<ConfirmButton onConfirm={cancel}>`, keeping their own
`pending`/`cancellingId` state and the `DELETE` call exactly as-is — this is a
presentation-only change with no API or database impact, since `cancel_rsvp`
and its locking are unaffected by when the client decides to call it.

### Files to modify or create

- `components/ui/ConfirmButton.tsx` (new) — the two-step confirm control:
  renders its normal (idle) children/button until clicked, then swaps to a
  "Confirm cancel" / "Never mind" pair; clicking "Confirm cancel" invokes
  `onConfirm` and returns to idle immediately (the caller's own `pending`
  state then disables/animates the button, exactly as it does today).
- `components/events/RsvpButton.tsx` — replace the plain "Cancel RSVP" button
  with `ConfirmButton`, passing the existing `cancel` function as `onConfirm`
  and `pending === 'cancel'` as the pending flag. No change to `rsvp()`, the
  "You're in ✓" markup, or the status line.
- `components/my-events/MyEventsList.tsx` — replace the plain "Cancel" button
  per list item with `ConfirmButton`, passing `() => cancel(event.id)` as
  `onConfirm` and `cancellingId === event.id` as pending. No change to
  loading/empty/error states.
- `__tests__/components/ui/ConfirmButton.test.tsx` (new) — unit tests for the
  primitive in isolation (idle → confirm → fire; idle → confirm → never mind
  → idle without firing; disabled/pending states).
- `__tests__/components/events/RsvpButton.test.tsx` — update the two existing
  cancel tests (`'cancels a held seat...'`, `'surfaces a failed cancel...'`)
  to click "Cancel RSVP" then "Confirm cancel" before asserting the DELETE
  call/result.
- `__tests__/components/my-events/MyEventsList.test.tsx` — update the two
  existing cancel tests to click "Cancel" then "Confirm cancel" before
  asserting.
- `e2e/rsvp.spec.ts` — update `'cancelling frees the seat...'` to click
  "Cancel RSVP" then "Confirm cancel"; add a new test asserting that clicking
  "Cancel RSVP" then "Never mind" leaves the RSVP and seat count untouched and
  never issues the DELETE (verified via `page.route` interception).
- `e2e/my-events.spec.ts` — update `'shows upcoming RSVPs...with inline
  cancel...'` to click "Cancel" then "Confirm cancel"; add a new test for
  declining the confirm on `/my-events` (event stays in the list, no DELETE
  fired).
- `e2e/journey.spec.ts` — update the final "cancel inline" step to click
  "Cancel" then "Confirm cancel" before asserting the empty state.

No changes to `app/api/events/[id]/rsvp/route.ts`, `lib/rsvp.ts`, or any
migration — confirmed via `doc/data-model-and-concurrency.md`: `cancel_rsvp`
already treats a second/duplicate call as a harmless no-op, and its row lock
is unaffected by when the client sends the request. This is a pure client-side
change.

### UI changes

- **Event detail page** (`components/events/RsvpButton.tsx`, rendered from
  `components/events/EventDetail.tsx` on `/events/[id]` for signed-in
  players who hold a seat): clicking "Cancel RSVP" no longer cancels
  immediately. Instead the button is replaced in place by a short prompt
  ("Cancel this RSVP?") with two buttons: "Confirm cancel" (destructive
  styling, red) and "Never mind." Clicking "Confirm cancel" triggers the
  existing DELETE flow and spinner/status-line behavior unchanged. Clicking
  "Never mind" reverts to the normal "You're in ✓ / Cancel RSVP" display with
  no network call.
- **`/my-events` list** (`components/my-events/MyEventsList.tsx`): each list
  item's "Cancel" button behaves the same way — first click swaps that row's
  button for "Confirm cancel" / "Never mind" in place (other rows are
  unaffected and remain independently cancellable, matching today's
  per-row behavior). Confirming removes the event from the list as it does
  today; declining leaves the row untouched.

## Implementation plan

<!-- implementation-plan-json
[
  {"id":1,"title":"Build the shared ConfirmButton primitive","scope":"Create components/ui/ConfirmButton.tsx: a client component that renders its idle content (passed as children, e.g. a label and optional spinner) as a normal button until clicked, then swaps to a 'Confirm cancel' / 'Never mind' button pair. Props: children (idle content), onConfirm (called when 'Confirm cancel' is clicked, after which the component reverts to idle), pending (boolean, disables all buttons and is left for the caller to show a spinner via children), disabled (boolean, additional disable condition), className (idle button classes), confirmClassName/cancelClassName (optional overrides for the confirm-step buttons, with sensible defaults e.g. red for confirm, neutral for never-mind). Clicking 'Never mind' returns to idle without calling onConfirm. Follow the existing Tailwind utility style used by RsvpButton/MyEventsList buttons (rounded-md, border/bg patterns) for defaults.","files_to_create":["components/ui/ConfirmButton.tsx","__tests__/components/ui/ConfirmButton.test.tsx"],"files_to_modify":[],"test_file":"__tests__/components/ui/ConfirmButton.test.tsx","estimated_turns":15,"ac_items":[]},
  {"id":2,"title":"Wire ConfirmButton into RsvpButton","scope":"In components/events/RsvpButton.tsx, replace the plain 'Cancel RSVP' <button onClick={cancel}> with <ConfirmButton onConfirm={cancel} pending={pending === 'cancel'} disabled={pending !== null} className={<existing classes>}> containing the existing spinner+label children. Do not change rsvp(), the RSVP button branch, or the status paragraph. Update __tests__/components/events/RsvpButton.test.tsx: in 'cancels a held seat even on a full event and settles counts' and 'surfaces a failed cancel via its message', click the 'Cancel RSVP' button first, then click 'Confirm cancel' (getByRole('button', { name: 'Confirm cancel' })), before asserting the fetch call and outcome. Add one new unit test confirming that clicking 'Cancel RSVP' then 'Never mind' leaves myRsvp/onUpdate untouched and issues no fetch call.","files_to_create":[],"files_to_modify":["components/events/RsvpButton.tsx","__tests__/components/events/RsvpButton.test.tsx"],"test_file":"__tests__/components/events/RsvpButton.test.tsx","estimated_turns":13,"ac_items":[]},
  {"id":3,"title":"Wire ConfirmButton into MyEventsList","scope":"In components/my-events/MyEventsList.tsx, replace each row's plain 'Cancel' <button onClick={() => cancel(event.id)}> with <ConfirmButton onConfirm={() => cancel(event.id)} pending={cancellingId === event.id} disabled={cancellingId !== null} className={<existing classes>}> containing the existing spinner+label children. Do not change load(), the empty/error/loading states, or cancel(). Update __tests__/components/my-events/MyEventsList.test.tsx: in 'removes an event from the list after inline cancel' and 'keeps the event and shows the message when cancel fails', click 'Cancel' then 'Confirm cancel' before asserting. Add one new unit test confirming clicking 'Cancel' then 'Never mind' keeps the event in the list and issues no fetch call beyond the initial load.","files_to_create":[],"files_to_modify":["components/my-events/MyEventsList.tsx","__tests__/components/my-events/MyEventsList.test.tsx"],"test_file":"__tests__/components/my-events/MyEventsList.test.tsx","estimated_turns":13,"ac_items":[]},
  {"id":4,"title":"Update event-detail e2e coverage for the confirm step","scope":"In e2e/rsvp.spec.ts, update 'cancelling frees the seat and the canceller can re-RSVP' to click 'Cancel RSVP' then 'Confirm cancel' (getByRole('button', { name: 'Confirm cancel' })) before asserting the seat is released, tagging it [AC-13-2]. Add a new test tagged [AC-13-1] asserting that clicking 'Cancel RSVP' reveals the 'Confirm cancel'/'Never mind' prompt (the original button is replaced). Add a new test tagged [AC-13-3] that uses page.route to intercept and fail the test if DELETE /api/events/:id/rsvp is called, clicks 'Cancel RSVP' then 'Never mind', and asserts the seat/attendee count and 'You're in ✓' state are unchanged. Depends on step 2.","files_to_create":[],"files_to_modify":["e2e/rsvp.spec.ts"],"test_file":"e2e/rsvp.spec.ts","estimated_turns":14,"ac_items":[1,2,3]},
  {"id":5,"title":"Update /my-events and journey e2e coverage for the confirm step","scope":"In e2e/my-events.spec.ts, update 'shows upcoming RSVPs soonest-first with inline cancel and an empty state' to click 'Cancel' then 'Confirm cancel' before asserting removal, tagging it [AC-13-5]. Add a new test tagged [AC-13-4] asserting the 'Confirm cancel'/'Never mind' prompt appears in place of the clicked row's button after clicking 'Cancel'. Add a new test tagged [AC-13-6] that uses page.route to assert DELETE is never called, clicks 'Cancel' then 'Never mind' on a row, and asserts the event remains in the list. In e2e/journey.spec.ts, update the final cancel step to click 'Cancel' then 'Confirm cancel' before asserting the empty state. Depends on step 3.","files_to_create":[],"files_to_modify":["e2e/my-events.spec.ts","e2e/journey.spec.ts"],"test_file":"e2e/my-events.spec.ts","estimated_turns":14,"ac_items":[4,5,6]}
]
-->

- [ ] **Step 1: Build the shared ConfirmButton primitive** (~15 turns) — new `components/ui/ConfirmButton.tsx` two-step confirm control plus its unit tests.
- [ ] **Step 2: Wire ConfirmButton into RsvpButton** (~13 turns) — event detail page's "Cancel RSVP" goes through the confirm step; update its unit tests.
- [ ] **Step 3: Wire ConfirmButton into MyEventsList** (~13 turns) — `/my-events` inline "Cancel" goes through the confirm step; update its unit tests.
- [ ] **Step 4: Update event-detail e2e coverage for the confirm step** (~14 turns) — update/extend `e2e/rsvp.spec.ts` to click through confirm and to cover declining.
- [ ] **Step 5: Update /my-events and journey e2e coverage for the confirm step** (~14 turns) — update/extend `e2e/my-events.spec.ts` and `e2e/journey.spec.ts` to click through confirm and to cover declining.

## Design decisions

- **Two-step inline button, not a modal dialog.** The codebase has no
  existing dialog/modal pattern anywhere (`components/` has no
  dialog/modal/confirm primitive today). A two-step button reuses the exact
  interaction model the two components already have (swap in place, no
  portal, no focus trap, no escape-key/backdrop-click handling to get right),
  and is trivially driven by Testing Library and Playwright with plain
  `getByRole('button')` queries. A modal would be more visually prominent but
  introduces real accessibility surface (focus management, dismissal) that
  nothing in this codebase currently handles, for a feature whose blast
  radius is "one extra click."
- **Extract a shared `ConfirmButton` in `components/ui/`, rather than
  duplicating the confirm/decline state machine in both `RsvpButton` and
  `MyEventsList`.** Those two components already duplicate the `cancel()`
  fetch-and-pending logic (noted during research — there's no shared cancel
  hook), but that duplication is domain logic tied to each component's own
  state shape. The confirm/decline toggle, by contrast, is pure presentation
  with no dependency on either component's state — sharing it doesn't create
  the coupling that sharing the fetch call would. `components/ui/` already
  holds exactly this kind of small shared primitive (`Spinner`, `EmptyState`,
  `ErrorState`, `Skeleton`, `SeatsBadge`), so this follows the existing
  convention rather than introducing a new one.
- **No SQL/migration change.** `cancel_rsvp` (see
  `doc/data-model-and-concurrency.md`) already treats cancelling a seat you
  don't hold as a harmless no-op (`not_rsvpd`), and its row lock is scoped to
  the moment the request arrives — nothing about *when* the client decides to
  send the DELETE affects S1/S2. Confirming this let the design stay entirely
  in `components/`.
- **Consistent copy ("Confirm cancel" / "Never mind") on both surfaces**
  rather than per-surface custom wording. The user's request explicitly asks
  for the same behavior "in both places" — identical copy keeps the two e2e
  suites' selectors simple and avoids the two entry points drifting into
  different interaction patterns over time.

## Acceptance criteria

- [ ] **1.** On the event detail page, clicking "Cancel RSVP" replaces the button with a "Confirm cancel" / "Never mind" prompt instead of cancelling immediately.
- [ ] **2.** On the event detail page, clicking "Confirm cancel" releases the seat: the seat count updates and the player reverts to the "RSVP" (not-attending) state.
- [ ] **3.** On the event detail page, clicking "Never mind" after "Cancel RSVP" leaves the RSVP intact, the seat/attendee counts unchanged, and issues no `DELETE /api/events/:id/rsvp` request.
- [ ] **4.** On `/my-events`, clicking a row's "Cancel" button replaces it with a "Confirm cancel" / "Never mind" prompt instead of cancelling immediately.
- [ ] **5.** On `/my-events`, clicking "Confirm cancel" removes that event from the list.
- [ ] **6.** On `/my-events`, clicking "Never mind" after "Cancel" leaves the event in the list and issues no `DELETE /api/events/:id/rsvp` request.

## Human verification steps

None — every criterion above is verifiable against localhost with seeded
Supabase data and Playwright network interception; nothing here depends on
live external state.

## Open questions

None.
