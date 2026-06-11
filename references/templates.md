# Conductor Templates

Use these templates as the concrete exchange format between a manager and delegated workers. Store completed task cards under `.conductor/tasks/` and reports under `.conductor/reports/`.

## Task Card

```text
Task ID: <stable ID, e.g. P1-API-01>
Role: <implementation / testing / review / acceptance / integration / investigation>
Owner: <agent/session identifier, or unassigned>
Status: <pending / running / done / partial / blocked / failed>
Objective: <single bounded outcome>
Scope: <features, modules, routes, datasets, docs, or artifacts included>
Allowed paths: <files/directories the worker may edit or inspect>
Non-goals: <nearby work the worker must avoid>
Inputs:
- Cold-start context: <repo path, branch, commands, conventions, decisions, prior findings>
- Source artifacts: <files, tickets, screenshots, logs, URLs, data rows>
Depends-on: <task IDs or "none">
Expected evidence: <commands, tests, screenshots, file:line refs, data inspection, commits>
Stop condition: <when to stop and report instead of guessing>
```

`Inputs` must assume the child agent starts cold and cannot see the manager's conversation. Include repo path, relevant files, constraints, previous conclusions, and exact success criteria.

## Worker Prompt

Build the worker prompt from the Task Card, then append:

```text
Expected output:
- Worker Report using the required template
- Evidence: commands, tests, logs, file:line references, screenshots, data rows, or commit IDs
- Risks or unresolved blockers

Rules:
- Do not modify unrelated areas.
- Do not self-accept unless you were explicitly assigned the acceptance role.
- Stop and report if scope is coupled with another slice.
- If you cannot complete the task, return partial/blocked with evidence and the manager decision needed.
```

Do not duplicate the Task Card fields manually in another format. The prompt is the Task Card plus these rules.

## Worker Report

```text
Task ID: <task ID>
Status: <done / partial / blocked / failed>
Changed: <files, artifacts, commits, or "none">
Evidence:
- <command/check/file:line/screenshot/data row> -> <result>
Findings:
- <fact or result>
Risks:
- <remaining risk, or "none known">
Needs-manager-decision:
- <decision needed, or "none">
```

Reports without evidence are incomplete. The manager may ask for a corrected report or dispatch a verification task.

## Acceptance Gate

Acceptance agents must answer:

```text
Task ID: <acceptance task ID>
Acceptance target: <phase, release, feature, or full goal>
1. Were all success criteria checked? <yes/no, list unchecked criteria>
2. What evidence proves each checked criterion? <criterion -> evidence>
3. Which checks did you rerun yourself? <command/request/manual check -> result>
4. What failed, was skipped, or remains unverified? <explicit gaps>
5. Final judgment: <pass / partial / fail / blocked>
```

Acceptance must be based on returned evidence plus at least one independently rerun key check. "Looks good" is not an acceptance result.

If a rerun cannot be performed, the final judgment cannot be `pass` unless the user explicitly accepts that limitation.
