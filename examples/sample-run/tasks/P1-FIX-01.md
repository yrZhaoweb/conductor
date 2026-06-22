Task ID: P1-FIX-01
Role: implementation
Batch: 1
Mode: auto
Owner: Codex worker
Status: pending
Objective: Fix Batch 1 acceptance regressions without broadening the UI rewrite.
Scope: Restore global `--side` dark semantic so unchanged pages that use it as a dark button/panel remain readable, while preserving the new explicit white workbench shell. Update the focused WorkbenchShell test to assert the new blue/light selected nav styling.
Allowed paths:
- `/Users/yrzhao/yunspace/yunfan-star/web/app/globals.css`
- `/Users/yrzhao/yunspace/yunfan-star/web/tests/workbench-shell.test.ts`
Non-goals:
- Do not modify backend, auth, permission, API, database, seed data, or route contracts.
- Do not delete routes or capabilities.
- Do not edit `.env`.
- Do not broaden the visual rewrite into products/crm/marketing pages unless the `--side` semantic restoration is impossible.
Red lines: database/migrations, external APIs, auth/permissions, deletions, shared contracts, core functionality not specified, `.env`/secrets.
Inputs:
- Acceptance report: `.conductor/reports/P1-ACC-01.md`.
- Claude final read-only acceptance found that global `--side` changed from dark to white, causing white-on-white risk in unchanged pages.
- Existing workbench shell now uses explicit `bg-white`, so `--side` can return to a dark semantic without losing the white sidebar.
- Focused test failure: `web/tests/workbench-shell.test.ts` line 121 asserts old `border-[rgba(207,255,45,0.55)]`; update it to the new selected nav class signal.
Depends-on: P1-ACC-01 Needs-decision and Claude PARTIAL.
Expected evidence:
- Changed files list.
- `pnpm --dir web test tests/workbench-shell.test.ts`.
- `pnpm --dir web build` if feasible.
- `graphify update web` after `web/` file changes, with nonzero graph output.
Stop rule: Do the certain at full speed. If you hit an unspecified multi-answer decision, do not guess. In auto you may resolve and log only reversible, non-red-line points; red lines always stop.

Rules:
1. Stay in your allowed paths; do not touch unrelated areas and do not self-accept.
2. Do the certain at full speed. On an unspecified, multi-answer decision, stop and return Needs-decision instead of guessing.
3. If you cannot finish, return partial/blocked with evidence and the decision needed.

