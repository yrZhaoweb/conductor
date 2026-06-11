---
name: conductor
description: Use when a user asks for a manager/管理者会话 to coordinate 子agent or multi-agent work for a large goal, task pack, parallel modules, phases, or phrases like 多 agent, 每个模块启用一个子 agent, 管理者不参与开发/测试/review/验收, 巨大目标, or delegated acceptance.
---

# Conductor

## Overview

Use this skill to keep the current session as the manager: define the goal, split all executable work, delegate to agents, track progress, and summarize outcomes.

The manager owns coordination by default. Development, testing, review, integration, and acceptance are delegated to child agents unless a documented trivial exemption or runtime fallback applies.

## When to Use

Use when the user asks for or implies:

- "目标 + 管理者 + 多 agent"
- "当前会话作为管理者会话"
- "按照功能模块，每个模块启用一个子 agent"
- "管理者不参与开发/测试/review/验收"
- "用这个 skill 承载一个巨大目标"
- A broad task with separable modules, routes, files, owners, rounds, or task packs
- A large program or long-running build that must be decomposed into phases and child-agent tasks
- Parallel investigation where independent findings must be coordinated into one answer
- A delivery goal where execution, verification, review, and acceptance should be handled by separate agents

Do not use when:

- The task is small enough for one direct pass
- Workstreams touch the same files or shared state so strongly that parallel edits would conflict
- The user only wants a quick answer, not execution
- The environment has no usable agent/delegation tool and the user has not approved fallback handling

## Manager Contract

1. Restate the concrete goal in one sentence.
2. Define success criteria before work starts.
3. List scope boundaries, including explicit non-goals.
4. Split by stable boundaries: module, route, feature, data source, test layer, or document section.
5. Write a Task Card for every executable task before dispatch.
6. Track ownership, dependencies, blockers, and evidence returned by each agent.
7. Summarize only after the assigned acceptance agent has reported the acceptance result, or after clearly labeling a fallback path with no delegated acceptance.

If requirements are ambiguous, surface the ambiguity before dispatch. Do not let workers guess product or scope decisions independently.

## Delegation Policy

Default rule: the manager does not implement, test, review, integrate, or accept.

Allowed exceptions:

- **Trivial exemption**: The manager may directly handle a single-file, under-10-line, no-logic correction such as typo, formatting, broken link, or obvious metadata. The final report must label it as `trivial manager edit` and include the check performed.
- **Runtime fallback**: If no delegation tool is available, ask the user whether to switch to a single-agent workflow or produce a complete task plan only. If continuing without delegation, label every status as `not delegated` and `no delegated evidence`. Never imply that a child agent ran.
- **Emergency stop**: If a worker reports unsafe overlap, missing inputs, or scope coupling, stop dispatch for that slice and re-plan before more edits happen.

No fake delegation: do not invent child-agent reports, evidence, acceptance, or review.

## Runtime Adapter

Use the local runtime's available delegation mechanism without hard-coding this skill to one product:

| Runtime | Dispatch pattern | Tracking pattern |
| --- | --- | --- |
| Claude Code | Use the Task tool to start child agents with Task Cards. | Track task IDs, statuses, and reports in the manager todo list. |
| Codex / CLI / other agents | Use independent sessions, processes, worktrees, or the user's watchdog/script loop when available. | Track task IDs, session names, files, commands, and returned reports in the manager plan. |
| No delegation tool | Use the runtime fallback above. | Mark work as not delegated; do not claim multi-agent evidence. |

The Task Card and Worker Report formats below are the adapter boundary. Runtime-specific mechanics may vary; the contract does not.

## Task Split Rules

Good worker tasks are independent and have a clear output:

- "Fix sales dashboard filter counts; report changed files, tests, and remaining risk."
- "Inspect media import task creation flow; do not edit ads integration code; return root cause and patch."
- "Review release docs for missing gates; provide file:line evidence and proposed text."
- "Run acceptance for the completed slices; report pass/fail, evidence, and unresolved risk."

Bad worker tasks are vague or overlapping:

- "Improve the app."
- "Check everything."
- "One agent edits frontend while another edits the same component."

Prefer 2-5 workers for execution plus separate agents for testing/review/acceptance when needed. More workers only help when boundaries are clean and the manager can still coordinate dependencies.

## Parallel Edit Safety

