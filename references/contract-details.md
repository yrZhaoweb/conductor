# Conductor Contract Details

This file expands the `SKILL.md` Contract Quick Reference. The Quick Reference is the
single hard-rule source of truth; this file gives rationale, edge cases, examples, and
operational detail under the same rule headings.

## Mode

Mode decides how uncertainty is resolved.

Default is `auto`. If the user does not explicitly ask for `strict`, announce auto in one
line and begin. Do not block the run with a mode question. This is a documented posture, not
a guess.

`strict` is opt-in. In strict, any real uncertainty stops the goal and waits for the user.
The decision is completed by a human, never by the manager or a worker.

`auto` is autonomous with a raised brake threshold. Reversible, low-risk, local choices
such as names or helper shape may be decided and logged to `RUN_ROOT/decisions.md`. Red
lines still stop and ask. Auto does not mean "guess whenever unsure"; it means proceed only
where a wrong call is cheap to undo and visible in the decision log.

Behavior table:

| Uncertainty | strict | auto |
| --- | --- | --- |
| Local, reversible | stop and ask | decide + log to `decisions.md` |
| Global, irreversible / red line | stop and ask | stop and ask |
| User posture | present, on call | away; reviews decisions and acceptance later |

In both modes, batch up doubts to the fence when possible. Same-batch work is independent,
so holding a question until the fence usually does not waste other workers. Escalate early
only when the doubt invalidates a precondition shared by the rest of the batch.

Auto planning has one extra guard: Batch 0 must list assumptions in `plan.md`. Any
assumption touching the red-line set stops for the user before execution. Remaining
reversible assumptions are logged to `decisions.md`.

## Manager role

The manager plans, splits, dispatches, tracks, persists, and reports. It does not implement,
test, review, integrate, or accept. Exceptions are narrow:

- Trivial exemption: a single-file, sub-10-line, no-logic fix such as a typo or broken link.
  Label it `trivial manager edit` and include the check performed.
- Runtime fallback: if no delegation mechanism exists, ask whether to switch to single-agent
  work or produce a plan only. Mark evidence as `not delegated`; never invent delegation.

Before the first execution batch:

1. Restate the goal and mode.
2. Define success criteria and non-goals.
3. Choose workload level: trivial exemption, lightweight, standard, large goal, or
   runtime-only batch.
4. Create `RUN_ROOT`, `goal.md`, and `plan.md`.

Runtime adapter:

| Runtime | Dispatch pattern | Tracking pattern |
| --- | --- | --- |
| Claude Code | Child agents with Task Cards | Todo list and `RUN_ROOT` |
| Codex / CLI / other agents | Independent sessions, processes, worktrees, or scripts | Session names, task IDs, files, commands, reports |
| No delegation tool | Fallback to plan-only or single-agent if approved | Mark `not delegated` / `no delegated evidence` |

Agent roles:

- Implementation changes code, docs, data, or config.
- Testing runs focused checks.
- Review checks quality, regressions, and scope.
- Acceptance judges original intent from first-hand evidence.
- Integration reconciles slices.

One agent may hold several roles only when independence is not lost. Never combine
implementation with its own acceptance.

No fake delegation: do not invent worker reports, evidence, reviews, or acceptance.

## Uncertainty rule

The rule exists because a worker that fills a source gap by guessing injects an error that
later batches amplify. Workers should trust specified inputs, but must stop on a genuine
gap: an input does not specify the answer and more than one reasonable answer exists.

`Needs-decision` is a first-class stop reason, not a footnote after finishing. It states the
question, options considered, why the input is missing, and whether the point is a red line.

The manager does not answer `Needs-decision` itself. In auto, the manager may resolve only
reversible, non-red-line points and must log the decision with what was decided, why, and
why it is reversible.

## Batches & fences

Batches are serial barriers. Parallelism exists only inside a batch.

Same batch requires all three:

- no dependency,
- no shared write path,
- no read-after-write on another worker's mutable output.

Write-set disjointness is not enough. If one worker reads a config value, type, schema, or
flag that another worker changes, serialize them across batches. If parallel overlap is
discovered after dispatch, pause affected workers, update `RUN_ROOT`, and reassign narrower
tasks.

The first batch is planning. It produces the goal brief, non-goals, batch plan, dependency
graph, per-batch criteria, and effective red-line set. Planning passes its own fence:
strict uses user confirmation; auto uses an independent intent check plus the assumption
guard described under Mode.

Each fence does two jobs:

1. Doubt closure: collect and resolve all `Needs-decision` items for the batch according to
   mode.
2. Acceptance: an independent acceptance agent checks the batch against original intent.

An error cannot cross a fence. Partial or failed acceptance creates fix/verify work inside
the same batch, unless the user explicitly accepts remaining risk.

Worker tasks should have bounded objectives, cold-start context, declared allowed paths,
read paths, non-goals, dependencies, expected evidence, and a report path. If slices need
the same files, use serial batches, separate worktrees, or an integration owner.

## Red lines

Default red lines:

