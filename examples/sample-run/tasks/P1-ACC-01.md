Task ID: P1-ACC-01
Role: acceptance
Batch: 1
Mode: auto
Owner: Codex worker
Status: pending
Objective: Independently accept or reject Batch 1 against `.conductor/goal.md`.
Scope: Verify the implemented UI direction, preservation of capabilities, graph update, and focused checks.
Allowed paths:
- Read all project files as needed.
- Write report only to `/Users/yrzhao/yunspace/yunfan-star/.conductor/reports/P1-ACC-01.md`.
- May run graphify update commands that refresh ignored graph output under `web/graphify-out/`.
Non-goals:
- Do not implement fixes.
- Do not accept based only on the implementation report.
- Do not modify app code.
Red lines: database/migrations, external APIs, auth/permissions, deletions, shared contracts, core functionality not specified, `.env`/secrets.
Inputs:
- Basis: `/Users/yrzhao/yunspace/yunfan-star/.conductor/goal.md` and Batch 1 acceptance criteria in `.conductor/plan.md`.
- Claude checklist: `/Users/yrzhao/yunspace/yunfan-star/.conductor/reports/P0-CLAUDE.md`.
- Reference: `/Users/yrzhao/Desktop/tk-star.html`.
- Expected changed area: `web/app/globals.css`, `web/components/layout/workbench-shell.tsx`, `web/components/layout/workbench-nav.tsx`, `web/app/workbench/dashboard/page.tsx`.
Depends-on: P1-IMPL-01.
Expected evidence:
- Rerun at least one focused command/check yourself.
- Confirm `graphify web --update` was run after web changes, or run it if missing.
- Inspect `git diff -- web/...` for scope and red-line violations.
- Use a runtime/browser/screenshot check if feasible.
Stop rule: Do the certain at full speed. If you hit an unspecified multi-answer decision, do not guess. In auto you may resolve and log only reversible, non-red-line points; red lines always stop.

Rules:
1. Stay in your allowed paths; do not touch app code and do not rely on implementer conclusions.
2. Do the certain at full speed. On an unspecified, multi-answer decision, stop and return Needs-decision instead of guessing.
3. If you cannot finish, return partial/blocked with evidence and the decision needed.
