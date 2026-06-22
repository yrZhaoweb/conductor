# Goal: move yunfan-star toward tk-star

Mode: auto
Level: standard
Repo: /Users/yrzhao/yunspace/yunfan-star
Reference: file:///Users/yrzhao/Desktop/tk-star.html
Started: 2026-06-16

## Original Intent

Modify the current project toward the visual and interaction direction of
`/Users/yrzhao/Desktop/tk-star.html`.

User constraints:
- Do not delete existing capabilities.
- Existing page feature entries/buttons may be hidden.
- Prefer subtraction and the smallest useful code changes.
- Use Computer Use to involve Claude app as a collaborator.
- Complete and accept the work together.

## Effective Red Lines

Default conductor red lines apply:
- Database structure or migrations.
- External or cross-service API contracts.
- Permission and authentication logic.
- Deletion or irreversible operations.
- Cross-module shared contracts.
- Core-functionality decisions not covered by the goal.

Project-specific additions:
- Do not read, paste, or transmit `.env` secrets.
- Do not remove routes, server handlers, data models, or existing business flows.
- Do not change test credentials or auth/session behavior.

## Success Criteria

1. The authenticated workbench visually moves toward `tk-star.html`: light compact admin shell, white sidebar/topbar, blue primary accents, compact cards, restrained text, and dense dashboard layout.
2. Existing capabilities remain available by route and no business/API/auth/database files are removed or contractually changed.
3. Implementation is surgical and primarily limited to presentation files under `web/`.
4. Any files changed under `web/` are followed by `graphify web --update`.
5. Focused verification runs: type/build or lint where feasible, at least one workbench runtime/screenshot check, and graphify update.
6. Independent acceptance checks the result against this file and reruns first-hand verification.

## Non-goals

- Rebuilding the app as the standalone `tk-star.html`.
- Recreating every demo screen or every data widget from the reference.
- Adding new backend functionality.
- Refactoring unrelated modules.
- Changing authentication, permissions, database schema, or external API contracts.

