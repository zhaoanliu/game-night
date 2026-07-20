# CI, CD, and the automation pipeline

The repo enforces its own process: `main` is read-only, every change —
including the README — started as a GitHub issue, was built on a branch in a
worktree, and arrived via a PR gated by the required checks. The rules live in
[`CLAUDE.md`](../CLAUDE.md), so every session (human-driven or bot) inherits
them.

## Required checks

Every PR is gated by five required checks: `lint` (ESLint, tsc, route-export
check, actionlint), `unit` (coverage thresholds plus an acceptance-criteria
gate), `build`, `integration` (the S1/S2 concurrency proof against a real
Postgres), and `e2e` (the full Playwright suite against a **production build**
and a real local Supabase). Docs-only PRs skip the heavy jobs via a
detect-doc-only gate while still satisfying branch protection.

## The automation pipeline

The repo runs the
[claude-dev-automation](https://github.com/zhaoanliu/claude-dev-automation)
pipeline, pinned at `@v2.0.0` (a release cut for this adoption: the previously
vendor-and-adapt pieces — `verify-ac`, the retry script, the AC-coverage
gate — were generalized behind action inputs, so this repo vendors nothing):

- **Feature factory** — labeling an issue `status: approved` generates a
  design issue with acceptance criteria (`[AC-<design>-<n>]` tags) and a
  machine-readable plan; `status: auto-implement` implements it sub-task by
  sub-task, generates Playwright tests from the acceptance criteria,
  self-heals failures, and opens a PR that is always human-merged
  (`manual merge required`).
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

## What was delegated vs. built directly

Not everything was built the same way, on purpose:

- **The graded heart was built directly and reviewed line-by-line.** The
  schema, the two locked SQL functions, the auth boundary, and the integration
  suite that proves S1/S2 were written first, slowly, before any UI existed —
  the concurrency proof landed in the same PR as the API it proves.
- **The repetitive perimeter was delegated.** UI states, Playwright specs,
  CI plumbing, and fix-ups ran through the automation pipeline above, with
  review at the PR boundary instead of the keystroke boundary.
- **The pipeline was dogfooded on throwaway work before being trusted with
  real work.** In Phase D a canary feature (#19, a site footer) ran the
  factory end-to-end — `status: approved` generated a design issue with
  acceptance criteria, `status: auto-implement` built it with Playwright
  tests generated from those criteria, and opened PR #23 — which was then
  deliberately closed unmerged: the point was proving the pipeline, not
  shipping a footer. In Phase F the design stage ran on backlog issue #13,
  and human review of the generated design (#29) caught a real defect —
  acceptance-criteria tags numbered against the wrong issue, which would
  have failed the AC-coverage gate. The human gates are not ceremony.

Verification did not rely on trust in generation: every claim in the README
maps to a check that fails if it stops being true — the integration suite for
the invariants, AC-tagged e2e specs for the user stories, coverage thresholds,
a route-shape check, and a clean-clone drill of the run instructions as the
final step.
