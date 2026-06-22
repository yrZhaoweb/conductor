Task ID: P1-IMPL-01
Status: done
Needs-decision: none

Changed files:
- `web/app/globals.css`
- `web/components/layout/workbench-shell.tsx`
- `web/app/workbench/dashboard/page.tsx`

Summary:
- Retargeted global workbench-facing tokens toward the reference: `#f5f7fb` page background, `#2f7cff` primary, lighter lines, white sidebar surfaces, 186px sidebar width, 54px topbar height, and softer shadows.
- Converted the desktop workbench shell from dark gradient chrome to a compact white admin shell with white sidebar/topbar, blue active nav state, compact nav rows, and a light user footer.
- Kept all existing route entries visible. Desktop nav descriptions are hidden only in the sidebar presentation to preserve compact rows; mobile keeps the descriptions.
- Tightened the dashboard into a denser operational overview with smaller header, compact next-action panel, smaller cards, less vertical spacing, 8px card radii, and no dark task-signal block.

Verification:
- `pnpm --dir web build`
  - Passed.
  - Evidence: Next.js compiled successfully, TypeScript finished, and static generation completed for 69 pages.
- Initial task-card graph command form:
  - `graphify web --update`
  - Failed with: `error: unknown command 'web'`.
- Equivalent local CLI graph update:
  - `graphify update web`
  - Passed.
  - Evidence: `[graphify watch] Rebuilt: 1088 nodes, 2163 edges, 205 communities`.
  - Output files refreshed at `web/graphify-out/graph.json` and `web/graphify-out/GRAPH_REPORT.md` with Jun 16 08:21 mtime.

Notes:
- No API, auth, permission, server, database, seed, route contract, or `.env` files were modified.
- `web/components/layout/workbench-nav.tsx` was read but intentionally left unchanged because route visibility/capability preservation did not require data edits.