Before dispatching implementation tasks:

- Each implementation Task Card must declare `Allowed paths`.
- Two parallel workers must not write the same file or tightly coupled shared state.
- Shared types, config, routing, migrations, API contracts, and generated files need one declared owner.
- If slices need the same files, run them serially, use separate worktrees, or assign an integration agent to reconcile after isolated edits.
- If overlap is discovered after dispatch, pause the affected workers, merge findings, and reassign narrower tasks.

High-conflict work is still compatible with this skill, but it becomes phased or serial instead of parallel.

## Large Goal Mode

A single goal may be huge, but no child-agent task may be huge. Treat the goal as a program of work:

```text
One huge goal
-> phases
-> task graph
-> small child-agent tasks
-> testing/review/integration/acceptance agents
-> manager summary
```

Before dispatching implementation for a huge goal, assign child agents to produce the durable planning artifacts:

- **Goal brief**: user outcome, constraints, non-goals, and acceptance criteria.
- **Architecture/design**: module boundaries, data contracts, routes, permissions, external dependencies, and integration points.
- **Execution plan**: phases, task IDs, dependencies, owners, expected artifacts, and stop/go gates.
- **Acceptance checklist**: scenario-level checks that an acceptance agent can run without relying on manager judgment.

Use phases when the task graph is too large to fit in one reliable dispatch. A phase should have a visible deliverable and an acceptance task. The manager may start the next phase only after the assigned acceptance agent reports the current phase result.

Do not dispatch a child agent with "build the whole app" or "finish the entire system." Split until each task has a bounded file/module area, expected output, and evidence requirement.

## Phase Gate Policy

Every phase ends with an acceptance gate:

- **Pass**: All success criteria have evidence. Continue to the next phase.
- **Partial**: Some criteria pass, but gaps remain. Create fix or verification tasks before continuing, unless the user explicitly accepts the remaining risk.
- **Fail**: Required criteria are not met. Re-plan or roll back the failed slice before continuing.
- **Blocked**: A dependency, credential, environment, or product decision is missing. Ask for the missing input or dispatch an investigation task.

The manager may coordinate the response to a gate result, but must not replace the acceptance agent's judgment with their own.

## Required Agent Roles

For delivery work, delegate these roles instead of doing them in the manager session:

- **Implementation agent**: changes code, docs, data artifacts, or configuration.
- **Testing agent**: runs focused checks and reports command/runtime evidence.
- **Review agent**: reviews implementation quality, regressions, and scope adherence.
- **Acceptance agent**: decides whether the user goal is met and reports pass/fail with evidence.
- **Integration agent**: merges or reconciles slices when multiple implementation agents touch related areas.

One child agent can hold multiple roles only when the task is small and independence is not compromised. The manager must not take any of these roles except under the Delegation Policy's trivial exemption or runtime fallback.

## Task Card Template

Create a Task Card before each dispatch.

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

`Inputs` must assume the child agent starts cold and cannot see the manager's conversation. Include repo path, relevant files, constraints, previous conclusions, and exact success criteria inside the prompt.

## Worker Prompt Template

```text
Goal: <overall user goal>
Task ID: <task ID>
Role: <assigned role>
Your slice: <bounded module/workstream>
Scope: <allowed files/features/data>
Allowed paths: <files/directories you may edit or inspect>
Non-goals: <what to avoid>
Inputs and cold-start context:
- <repo path, branch, conventions, prior findings, commands, data, screenshots, URLs>
Depends-on: <task IDs or "none">
Expected output:
- Findings or changes
- Worker Report using the required template
- Evidence: commands, tests, logs, file:line references, screenshots, data rows, or commit IDs
- Risks or unresolved blockers
Rules:
- Do not modify unrelated areas.
- Do not self-accept unless you were explicitly assigned the acceptance role.
- Stop and report if scope is coupled with another slice.
```

## Worker Report Template

Every worker must return:

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

Acceptance agents must answer four questions:

```text
Task ID: <acceptance task ID>
Acceptance target: <phase, release, feature, or full goal>
1. Were all success criteria checked? <yes/no, list unchecked criteria>
2. What evidence proves each checked criterion? <criterion -> evidence>
3. What failed, was skipped, or remains unverified? <explicit gaps>
4. Final judgment: <pass / partial / fail / blocked>
```

