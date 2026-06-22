# Conductor Plan

## Batch 0: Planning

Status: in progress

Outputs:
- `.conductor/goal.md`
- `.conductor/plan.md`
- implementation and acceptance task cards
- Claude app collaboration prompt sent through Computer Use

Acceptance criteria:
- Plan matches the user's original intent and red lines.
- Planned write paths do not overlap across parallel implementation workers.
- Verification includes `graphify web --update` if `web/` changes.

## Batch 1: Minimal UI Direction Shift

Dependency: Batch 0 accepted.

Tasks:
- `P1-IMPL-01`: implementation worker owns the compact tk-star visual shift in the workbench shell/dashboard/global tokens.
- `P1-ACC-01`: independent acceptance worker reruns checks and compares output against `.conductor/goal.md`.

Allowed implementation write paths:
- `web/app/globals.css`
- `web/components/layout/workbench-shell.tsx`
- `web/components/layout/workbench-nav.tsx`
- `web/app/workbench/dashboard/page.tsx`

Implementation guardrails:
- Keep route targets and existing capabilities available.
- Prefer style and layout changes over behavior changes.
- If hiding a feature entry risks breaking route discoverability or existing tests, keep it visible and compact it instead.
- Stop on red lines.

Batch 1 acceptance criteria:
- Workbench has a light compact shell inspired by tk-star: white sidebar/topbar, smaller sidebar width, compact nav rows, blue primary state, neutral background.
- Dashboard reads as a dense operational overview rather than a hero/marketing-style page.
- Existing workbench routes remain accessible.
- No auth/API/database/server contracts changed.
- `graphify web --update` was run after `web/` changes and reported a valid graph or no file changes.
- At least one focused verification command or runtime browser/screenshot check was rerun by the acceptance worker.

## Collaboration

Claude app was asked via Computer Use to provide:
- reference interpretation,
- minimal change advice,
- acceptance checklist,
- red-line risks.

Claude was instructed not to modify files to avoid uncontrolled write overlap. Its Batch 0
collaboration summary is persisted at `.conductor/reports/P0-CLAUDE.md`.

Batch 1 acceptance must include Claude's checklist from `.conductor/reports/P0-CLAUDE.md`.
After implementation, the manager should use Computer Use to ask Claude for a final
read-only acceptance opinion if the app is responsive; if Claude is unavailable, acceptance
must record that gap explicitly and proceed only on Codex first-hand evidence.

## Batch 0 Fence Result

Initial independent acceptance was partial. The required amendments were:
- require implementer-side `graphify web --update`,
- persist Claude collaboration evidence,
- clarify Claude's role in final acceptance.

These amendments were applied before Batch 1 dispatch.
