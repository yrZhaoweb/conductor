# Sample Run — real Conductor artifacts

This is **not a hand-written ideal flow.** It is the actual on-disk `RUN_ROOT` from a
real Conductor run, copied here essentially unchanged: two checked-in test credentials
are redacted, and one line in `batches/0/summary.md` is annotated where it referenced an
acceptance report that was never persisted to disk (see Notes / fidelity). It exists so
the skill can be judged against first-hand evidence instead of its own prose — the same
standard Conductor demands of its acceptance agents.

- **Goal:** move the `yunfan-star` web app toward a reference admin UI (`tk-star.html`).
- **Mode:** `auto`  ·  **Level:** standard  ·  **Date:** 2026-06-16
- **Runtime:** Codex workers for implementation/acceptance, Claude app (via Computer
  Use) as a read-only external acceptance participant.

## Why this run is good evidence

Conductor's central claims are that the **judge is independent of the writer**, that
**uncertainty stops instead of being guessed**, and that **errors are caught at a fence
instead of compounding**. This run shows each one actually happening, not asserted:

| Conductor claim | Where it happened in this run |
| --- | --- |
| Planning passes its own fence | `reports/P0-ACC-01.md` returned **partial** and forced three plan amendments before any building started (`plan.md` → "Batch 0 Fence Result"). |
| auto logs reversible calls, doesn't guess silently | `decisions.md` records the one reversible decision (keep nav entries visible) with its reason. |
| Acceptance is independent of the implementer's report | `reports/P1-ACC-01.md` reran the build and the focused test **itself**, caught a stale test the implementer's "done" report missed, and returned **Needs-decision** instead of rubber-stamping. |
| Errors stay inside one batch | The stale test + a `--side` token regression were fixed by `P1-FIX-01` and re-accepted by `P1-ACC-02` **before** the fence opened — nothing crossed into a later batch. |
| External/joint acceptance is a formal fence member | `reports/P0-CLAUDE.md` and `reports/P1-CLAUDE-FINAL.md` are the persisted Claude-app checklist and final PASS, gathered via Computer Use. |
| Runtime limits are recorded, not faked | `reports/P1-ACC-01.md` documents that the authenticated screenshot could not be taken (login rejected) and explicitly refuses to convert that gap into a pass. |

## Reading order

1. `goal.md` — original-intent anchor + effective red lines (default + project additions).
2. `plan.md` — batches, allowed write paths, per-batch acceptance criteria, and the
   Batch 0 fence result.
3. `tasks/` — the actual Task Cards dispatched to workers (cold-start `Inputs`, `Allowed
   paths`, `Stop rule`).
4. `reports/` — worker, acceptance, and external-acceptance results, each with first-hand
   evidence.
5. `batches/*/summary.md` — the one-line-per-batch state kept after each fence closed.
6. `decisions.md` — the auto-mode decision log the user scans on return.

## Notes / fidelity

- Absolute paths (`/Users/...`) and project-specific commands (`graphify update web`)
  are left as-run, so the evidence stays verifiable rather than idealized.
- Two checked-in non-secret test accounts in `reports/P1-ACC-01.md` were replaced with
  `<test-account-N>` / `<redacted>`. They had already failed login in the run, so the
  evidence is unaffected.
- This run predates the P2 mechanism changes (planning-batch assumption list, allowed-path
  red-line auto-flagging, read-after-write boundary check). It shows the contract those
  changes harden, not the hardened wording itself.
- It also predates the run-root isolation convention. Its files sit at top-level
  `.conductor/` (e.g. `.conductor/goal.md`) rather than under `.conductor/runs/<date>-<slug>/`.
  Current SKILL.md forbids that top-level layout — treat these paths as a historical
  artifact, not a template to copy.
- `batches/0/summary.md` originally cited a re-acceptance report (`P0-ACC-02.md`) that was
  never written to disk; that line is annotated here to record the gap honestly instead of
  inventing the missing file (see below).
