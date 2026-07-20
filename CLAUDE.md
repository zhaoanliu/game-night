# Game Night — Claude Code Instructions

Community event board for tabletop gamers. Next.js 15 (App Router) + Supabase +
Tailwind v4, tested with Vitest and Playwright, deployed on Vercel.

## Commands

```bash
npm run setup           # supabase start + db reset + dev server (first run)
npm run dev             # dev server (Supabase already running)
npm run build           # production build
npm run lint            # ESLint
npx tsc --noEmit        # type-check
npm run check:routes    # route files may only export HTTP verbs
npm test                # unit tests
npm run test:coverage   # unit tests WITH coverage — the command CI runs
npm run test:integration # HTTP-level concurrency suite (needs Supabase running)
npm run test:e2e        # Playwright against the dev server
npx playwright test -c playwright.config.local.ts   # E2E against a production build
npx supabase db reset   # re-apply migrations + reseed
```

## The invariants this product exists to get right

**S1 (capacity) and S2 (one RSVP per player) are enforced in the database, not
in application code.** Every RSVP mutation goes through `rsvp_to_event` /
`cancel_rsvp` in `supabase/migrations/`, which lock the event row `FOR UPDATE`.
Read `doc/data-model-and-concurrency.md` before changing anything in this path —
and update it in the same PR if you do.

- **Nothing writes `rsvps` outside those functions**, and the database enforces
  it: `service_role` is granted `select` on `rsvps` but not `insert`, `update`,
  or `delete`. A route handler or test that tries to write the table directly
  gets `permission denied`, not a subtly broken capacity check. Do not "fix"
  such a failure by adding the missing grant — call the function instead.
- The `primary key (event_id, player_id)` is defense in depth for S2. Do not
  replace it with a surrogate id, and do not treat it as the primary S2
  mechanism — the duplicate check inside the locked function is.
- Changing anything in the RSVP path requires the integration suite
  (`__tests__/integration/`) to pass — it is the proof, not a formality.

## Git workflow

**`main` is read-only. Never edit or commit files directly on `main`.** This
applies to every file change — code, config, CI workflows, docs, CLAUDE.md.

Before the first Edit or Write call in any session: (1) create an issue,
(2) create a worktree.

1. `gh issue create` with a clear, plain-text title. Add `status: in progress`
   if implementing immediately in the same session.
2. `git worktree add ../game-night-N -b <branch> origin/main` — base on
   `origin/main`, work inside the worktree. Branch naming:
   `feat/issue-N-<slug>`, `fix/issue-N-<slug>`, `docs/issue-N-<slug>`.
3. Open a PR titled `<issue title> (#N)` with `Closes #N` in the body.

**Never use `cd /path && <command>`** — permission allowlists match the leading
token. Use `git -C /abs/path` and absolute paths.

**Never hardcode local absolute paths in committed files.**

Bundle related changes — code and the docs explaining them go in one commit.

## Automation pipeline

CI and bot workflows come from claude-dev-automation, pinned `@v2.0.0` — bump
pins deliberately, never reference `@main`. Required PR checks: `lint`, `unit`,
`build`, `integration`, `e2e`. Any CI failure dispatches a `ci-failure` event
that ci-auto-fix.yml picks up (it mirrors the required checks locally, e2e
excluded). Label-driven flows: `status: approved` on a feature issue generates
a design issue; `status: auto-implement` implements the approved design and
opens a PR (`manual merge required` — bots never merge feature PRs); `bug`
triggers the bug-fix bot. Bot-facing prompts live in the workflow files — when
an invariant in this file changes, grep `.github/workflows/` for the old
wording and update the prompts in the same PR.

## Testing

- **Run `npm run test:coverage` before committing**, not bare `npm test` —
  thresholds (lines 85 / functions 65 / branches 80 / statements 85) fail CI.
- **Every user-facing change needs an E2E test in the same PR.**
- **Run E2E against a production build** (`playwright.config.local.ts`) before
  merging — dev servers hide SSR/hydration and chunk-isolation bugs. CI enforces
  this: the `e2e` required check runs the full suite against a production build.
- Acceptance criteria are tagged in test descriptions as `[AC-<issue>-<n>]`;
  the AC-coverage gate (`check-ac-coverage` from claude-dev-automation@v2.0.0,
  in test.yml's `unit` job) fails PRs unless every criterion on a linked design
  issue has a passing tagged test (unit or e2e).
- Integration tests own their fixtures: they create their own users and events
  via the service client and clean up after themselves. Never depend on
  `seed.sql` rows in an integration test — the seed is for humans and for the
  seed-contract test only.

## Code conventions

- No comments unless the WHY is non-obvious.
- Route files (`app/**/route.ts`) export HTTP verbs only — `npm run check:routes`.
- All data access is server-side through `lib/supabase/service.ts`; identity and
  role checks live in `lib/auth.ts` and run on **every** write.
- Errors use the envelope in `lib/api.ts` (`{error: {code, message}}`) — throw
  `ApiError`, never hand-roll a `NextResponse.json` error.
- **Env-var guards must never be removed** — a missing env var should fail loudly.
- Supabase errors: log with `error.message`, not the bare object
  (`console.error('ctx:', error.message, error)`) — objects log as `[object Object]`.
- `gh` read commands don't need confirmation; pause only for destructive ops.

## Schema changes

1. New migration file in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`),
   idempotent (`create table if not exists`, `create or replace function`).
2. `npx supabase db reset` locally to verify it applies from scratch.
3. Update `lib/types.ts` to match.
4. Update tests. Merging to `main` runs the migration against production before
   the deploy — a migration that fails there blocks the deploy.

## Documentation

**After every change, check whether README.md needs updating** and update it in
the same commit. The README is a graded deliverable: run instructions, design
decisions, the counts/freshness choice, time spent, and the "before real
traffic" list all live there.

When updating CLAUDE.md, grep for related terms first and remove anything
superseded.
