Task ID: P1-IMPL-01
Role: implementation
Batch: 1
Mode: auto
Owner: Codex worker
Status: pending
Objective: Make the authenticated workbench visually closer to `/Users/yrzhao/Desktop/tk-star.html` with minimal presentation-only changes.
Scope: Workbench shell, dashboard, nav presentation, and global design tokens.
Allowed paths:
- `/Users/yrzhao/yunspace/yunfan-star/web/app/globals.css`
- `/Users/yrzhao/yunspace/yunfan-star/web/components/layout/workbench-shell.tsx`
- `/Users/yrzhao/yunspace/yunfan-star/web/components/layout/workbench-nav.tsx`
- `/Users/yrzhao/yunspace/yunfan-star/web/app/workbench/dashboard/page.tsx`
Non-goals:
- Do not modify backend, auth, permission, API, database, seed data, or route contracts.
- Do not delete routes or capabilities.
- Do not edit `.env`.
- Do not broad-refactor unrelated pages.
Red lines: database/migrations, external APIs, auth/permissions, deletions, shared contracts, core functionality not specified, `.env`/secrets.
Inputs:
- Cold-start context: repo `/Users/yrzhao/yunspace/yunfan-star`; Next.js app under `web/`; use existing Tailwind/CSS-variable style.
- Source artifacts: `.conductor/goal.md`, `.conductor/plan.md`, `/Users/yrzhao/Desktop/tk-star.html`.
- Current relevant files: `web/app/globals.css`, `web/components/layout/workbench-shell.tsx`, `web/components/layout/workbench-nav.tsx`, `web/app/workbench/dashboard/page.tsx`.
- Reference direction: light compact admin UI, white sidebar/topbar, neutral `#f5f7fb` background, blue primary, compact nav rows, dense metric cards, restrained text.
- Auto decision: keep existing navigation route entries visible and compact instead of hiding them because current tests/workflows rely on sidebar links.
Depends-on: Batch 0 acceptance.
Expected evidence:
- Changed files list.
- Focused check such as `pnpm --dir web build` or a narrower feasible type/test command.
- `graphify web --update` after any `web/` file change, with the graph result or valid no-change message.
- If build is too slow/fails from pre-existing unrelated issues, report exact evidence.
Stop rule: Do the certain at full speed. If you hit an unspecified multi-answer decision, do not guess. In auto you may resolve and log only reversible, non-red-line points; red lines always stop.

Rules:
1. Stay in your allowed paths; do not touch unrelated areas and do not self-accept.
2. Do the certain at full speed. On an unspecified, multi-answer decision, stop and return Needs-decision instead of guessing.
3. If you cannot finish, return partial/blocked with evidence and the decision needed.