- Database structure or migrations
- External or cross-service API contracts
- Permission and authentication logic
- Deletion or other irreversible operations
- Cross-module shared contracts
- Core-functionality decisions the PRD did not cover

User additions join the default set and must be recorded in `RUN_ROOT/goal.md`.

Structural sensitive path patterns turn red-line detection into a planning property instead
of relying only on worker vigilance. If a Task Card's allowed paths match these, mark it
red-line-triggered up front:

```text
**/migrations/**
*.sql
*.proto
**/auth/**
**/*acl*
**/permissions/**
shared config
shared types
route-manifest files
generated files
```

The harness enforces parseable path patterns and deletion status at commit time. It cannot
decide whether an unlisted path is semantically a shared contract; that remains model or
human judgment.

## Acceptance independence

Acceptance is the fence gate. The basis must be independent of the thing being accepted:

1. Original intent: `RUN_ROOT/goal.md` and the batch acceptance criteria.
2. Checks the acceptance agent reran first-hand.

The implementer's report conclusions are not evidence. Reading "all tests passed" is not
acceptance. The acceptance context should contain only goal, criteria, prompt, and rerun
logs; reports are absent by design.

Fence outcomes:

- Pass: criteria met with first-hand evidence.
- Partial: some criteria met; create fix/verify tasks or ask the user to accept risk.
- Fail: criteria unmet; re-plan or roll back inside this batch.
- Blocked: dependency, credential, environment, or product decision missing.

First-hand evidence can be focused tests, typecheck/build, runtime request, UI screenshot
or DOM state, generated rows/files, file:line docs review, branch/commit state, or similar
direct observations. If a check cannot run, state why and what evidence remains; do not
convert the limitation into a pass.

Runtime goals need runtime evidence: service health, local URLs, UI/browser state,
console/network observations, persisted rows, logs, events, API responses, or effective
configuration as read by the running app. If database rows, admin settings, environment
precedence, flags, or remote config can override a file, acceptance checks the effective
value.

Final fences classify residuals as blockers, non-blocking residuals, or follow-up
checklist. Do not hide residuals in a generic risks paragraph.

## External/joint acceptance

External participants include Claude App, Browser/Chrome, Computer Use, another model
conversation, a human reviewer, or a named tool. Treat them as formal fence members, not
casual advice.

In auto, the manager proactively tries to recruit at least one external party for the final
fence, and for significant batch fences where feasible. If nobody is reachable, record
`external acceptance unavailable` and proceed on first-hand independent acceptance only.
Never fabricate an external verdict.

External acceptance prompts must be self-contained:

- original goal and success criteria,
- scope of the checkpoint,
- completed checkpoints,
- evidence paths,
- known residual risks,
- exact questions to judge,
- required explicit `PASS`, `FAIL`, `PARTIAL`, or `BLOCKED`.

Persist the result under `RUN_ROOT/reports/`. Do not mark the goal complete until all
user-specified external gates pass or the user explicitly waives them. If the reviewer
cannot rerun part of the evidence, record that limitation separately from the judgment.

## State on disk

Every run owns a unique `RUN_ROOT`:

```text
.conductor/runs/<YYYYMMDD-HHMM>-<short-goal-slug>/
```

Pick the slug from the user goal, keep it short and filesystem-safe, and append `-2`, `-3`,
or a short session id if needed. Never overwrite an existing run. Older top-level
`.conductor/goal.md` or `.conductor/reports/` files are legacy data; leave them untouched.

Layout:

```text
RUN_ROOT/
  goal.md
  plan.md
  tasks/
  reports/
  decisions.md
  batches/
```

If the target repo must not be modified, create the same layout in the manager workspace
and record the location. If files cannot be written, report `persistent state unavailable`
and use fallback labels.

The session keeps one line per task and reads detailed files only when needed. A closed
batch is the context-recycling boundary: persist it, accept it, archive to
`RUN_ROOT/batches/N/`, then keep only one summary line in session.

After compaction, resume by reading `RUN_ROOT/goal.md`, `RUN_ROOT/plan.md`, current task
cards, and latest reports. Do not rely on chat history alone.

## Output

Use the Output Shape in `SKILL.md`. Keep final reports evidence-backed and explicit about
unchecked items, residual risks, delegation status, and `RUN_ROOT`.

Common failure modes to check before delivering:

- Manager starts doing the work instead of delegating.
- A worker guesses past a gap instead of returning `Needs-decision`.
- The manager answers `Needs-decision` without a reversible auto log entry.
- Auto treats every uncertainty as guessable or skips external acceptance.
- Acceptance only reads reports instead of rerunning checks.
- State lives only in chat.
- Runs overwrite each other.
- Workers overlap in write paths or read-after-write dependencies.
- External reviewer is treated as chat advice instead of a formal fence member.
- Runtime goal is accepted from static files without checking effective running state.

Example patterns:

- Lightweight bug: one implementation task and one acceptance task; the fence reruns the
  focused test against the original bug report.
- Large goal: Batch 0 plans, Batch 1 builds independent foundation slices, later batches
  depend on accepted contracts. Parallel edits are allowed only with non-overlapping paths
  and no read-after-write dependency.
