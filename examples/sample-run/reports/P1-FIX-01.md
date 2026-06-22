Task ID: P1-FIX-01
Role: implementation
Status: done
Needs-decision: none

## Summary

Restored the global `--side` and `--side-2` tokens to dark semantic values while leaving the new workbench shell white sidebar intact through its explicit `bg-white` class. Updated the focused `WorkbenchShell` test to assert the new light/blue selected nav styling instead of the removed lime/dark styling.

## Changed Files

- `web/app/globals.css`
- `web/tests/workbench-shell.test.ts`

Note: pre-existing modified files from the upstream batch remained present in `web/app/workbench/dashboard/page.tsx` and `web/components/layout/workbench-shell.tsx`; this worker did not modify them.

## Verification

Passed:

```bash
pnpm --dir web test tests/workbench-shell.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

Passed:

```bash
pnpm --dir web build
```

Result: Next.js production build compiled successfully, TypeScript completed, and static generation completed for 69 pages.

Passed:

```bash
graphify update web
```

Result:

```text
[graphify watch] Rebuilt: 1088 nodes, 2163 edges, 205 communities
[graphify watch] graph.json, graph.html and GRAPH_REPORT.md updated in /Users/yrzhao/yunspace/yunfan-star/web/graphify-out
```

## Notes

- `--side` restored to `#070a14`.
- `--side-2` restored to `#11172a`.
- The selected nav test now checks for `border-transparent bg-[var(--hot-soft)] text-[var(--hot-deep)]`.
