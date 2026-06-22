# Conductor Templates

The concrete exchange formats between a manager, delegated workers, acceptance agents, and external reviewers.

Store completed Task Cards under `RUN_ROOT/tasks/` and reports under `RUN_ROOT/reports/`, where `RUN_ROOT` is the unique per-goal directory chosen by the manager, for example `.conductor/runs/20260622-1430-h5-chat/`.

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
  plus any user additions; mark "red-line-triggered" if Allowed paths match a sensitive
  pattern (migrations, *.proto, auth/, shared config/types) so the worker stops there
  even if it does not recognize the global impact>
Inputs:
- Cold-start context: <repo path, branch, commands, conventions, decisions, prior findings>
- Run root: <RUN_ROOT path; write reports/tasks only inside this run root>
- Source artifacts: <files, tickets, screenshots, logs, URLs, data rows>
Depends-on: <task IDs or "none">
Expected evidence: <commands, tests, screenshots, file:line refs, data inspection, commits>
Stop rule: Do the certain at full speed. If you hit a decision the inputs do not
  specify and that has more than one reasonable answer, do NOT pick one — stop and
  return Needs-decision. In auto you may resolve and log only reversible, non-red-line
  points; red lines and strict mode always stop.
```

`Inputs` must assume the child agent starts cold and cannot see the manager's conversation. Include the repo path, relevant files, constraints, previous conclusions, and exact success criteria.

### Task Card JSON

When the harness is active, store a machine-readable mirror beside the Markdown card:

```json
{
  "schemaVersion": 1,
  "taskId": "P1-IMPL-01",
  "role": "implementation",
  "batch": 1,
  "mode": "auto",
  "status": "pending",
  "objective": "single bounded outcome",
  "scope": "included surfaces",
  "allowedPaths": ["src/feature/**"],
  "readPaths": ["src/shared/**"],
  "nonGoals": ["do not edit auth"],
  "redLines": ["database/migrations", "auth/permissions"],
  "redLineTriggered": false,
  "dependsOn": [],
  "expectedEvidence": ["npm test"],
  "reportPath": "reports/P1-IMPL-01.md"
}
```

The Markdown card remains the human prompt. The JSON card is what `conductor-harness`
uses for worktree setup, merge metadata, and optional path checks.

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
Basis: read <RUN_ROOT>/goal.md and the batch's acceptance criteria directly.
  Do NOT treat the implementer's report conclusions as evidence.

1. Criteria checked? <yes/no; list any unchecked, taken from goal.md, not from the report>
2. Evidence per criterion? <criterion -> first-hand evidence>
3. Which checks did you rerun yourself? <command / request / manual check -> result>   # required
4. What failed, was skipped, or is unverified? <explicit gaps>
5. Judgment: <pass / partial / fail / blocked>
```

Use the actual `RUN_ROOT/goal.md` path in the `Basis` line. If the acceptance target includes a runtime-only batch, distinguish code/static evidence from live runtime evidence and state any runtime mutations separately.

Acceptance rests on `goal.md` plus at least one check the acceptance agent reran first-hand. "Looks good" and "the report says it passed" are not acceptance results. If a rerun cannot be performed, the judgment cannot be `pass` unless the user explicitly accepts that limitation.

### Harness Verdict

When the harness is active, the fence source of truth is the signed
`RUN_ROOT/batches/<N>/verdict.json`, not a Markdown status line:

```json
{
  "schemaVersion": 1,
  "batch": 1,
  "taskId": "P1-ACC-01",
  "verdict": "PASS",
  "criteria": [
    {
      "id": "C1",
      "status": "pass",
      "evidenceRefs": ["R1"]
    }
  ],
  "rerunLogs": [
    {
      "id": "R1",
      "path": "batches/1/acceptance/reruns/R1.log",
      "sha256": "<log hash>",
      "command": "npm test",
      "exitCode": 0
    }
  ],
  "signature": {
    "algorithm": "ed25519",
    "keyId": "<public key hash>",
    "value": "<signed verdict payload>"
  }
}
```

`conductor-harness batch start --batch N+1` accepts only a signed `PASS` verdict whose
rerun logs still exist and match their recorded hashes.

## External Acceptance Prompt

Use this when the user requires a named external participant, such as Claude App, Browser/Chrome, Computer Use, another model session, or a human reviewer. The prompt must be self-contained because the reviewer may not share the manager's conversation context.

```text
External checkpoint: <batch/final goal>

Please judge this as PASS / FAIL / PARTIAL / BLOCKED.
If FAIL, list required rework. If PASS, list any non-blocking residuals.

Original goal:
<one-paragraph user goal and success criteria>

Scope of this checkpoint:
<what should be accepted now; what is out of scope>

Evidence to inspect:
- Goal/plan: <RUN_ROOT/goal.md>, <RUN_ROOT/plan.md>
- Worker/runtime reports: <paths>
- Independent acceptance reports: <paths>
- Relevant files, commands, URLs, screenshots, rows, or logs: <paths/details>

Known residuals to classify:
- <residual> -> please decide blocker / non-blocking residual / follow-up checklist

Questions for you:
1. Does the evidence satisfy the original goal for this checkpoint?
2. Are any residuals blockers?
3. What is your explicit judgment: PASS / FAIL / PARTIAL / BLOCKED?
```

Persist the external review result as `RUN_ROOT/reports/<checkpoint>-EXTERNAL-<reviewer>.md`.