Acceptance must be based on returned evidence and any direct checks assigned to the acceptance agent. "Looks good" is not an acceptance result.

## Manager Loop

1. **Plan**: Create a short task list with one `in_progress` manager step.
2. **Card**: Write Task Cards with cold-start inputs, allowed paths, dependencies, evidence, and stop conditions.
3. **Dispatch**: Start independent workers only after scope, success criteria, roles, dependencies, and edit safety are clear.
4. **Monitor**: Track each worker as pending, running, done, blocked, or needs review.
5. **Coordinate handoffs**: Route implementation outputs to testing, review, integration, and acceptance agents.
6. **Completeness check**: Confirm each required role returned its report. Do not perform technical review or acceptance yourself.
7. **Report**: Give the user the delegated final state, proof provided by agents, changed boundaries, and residual risk.

Never develop, test, review, or accept inside the manager session unless using the documented trivial exemption or runtime fallback. If an acceptance report is missing, dispatch an acceptance agent instead of deciding yourself.

## Delegated Evidence Standard

Assign child agents to gather evidence based on risk:

- Code: focused tests, typecheck/build, lint, targeted runtime request, or reproduced bug path
- UI: screenshot/browser state, interaction result, visible text/state, console/network errors when relevant
- Data/export: inspect the generated file/table rows directly
- Docs/plans: file:line review, link/anchor validation, consistency against task gates
- Git/release: branch, remote, commit hash, clean/dirty status, push result

If a check cannot run, the responsible child agent must say exactly why and what evidence remains. The manager reports that status without converting it into acceptance.

## Common Failure Modes

- **Manager starts doing the work**: stop, create the missing child-agent task, and delegate it.
- **Workers overlap**: pause, merge scope, and reassign narrower tasks or introduce an integration agent.
- **No explicit non-goals**: add them before dispatch, especially for nearby but excluded modules.
- **Cold-start context missing**: revise the Task Card inputs before dispatch; do not assume child agents saw the manager chat.
- **Report is prose only**: request the Worker Report template with evidence.
- **Too many agents**: reduce to the few independent slices that affect the goal.
- **No acceptance agent**: create one; the manager must not decide pass/fail.
- **No delegation runtime**: use fallback labeling; never invent worker reports.

## Output Shape

For substantial work, report:

```text
Goal: <done / partial / failed / blocked>
Success criteria:
- <criterion> -> <pass/fail/partial/unchecked> (<evidence>)
Slices:
- <task ID>: <status, owner, role, changed boundary>
Changed: <files, artifacts, commits, or docs>
Evidence:
- <testing/review/acceptance reports from child agents>
Residual risk: <only real remaining risk, or "none known">
User action needed: <decisions, credentials, approvals, or "none">
Delegation note: <delegated / trivial manager edit / fallback not delegated>
```

## Walkthrough Examples

### Small Bug

Goal: fix one dashboard count bug without touching unrelated screens.

```text
Task P1-IMPL-01
Role: implementation
Objective: Fix sales dashboard filter counts.
Allowed paths: src/features/sales/dashboard/**, tests/sales/dashboard/**
Inputs: cold-start repo path, failing scenario, expected count rule, test command.
Expected evidence: changed files, focused test result, risk.

Task P1-TEST-01
Role: testing
Depends-on: P1-IMPL-01
Objective: Re-run focused analytics checks and one regression path.

Task P1-ACC-01
Role: acceptance
Depends-on: P1-TEST-01
Objective: Answer the four acceptance gate questions for the bug goal.
```

Manager final report cites the implementation report, test command result, and acceptance judgment. If the acceptance task is missing, the manager does not declare done.

### Large App Phase

Goal: deliver an authenticated internal dashboard.

```text
Phase 0: Planning
- P0-BRIEF-01 goal brief
- P0-ARCH-01 architecture/design
- P0-PLAN-01 execution plan
- P0-ACC-01 acceptance checklist

Phase 1: Foundation
- P1-AUTH-01 auth routes and session handling
- P1-DATA-01 dashboard data contract and mock source
- P1-UI-01 shell, navigation, and empty states
- P1-INT-01 integration across auth/data/UI
- P1-TEST-01 smoke and route checks
- P1-ACC-01 phase acceptance gate
```

Parallel edits are allowed only when Task Cards have non-overlapping paths. Shared routing or config gets one owner or moves to the integration task.
