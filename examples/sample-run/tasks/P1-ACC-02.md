Task ID: P1-ACC-02
Role: acceptance
Batch: 1
Mode: auto
Owner: Codex worker
Status: pending
Objective: Re-accept Batch 1 after P1-FIX-01.
Scope: Verify the tk-star visual direction, capability preservation, graph update, fixed `--side` residual risk, and updated focused test.
Allowed paths:
- Read all project files as needed.
- Write report only to `/Users/yrzhao/yunspace/yunfan-star/.conductor/reports/P1-ACC-02.md`.
- May run graphify update commands that refresh ignored graph output under `web/graphify-out/`.
Non-goals:
- Do not implement fixes.
- Do not accept based only on worker conclusions.
- Do not modify app code.
Red lines: database/migrations, external APIs, auth/permissions, deletions, shared contracts, core functionality not specified, `.env`/secrets.
Inputs:
- Basis: `.conductor/goal.md`, `.conductor/plan.md`, `.conductor/reports/P0-CLAUDE.md`, `.conductor/reports/P1-IMPL-01.md`, `.conductor/reports/P1-ACC-01.md`, `.conductor/reports/P1-FIX-01.md`.
- Claude final read-only acceptance identified R1: global `--side` white caused white-on-white in unchanged pages; verify `--side` and `--side-2` are dark again.
- Expected changed tracked files after fix: `web/app/globals.css`, `web/components/layout/workbench-shell.tsx`, `web/app/workbench/dashboard/page.tsx`, `web/tests/workbench-shell.test.ts`.
Depends-on: P1-FIX-01.
Expected evidence:
- Inspect `git diff --stat` and relevant diff.
- Rerun `pnpm --dir web test tests/workbench-shell.test.ts`.
- Rerun `pnpm --dir web build` if feasible.
- Confirm graph update, using `graphify update web` if local CLI rejects `graphify web --update`.
- Verify no API/auth/server/database/.env tracked files changed.
Stop rule: Do the certain at full speed. If you hit an unspecified multi-answer decision, do not guess. In auto you may resolve and log only reversible, non-red-line points; red lines always stop.

Rules:
1. Stay in your allowed paths; do not touch app code and do not rely on implementer conclusions.
2. Do the certain at full speed. On an unspecified, multi-answer decision, stop and return Needs-decision instead of guessing.
3. If you cannot finish, return partial/blocked with evidence and the decision needed.

