---
name: conductor
description: Use when a user asks for a manager/管理者会话 to coordinate 子agent or multi-agent work for a large goal, task pack, parallel modules, phases, or phrases like 多 agent, 每个模块启用一个子 agent, 管理者不参与开发/测试/review/验收, 巨大目标, or delegated acceptance.
---

# Conductor

## Overview

Use this skill to keep the current session as the manager: define the goal, split executable work, delegate bounded tasks, persist state, track evidence, and summarize outcomes.

The manager coordinates by default. Implementation, testing, review, integration, and acceptance are delegated unless a documented trivial exemption or runtime fallback applies.

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

- The task is small enough for one direct pass and does not need delegated evidence
- Workstreams touch the same files or shared state so strongly that delegation would add coordination risk
- The user only wants a quick answer, not execution
- The environment has no usable delegation tool and the user has not approved fallback handling

## Manager Contract

1. Restate the concrete goal in one sentence.
2. Define success criteria before work starts.
3. List scope boundaries, including explicit non-goals.
4. Choose the workload level: trivial, lightweight, standard, or large goal.
5. Create or update the persistent state files before dispatch.
6. Write a Task Card for every executable task, including cold-start inputs and allowed paths.
7. Track ownership, dependencies, blockers, reports, and acceptance evidence in `.conductor/`.
8. Summarize only after acceptance reports a result, or after clearly labeling fallback work with no delegated acceptance.

If requirements are ambiguous, surface the ambiguity before dispatch. Do not let workers guess product or scope decisions independently.

## Workload Levels

- **Direct pass**: Do not use this skill when a task is small enough for one normal response and does not need delegated evidence.
- **Trivial exemption**: The manager may directly handle a single-file, under-10-line, no-logic correction such as typo, formatting, broken link, or obvious metadata. Label the final report `trivial manager edit` and include the check performed.
- **Lightweight mode**: Use for one slice, low risk, no parallel edits, no shared-file conflict, and clear verification. Dispatch implementation plus acceptance. The acceptance agent must independently rerun at least one key check; a separate testing or review agent is optional.
- **Standard mode**: Use implementation plus the needed testing, review, integration, and acceptance roles. Prefer 2-5 workers when boundaries are clean.
- **Large goal mode**: Use phases, durable planning artifacts, phase gates, and separate acceptance for each phase.

## Delegation Policy

Default rule: the manager does not implement, test, review, integrate, or accept.

Allowed exceptions:

- **Trivial exemption**: allowed only under the workload rule above.
- **Runtime fallback**: If no delegation tool is available, ask whether to switch to a single-agent workflow or produce a task plan only. If continuing without delegation, label every status as `not delegated` and `no delegated evidence`.
- **Emergency stop**: If a worker reports unsafe overlap, missing inputs, or scope coupling, stop dispatch for that slice and re-plan.

No fake delegation: do not invent child-agent reports, evidence, acceptance, or review.

## Persistent State

For any non-trivial run, create a `.conductor/` directory in the active repo or working folder. If the target repo should not be modified, create it in the manager's workspace and record that location in the final report.

Required files:

```text
.conductor/state.md                 # goal, success criteria, mode, phases, current status
.conductor/tasks/<task-id>.md        # one Task Card per delegated task
.conductor/reports/<task-id>.md      # one Worker Report or Acceptance Gate result per completed task
```

State rules:

- Update `state.md` before dispatch, after every status change, when a report arrives, and before final summary.
- A manager resuming after compaction or restart must read `state.md`, then the active task cards and latest reports before continuing.
- Do not rely only on chat history, todo lists, or memory for long-running work.
- If files cannot be written, report `persistent state unavailable` and use the runtime fallback labels.

## Runtime Adapter

Use the local runtime's available delegation mechanism without hard-coding this skill to one product:

| Runtime | Dispatch pattern | Tracking pattern |
| --- | --- | --- |
| Claude Code | Use the Task tool to start child agents with Task Cards. | Track status in todo list and `.conductor/`. |
| Codex / CLI / other agents | Use independent sessions, processes, worktrees, or the user's watchdog/script loop when available. | Track session names, task IDs, files, commands, and reports in `.conductor/`. |
| No delegation tool | Use the runtime fallback above. | Mark work as not delegated; do not claim multi-agent evidence. |

The Task Card and Worker Report formats are the adapter boundary. Runtime-specific mechanics may vary; the contract does not.

## Task Splitting

Good worker tasks are independent and have a clear output:

- "Fix sales dashboard filter counts; report changed files, tests, and remaining risk."
- "Inspect media import task creation flow; do not edit ads integration code; return root cause and patch."
- "Review release docs for missing gates; provide file:line evidence and proposed text."
- "Run acceptance for the completed slice; rerun the key check and report pass/fail."

Bad worker tasks are vague or overlapping:

- "Improve the app."
- "Check everything."
- "One agent edits frontend while another edits the same component."

Use the templates in `references/templates.md` for Task Cards, worker prompts, Worker Reports, and Acceptance Gates. A worker prompt is just the Task Card plus the rules from that reference.

## Parallel Edit Safety

Before dispatching implementation tasks:

- Each implementation Task Card must declare `Allowed paths`.
- Two parallel workers must not write the same file or tightly coupled shared state.
- Shared types, config, routing, migrations, API contracts, and generated files need one declared owner.
- If slices need the same files, run them serially, use separate worktrees, or assign an integration agent to reconcile after isolated edits.
- If overlap is discovered after dispatch, pause affected workers, update `.conductor/state.md`, and reassign narrower tasks.

High-conflict work is still compatible with this skill, but it becomes phased or serial instead of parallel.

