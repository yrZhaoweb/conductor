# Conductor Templates

The concrete exchange formats between a manager and delegated workers. Store completed Task Cards under `.conductor/tasks/` and reports under `.conductor/reports/`.

## Task Card

```text
Task ID: <stable ID, e.g. P1-API-01>
Role: <implementation / testing / review / acceptance / integration / investigation>
Batch: <batch number this task belongs to>
Mode: <auto / strict>
Owner: <agent/session identifier, or unassigned>
Status: <pending / running / done / partial / blocked / failed / needs-decision>
Objective: <single bounded outcome>
Scope: <features, modules, routes, datasets, docs, or artifacts included>
Allowed paths: <files/directories the worker may edit or inspect>
Non-goals: <nearby work the worker must avoid>
Red lines: <the irreversible points that always stop, even in auto — schema, API
  contracts, auth, deletions, cross-module contracts, PRD-uncovered core decisions,
  plus any user additions>
Inputs:
- Cold-start context: <repo path, branch, commands, conventions, decisions, prior findings>
- Source artifacts: <files, tickets, screenshots, logs, URLs, data rows>
Depends-on: <task IDs or "none">
Expected evidence: <commands, tests, screenshots, file:line refs, data inspection, commits>
Stop rule: Do the certain at full speed. If you hit a decision the inputs do not
  specify and that has more than one reasonable answer, do NOT pick one — stop and
  return Needs-decision. In auto you may resolve and log only reversible, non-red-line
  points; red lines and strict mode always stop.
```

`Inputs` must assume the child agent starts cold and cannot see the manager's conversation. Include the repo path, relevant files, constraints, previous conclusions, and exact success criteria.

## Worker Prompt

A worker prompt is the Task Card plus three rules:

```text
Rules:
1. Stay in your allowed paths; do not touch unrelated areas and do not self-accept.
2. Do the certain at full speed. On an unspecified, multi-answer decision, stop and
   return Needs-decision instead of guessing (apply the Stop rule for this mode).
3. If you cannot finish, return partial/blocked with evidence and the decision needed.
```

Do not restate the Task Card fields in another format. The prompt is the Task Card plus these rules.

## Worker Report

`Needs-decision` is a first-class field: it is the reason the worker stopped, surfaced upward — not a footnote added after finishing.

```text
Task ID: <task ID>
Status: <done / partial / blocked / failed / needs-decision>
Needs-decision: <the unspecified, multi-answer point that stopped you, or "none">
  - Options considered: <A / B / ...>
  - Why not chosen: <which input is missing; red line? yes/no>
Changed: <files, artifacts, commits, or "none">
Evidence:
- <command/check/file:line/screenshot/data row> -> <result>
Findings:
- <fact or result>
Risks:
- <remaining risk, or "none known">
```

Reports without evidence are incomplete. The manager may request a corrected report or dispatch a verification task. A `needs-decision` status is not a failure — it is the worker correctly refusing to guess.

## Acceptance Gate

Acceptance is the batch fence. Its basis must be independent of the work being accepted: judge against the original intent and your own reruns, **not** the implementer's report conclusions.

```text
Task ID: <acceptance task ID>
Acceptance target: <batch / release / feature / full goal>
Basis: read .conductor/goal.md and the batch's acceptance criteria directly.
  Do NOT treat the implementer's report conclusions as evidence.

1. Criteria checked? <yes/no; list any unchecked, taken from goal.md, not from the report>
2. Evidence per criterion? <criterion -> first-hand evidence>
3. Which checks did you rerun yourself? <command / request / manual check -> result>   # required
4. What failed, was skipped, or is unverified? <explicit gaps>
5. Judgment: <pass / partial / fail / blocked>
```

Acceptance rests on `goal.md` plus at least one check the acceptance agent reran first-hand. "Looks good" and "the report says it passed" are not acceptance results. If a rerun cannot be performed, the judgment cannot be `pass` unless the user explicitly accepts that limitation.