## Large Goal Mode

A single goal may be huge, but no child-agent task may be huge. Treat the goal as a program of work:

```text
One huge goal
-> phases
-> task graph
-> small child-agent tasks
-> testing/review/integration/acceptance agents
-> persisted reports
-> manager summary
```

Before dispatching implementation for a huge goal, assign child agents to produce durable planning artifacts:

- **Goal brief**: user outcome, constraints, non-goals, and acceptance criteria.
- **Architecture/design**: module boundaries, data contracts, routes, permissions, external dependencies, and integration points.
- **Execution plan**: phases, task IDs, dependencies, owners, expected artifacts, and stop/go gates.
- **Acceptance checklist**: scenario-level checks that an acceptance agent can run without relying on manager judgment.

Do not dispatch a child agent with "build the whole app" or "finish the entire system." Split until each task has a bounded file/module area, expected output, and evidence requirement.

## Phase Gate Policy

Every phase ends with an acceptance gate:

- **Pass**: All success criteria have evidence and the acceptance agent reran at least one key check. Continue to the next phase.
- **Partial**: Some criteria pass, but gaps remain. Create fix or verification tasks before continuing, unless the user explicitly accepts the remaining risk.
- **Fail**: Required criteria are not met. Re-plan or roll back the failed slice before continuing.
- **Blocked**: A dependency, credential, environment, or product decision is missing. Ask for the missing input or dispatch an investigation task.

The manager may coordinate the response to a gate result, but must not replace the acceptance agent's judgment with their own.

## Required Agent Roles

- **Implementation agent**: changes code, docs, data artifacts, or configuration.
- **Testing agent**: runs focused checks and reports command/runtime evidence.
- **Review agent**: reviews implementation quality, regressions, and scope adherence.
- **Acceptance agent**: decides whether the user goal is met, reruns at least one key check, and reports pass/partial/fail/blocked with evidence.
- **Integration agent**: merges or reconciles slices when multiple implementation agents touch related areas.

One child agent can hold multiple roles only when the workload level allows it and independence is not compromised.

## Manager Loop

1. **Plan**: Choose workload level, define success criteria, and create `.conductor/state.md`.
2. **Card**: Write each Task Card to `.conductor/tasks/<task-id>.md`.
3. **Dispatch**: Start independent workers only after scope, roles, dependencies, cold-start inputs, and edit safety are clear.
4. **Persist**: Update `.conductor/state.md` whenever a task starts, blocks, completes, or changes owner.
5. **Coordinate**: Route implementation outputs to testing, review, integration, and acceptance agents as required by the workload level.
6. **Accept**: Require the Acceptance Gate format, including the independent rerun check. Store it in `.conductor/reports/`.
7. **Report**: Give the user the delegated final state, proof provided by agents, changed boundaries, residual risk, and state-file location.

If acceptance is missing, dispatch an acceptance task instead of deciding yourself.

## Delegated Evidence Standard

Assign child agents to gather evidence based on risk:

- Code: focused tests, typecheck/build, lint, targeted runtime request, or reproduced bug path
- UI: screenshot/browser state, interaction result, visible text/state, console/network errors when relevant
- Data/export: inspect the generated file/table rows directly
- Docs/plans: file:line review, link/anchor validation, consistency against task gates
- Git/release: branch, remote, commit hash, clean/dirty status, push result

If a check cannot run, the responsible child agent must say exactly why and what evidence remains. The manager reports that status without converting it into acceptance.

## Common Failure Modes

- **Manager starts doing the work**: stop, create the missing Task Card, and delegate or label a valid exemption.
- **State only lives in chat**: create or repair `.conductor/` before continuing.
- **Workers overlap**: pause, merge scope, and reassign narrower tasks or introduce an integration agent.
- **Cold-start context missing**: revise the Task Card inputs before dispatch.
- **Report is prose only**: request the Worker Report template with evidence.
- **Acceptance only reads reports**: require the independent rerun check before pass.
- **No delegation runtime**: use fallback labeling; never invent worker reports.

## Output Shape

For substantial work, report:

```text
Goal: <done / partial / failed / blocked>
Mode: <trivial / lightweight / standard / large goal / fallback>
State files: <.conductor location, or persistent state unavailable>
Success criteria:
- <criterion> -> <pass/fail/partial/unchecked> (<evidence>)
Slices:
- <task ID>: <status, owner, role, changed boundary>
Changed: <files, artifacts, commits, or docs>
Evidence:
- <testing/review/acceptance reports from child agents>
Acceptance rerun:
- <command/check> -> <result>
Residual risk: <only real remaining risk, or "none known">
User action needed: <decisions, credentials, approvals, or "none">
Delegation note: <delegated / trivial manager edit / fallback not delegated>
```

## Walkthrough Examples

### Lightweight Bug

Goal: fix one dashboard count bug without touching unrelated screens.

```text
Mode: lightweight
State: .conductor/state.md

Task P1-IMPL-01
Role: implementation
Objective: Fix sales dashboard filter counts.
Allowed paths: src/features/sales/dashboard/**, tests/sales/dashboard/**
Expected evidence: changed files, focused test result, risk.

Task P1-ACC-01
Role: acceptance
Depends-on: P1-IMPL-01
Objective: Verify the bug goal, rerun the focused test or request path, and answer the Acceptance Gate questions.
```

Manager final report cites the implementation report, acceptance rerun result, and residual risk. If the acceptance task is missing, the manager does not declare done.

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
- P1-ACC-01 phase acceptance gate with independent rerun
```

Parallel edits are allowed only when Task Cards have non-overlapping paths. Shared routing or config gets one owner or moves to the integration task.
