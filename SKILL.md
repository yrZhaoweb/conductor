---
name: conductor
description: Use when the user wants the current session to act as a manager / 管理者会话 that coordinates 子agent / multi-agent work toward a large or long-running goal without letting this session's context decay. Triggers include 多 agent, 每个模块一个子 agent, 管理者不参与开发/测试/review/验收, 巨大目标, 串行批次 / batch execution, auto / strict 模式, 落盘 / persistent state, 不确定即停 / needs-decision, delegated acceptance, parallel modules, phases, or task packs.
---

# Conductor

## Overview

Conductor keeps the current session as the **manager**: it defines the goal, splits the work, delegates bounded tasks to child agents, persists state to disk, and reports outcomes. It does not do the work itself.

It exists to fight three ways AI-written code systematically distorts on a large or long-running goal:

1. **Self-endorsement** — the author grading its own work inflates the pass rate. → *Separate the writer from the judge.*
2. **Context decay** — as a project or task grows, context gets compressed, detail slips, and quality drops. → *Keep tasks small and push state to disk.*
3. **Error amplification** — a source gap (e.g. a PRD omission) is inevitable, but an AI that fills the gap by guessing and proceeds amplifies that error every round. The gap can't be prevented; the amplification can. → *Do only the certain; stop at the uncertain.*

Every mechanism below maps to one of these. If a mechanism serves none of them, it does not belong here.

Skeleton:

```text
one sentence starts goal mode
  -> confirm mode (auto / strict)             # do not guess this
  -> create a unique RUN_ROOT under .conductor/runs/
  -> Batch 0 = planning: decompose, plan batches, set per-batch acceptance, write goal.md
       -> planning passes a fence (user confirm in strict / independent intent-check in auto)
  -> execute batches serially, parallel within each:
       workers do only the certain; an uncertain point -> Needs-decision (handled per mode)
       fence: bulk-resolve doubts + independent acceptance vs original intent (rerun checks)
              + any user-specified external/joint acceptance
       pass -> persist, clear batch detail from context, advance
  -> goal done -> manager reports final delivery state
```

## When to Use

Use when the user asks for or implies:

- A goal too large or too long for one reliable pass that must be decomposed into batches and small child-agent tasks
- "当前会话作为管理者会话" / "管理者不参与开发/测试/review/验收"
- "按功能模块，每个模块一个子 agent" or parallel modules, routes, files, owners, or rounds
- A delivery where execution, testing, review, and acceptance should be handled by separate agents
- Parallel investigation whose independent findings must be coordinated into one answer

Do not use when:

- The task is small enough for one direct pass and needs no delegated evidence
- Workstreams touch the same files or shared state so strongly that delegation only adds coordination risk
- The user wants a quick answer, not execution

## Mode (auto / strict)

Mode is the skill's master switch. It decides one thing: **when a worker or the manager hits real uncertainty, does the run stop and ask you, or proceed on its own?**

### Confirm mode before any work

If the user has not stated a mode, stop and ask which to run — `auto` or `strict`. Do not default, do not guess, do not start the planning batch first. Choosing the mode is the run's first uncertainty point, and guessing it wrong is costly in both directions: a `strict` user who is silently auto-advanced loses control; an `auto` user who wanted hands-off work wakes to a blocked run with nothing done.

### strict — blocking

Any real uncertainty stops at the fence and bounces to the user. If the user does not answer, nothing moves on that point. Use when the user is present and wants to approve key decisions.

### auto — autonomous, with a raised brake threshold

The user is away (e.g. asleep) and wants the run to make progress, then review afterward. auto is **not** "guess whenever unsure" — that returns a project that confidently ran the wrong way all night, which is worse than nothing. auto splits uncertainty by reversibility:

- **Reversible / low-risk / local** (variable names, an internal implementation choice, whether to add a helper) — the worker decides, proceeds, and logs the call to `RUN_ROOT/decisions.md`. This is the room the AI is given to move.
- **Irreversible / high-risk / global — a red line** — the worker stops and asks the user **even in auto**. Guess one of these wrong and every later batch builds on it; that is source error being amplified, and it cannot be cheaply undone after the user wakes.

One line: strict asks about all uncertainty; auto asks only about the uncertainty that causes disaster if guessed wrong. auto does not turn off the brakes — it raises the threshold, braking at the cliff edge, not at every speed bump.

### Red lines (the irreversible set)

auto must stop at these even though it is the autonomous mode. The skill ships a default set; the user may add to it when starting auto. The effective set = default + user additions, recorded in `RUN_ROOT/goal.md`.

Default red lines:

- Database structure or migrations
- External / cross-service API contracts
- Permission and authentication logic
- Deletion or other irreversible operations
- Cross-module shared contracts
- Core-functionality decisions the PRD did not cover (build it or not / how)

### decisions.md (auto only)

Every decision a worker or the manager makes autonomously under auto gets one line: **what was decided / why / why it is reversible.** The user's first action on returning is to scan this log — five minutes to see every call made on their behalf and pull back anything wrong. Hands-off without going blind.

Write decisions to this run's `RUN_ROOT/decisions.md`, not to a shared top-level file.

### Behavior table

| Uncertainty | strict | auto |
| --- | --- | --- |
| Local, reversible | stop and ask | worker decides + logs to decisions.md |
| Global, irreversible (red line) | stop and ask | **also stop and ask** |
| User posture | present, on call | away; reviews decisions.md + acceptance on return |

### Where the run interrupts

Both modes batch up doubts and ask them in bulk at the batch fence, to cut interruptions — same-batch tasks are independent, so holding a doubt until the fence never wastes the others' work. (Flexibility: in strict, if one task's doubt invalidates a precondition the rest of the batch assumes, that doubt may be escalated early. The default is bulk closure at the fence.)

## Manager Contract

The current session is the manager. It plans, splits, dispatches, tracks, persists, and reports. **It does not implement, test, review, integrate, or accept** — those are delegated. The only exceptions are the trivial exemption and the runtime fallback (see Workload Levels and Runtime Adapter).

Before the first execution batch:

1. Restate the goal in one sentence and confirm the mode (Mode).
2. Define success criteria and non-goals.
3. Choose the workload level (Workload Levels).
4. Create a unique run root under `.conductor/runs/`, then create `RUN_ROOT/goal.md` and `RUN_ROOT/plan.md`.

When a worker returns `Needs-decision`, the manager **escalates it to the user — it does not decide.** A manager picking the answer is just another AI guess wearing a manager's hat, which is the exact failure the run exists to prevent. (In auto, the manager may resolve only reversible, non-red-line points, and must log them to decisions.md.)

No fake delegation: never invent worker reports, evidence, reviews, or acceptance.

## The Uncertainty Rule

A worker that fills a gap by guessing and proceeds is the moment a source error gets injected and then amplified across batches. So the rule is: **do the certain at full speed; stop at the uncertain.**

What this is **not**: it does not tell workers to doubt every premise they are handed. Universal doubt destroys the trust chain and the delegation grinds to a halt. Trust inputs that are specified. Stop only at genuine gaps.

What this **is**: when a worker hits a decision the inputs do not specify **and** that has more than one reasonable answer, it must not pick one. It stops and returns `Needs-decision`. Whether that bounces to the user or is resolved-and-logged depends on the mode and whether the point is a red line (Mode).

`Needs-decision` is a first-class stop reason, not a footnote added after finishing. It is *why the worker stopped* — an explicit question surfaced upward instead of a silent guess passed downward.

## Batch Execution

The run advances as a series of **fences (barriers)**. Inside one batch, independent tasks run in parallel. Between batches, execution is strictly serial: the next batch does not start until the current one closes at its fence. Every parallel worker in a batch must arrive — done or stopped — before the fence opens.

### Drawing batch boundaries (hard rule)

- **Dependency defines the boundary.** If A needs B's output, A and B go in different batches, B first.
- **Same batch = mutually independent + no shared write path AND no read-after-write on another worker's mutable output** (reuse Parallel Edit Safety: allowed paths must not overlap). Write-set disjointness alone is not enough: if A *reads* a config value, type, schema, or flag that B *changes* in the same batch, A may consume B's stale pre-change value — a read/write race the path-overlap check misses. When one worker's writable set intersects another's read set, serialize them across batches.
- Decision: no dependency + no write conflict + no read-after-write → same batch, parallel. Any dependency (including read-after-write) → separate, serial batches.
- Because same-batch tasks never depend on each other, one task stopping on a `Needs-decision` does not waste the others.

### The fence does two jobs

A fence is a checkpoint, not just a "wait for everyone":

1. **Doubt closure.** Every `Needs-decision` raised in the batch is collected and handled together at the fence (behavior set by mode). Finished, certain work is persisted and kept.
2. **Acceptance.** The batch opens not when "all tasks are done" but when an independent acceptance agent confirms the batch's output meets the original intent (see Acceptance).

### Error amplification is cut off structurally

Serial batches + a fence per batch means an error lives at most inside one batch and cannot cross into the next. This relies on no worker's vigilance — there is simply no channel for amplification. A source error that surfaces in a batch is stopped at that batch's fence instead of compounding downstream.

### The first batch is always the planning batch

Goal mode does not start building. Batch 0 produces the blueprint:

- Goal decomposition and non-goals
- The batch plan: which parallel tasks per batch, and the dependency graph that justifies the boundaries
- Acceptance criteria for each batch
- `RUN_ROOT/goal.md` (the original-intent anchor) and the effective red-line set

The planning batch passes its own fence: user confirmation in strict, or an independent agent checking the plan against the original intent in auto. If the batching itself is an AI guess, source error is injected at step one and no later fence can catch "the split was wrong." Make the plan a constrained, confirmed first batch.

**The planning fence in auto needs an extra guard, because it is the one fence whose basis is not independent of what it checks.** A later batch's acceptance reruns checks against `goal.md`; but the planning batch *produces* `goal.md`, and its independent intent-check reads the same source PRD that the decomposition read — so a genuine ambiguity in the PRD can mislead the planner and the checker identically. To stop that single blind spot from amplifying:

- Even in auto, Batch 0 must emit an **assumption list** in `plan.md`: every point where the decomposition resolved a gap or ambiguity in the source by judgment rather than by something the inputs specified.
- Any assumption that touches the effective red-line set is **not** auto-resolvable — it becomes a `Needs-decision` surfaced to the user once before execution begins, exactly like a red line hit mid-run.
- Remaining (reversible, non-red-line) assumptions are logged to `decisions.md` so the returning user sees what the plan took for granted.

This keeps auto hands-off for the reversible majority while refusing to silently bake an irreversible guess into the foundation every later batch builds on.

## State Persistence

The manager session must not carry full Task Cards and full Worker Reports in context — that is how context decays on a long run. They live on disk. The session keeps **one line per task**, e.g.:

```text
P1-IMPL-01 | done | reworked auth module | RUN_ROOT/reports/P1-IMPL-01.md
```

Read the file when you need the detail; drop it from working attention once read.

### Run root isolation

Every conductor invocation owns a unique `RUN_ROOT`. Do **not** put run files directly at `.conductor/goal.md`, `.conductor/plan.md`, `.conductor/tasks/`, or `.conductor/reports/`; that causes later goals to overwrite earlier ones.

Default location:

```text
.conductor/runs/<YYYYMMDD-HHMM>-<short-goal-slug>/
```

Rules:

- Pick the slug from the user goal, not from an implementation detail. Keep it short and filesystem-safe.
- If the target path already exists, append `-2`, `-3`, or a short thread/session id; never overwrite an existing run.
- Record `RUN_ROOT` in the first user-visible plan update and in the final report.
- If an older repo already has top-level `.conductor/goal.md` or `.conductor/reports/`, leave it untouched and create a new run root.
- Optional index files such as `.conductor/index.md` or `.conductor/latest` may point to active runs, but they are convenience pointers only. The source of truth is always inside `RUN_ROOT`.

### `RUN_ROOT` layout

```text
RUN_ROOT/
├── goal.md          # original-intent anchor + effective red lines (write once, treat as source of truth)
├── plan.md          # batch blueprint: tasks per batch, dependency graph, per-batch acceptance criteria
├── tasks/           # one Task Card per task
├── reports/         # one Worker, Acceptance, or External Acceptance result per task/checkpoint
├── decisions.md     # auto-mode decision log (what / why / why reversible)
└── batches/         # per-batch outputs and acceptance results, archived at each fence
```

If the target repo must not be modified, create the same run-root layout in the manager's workspace and record that location in the final report. If files cannot be written, report `persistent state unavailable` and fall back to the runtime-fallback labels.

### The batch is the context-recycling boundary

When a batch closes — persisted, accepted — clear its details from the session and keep one line: `Batch N: passed, output in RUN_ROOT/batches/N/`. The next batch enters against clean context. However large the goal, the manager session carries the weight of exactly one batch at any moment. A manager resuming after compaction reads `RUN_ROOT/goal.md`, then `RUN_ROOT/plan.md`, then the current batch's task cards and latest reports — never chat history alone.

## Workload Levels

Not every invocation needs the full planning-batch-and-fence machinery. Match the level to the work:

- **Trivial exemption** — a single-file, sub-10-line, no-logic fix (typo, formatting, broken link, obvious metadata). The manager may do it directly; label the report `trivial manager edit` and include the check performed.
- **Lightweight** — one slice, low risk, no parallel edits. Dispatch implementation + acceptance; a separate testing/review agent is optional. No planning batch required.
- **Standard** — 2–5 workers with clean boundaries, in one or two batches; implementation plus the testing/review/integration/acceptance roles the slice needs.
- **Large goal** — full Batch Execution: planning batch first, then serial execution batches behind fences.
- **Runtime-only batch** — no application code changes; the batch starts services, operates UI/tools, exercises live integrations, or adjusts local runtime state for verification. It still needs a Task Card, report, and independent acceptance. The report must separate changed files from runtime mutations and say whether local state changes enter git, seed, migration, or provisioning.

## Runtime Adapter

Use the local runtime's delegation mechanism without hard-coding this skill to one product:

| Runtime | Dispatch pattern | Tracking pattern |
| --- | --- | --- |
| Claude Code | Start child agents with Task Cards (parallel within a batch). | Track status in the todo list and `RUN_ROOT`. |
| Codex / CLI / other agents | Use independent sessions, processes, worktrees, or a watchdog/script loop. | Track session names, task IDs, files, commands, and reports in `RUN_ROOT`. |
| No delegation tool | Runtime fallback: ask whether to switch to single-agent work or produce a plan only; label every status `not delegated` / `no delegated evidence`. | Mark work as not delegated; never claim multi-agent evidence. |

The Task Card and Worker Report formats are the adapter boundary. Runtime mechanics may vary; the contract does not.

## Task Splitting & Parallel Edit Safety

Good worker tasks are independent with a clear output ("Fix the sales dashboard filter counts; report changed files, tests, and remaining risk"). Bad ones are vague or overlapping ("Improve the app"; "one agent edits the frontend while another edits the same component").

Before dispatching a batch's implementation tasks:

- Each implementation Task Card declares `Allowed paths`.
- Two parallel workers must not write the same file or tightly coupled shared state.
- Shared types, config, routing, migrations, API contracts, and generated files get one declared owner.
- **Structural red-line fallback (do not rely on worker vigilance).** A worker sees only its allowed paths, so it cannot reliably tell that a local edit trips a global contract — that judgment needs the whole-repo view the manager has at planning time. So when a Task Card's `Allowed paths` match a sensitive pattern, the manager marks the card **red-line-triggered** up front and the worker stops on changes there even in auto, regardless of whether the worker recognized the risk. Default sensitive patterns (extend per project): `**/migrations/**`, `*.sql`, `*.proto`, `**/auth/**`, `**/*acl*`, `**/permissions/**`, and shared `config` / `types` / route-manifest / generated files. This converts red-line detection from "the worker noticed" into a property of where the work is allowed to touch.
- If slices need the same files, place them in different batches, use separate worktrees, or assign an integration agent to reconcile after isolated edits.
- If overlap is discovered after dispatch, pause the affected workers, update `RUN_ROOT`, and reassign narrower tasks.

High-conflict work still fits this skill — it just becomes more serial batches instead of wider parallelism.

## Acceptance (the fence gate)

A batch opens its fence only when an **independent acceptance agent** clears it. The defining rule:

**The basis of acceptance must be independent of the thing being accepted.** Changing the agent's identity is not enough — the *information source* must change too. So the acceptance agent judges against two things, and **the implementer's report conclusions are not among them**:

1. The original intent — `RUN_ROOT/goal.md` and the batch's acceptance criteria, not a downstream-processed restatement.
2. Checks the acceptance agent **reran itself** — the key test command, the critical request path, the generated rows — observed first-hand.

Reading the worker's "all tests passed" is not acceptance. The acceptance agent answers the Acceptance Gate in `references/templates.md`, including which checks it reran and what came back.

### Fence outcomes

- **Pass** — criteria met with first-hand evidence; the batch closes and the next begins.
- **Partial** — some criteria met; create fix/verify tasks before opening, unless the user accepts the remaining risk.
- **Fail** — required criteria unmet; re-plan or roll back inside this batch. The error does not cross the fence.
- **Blocked** — a dependency, credential, environment, or product decision is missing; escalate or dispatch an investigation task.

The manager coordinates the response to an outcome but does not substitute its own judgment for the acceptance agent's.

### What first-hand evidence looks like

- Code: focused tests, typecheck/build, lint, a targeted runtime request, or the reproduced bug path
- UI: screenshot/browser state, interaction result, visible text, console/network errors
- Data/export: inspect the generated file or table rows directly
- Docs/plans: file:line review, link/anchor checks, consistency against the criteria
- Git/release: branch, commit hash, clean/dirty status, push result

If a check cannot run, the responsible agent says exactly why and what evidence remains; the manager reports that without converting it into acceptance.

## External and Joint Acceptance

If the user specifies an external acceptance participant — for example Claude App, a browser/Chrome session, Computer Use, another model conversation, a human reviewer, or a named tool — treat that participant as a formal fence member, not as casual advice.

Rules:

- Declare in `RUN_ROOT/plan.md` which batch or final fence requires external/joint acceptance.
- The external acceptance prompt must be self-contained: original goal, success criteria, completed checkpoints, evidence paths, known residual risks, and the exact questions to judge.
- Ask for an explicit `PASS`, `FAIL`, `PARTIAL`, or `BLOCKED`. If `FAIL`, ask for required rework. If `PASS`, ask for non-blocking residuals.
- Send the prompt in one complete message when the user requests that, or when the external participant may not share this session's context.
- Persist the result as a report under `RUN_ROOT/reports/`; do not mark the goal complete until all user-specified external acceptance gates pass or the user explicitly waives them.
- If the external participant cannot rerun part of the evidence, record that limitation separately from the judgment.

### Runtime acceptance

For goals involving local apps, live services, third-party providers, payments/points, auth, permissions, or cross-service configuration, code review is not enough. Acceptance must inspect the actual runtime state.

Runtime evidence may include:

- Service health and the exact local URLs used.
- UI operation through browser/computer tools, with visible state, screenshots, console/network observations, or DOM evidence.
- Persisted rows, logs, events, or API responses produced by the live path.
- Effective configuration as read by the running app, not only `.env`, config files, or defaults.

If a config value can be overridden by database rows, admin settings, environment precedence, feature flags, or remote config, acceptance must verify the final effective value.

### Residual risk classification

At final fences, classify every known leftover issue:

- **Blocker** — violates the original goal or a red line; create repair work and do not complete.
- **Non-blocking residual** — real issue, but the original goal is achieved; record it in the final report.
- **Follow-up checklist** — recommended before demo/release/production, but not part of the current acceptance gate.

Do not hide residuals inside a generic "risks" paragraph. Ask acceptance agents and external reviewers to classify them explicitly.

## Agent Roles

- **Implementation** — changes code, docs, data, or config.
- **Testing** — runs focused checks and reports command/runtime evidence.
- **Review** — checks quality, regressions, and scope adherence.
- **Acceptance** — judges the goal against original intent, rerunning at least one key check (Acceptance).
- **Integration** — reconciles slices when several implementers touch related areas.

One agent may hold several roles only when the workload level allows it and independence is not lost — never implementation plus its own acceptance.

## Manager Loop

1. **Mode** — confirm `auto` / `strict` (ask if unspecified). In auto, record the effective red-line set.
2. **Run root** — create a unique `RUN_ROOT` under `.conductor/runs/` (or the manager workspace if the repo cannot be modified). Announce it once.
3. **Plan batch** — dispatch the planning batch; write `RUN_ROOT/goal.md` and `RUN_ROOT/plan.md`. Pass its fence (user confirm in strict; independent intent-check in auto).
4. For each execution batch, in order:
   - **Card** — write each Task Card to `RUN_ROOT/tasks/`; verify non-overlapping allowed paths.
   - **Dispatch** — start the batch's independent workers in parallel.
   - **Collect** — workers return done or `Needs-decision`; persist reports; keep one line each in session.
   - **Fence** — handle the batch's doubts in bulk (escalate red lines and strict-mode calls to the user; log reversible auto calls); run independent acceptance against original intent; run any declared external/joint acceptance.
   - **Close** — on pass, archive to `RUN_ROOT/batches/N/`, clear batch detail from context, keep one summary line, and advance.
5. **Closeout** — before declaring the goal complete, ensure all reports are written, the final fence is updated in `plan.md`, user-facing logs/docs are updated if requested, child agents are closed, residuals are classified, and all user-specified external acceptance gates have passed or been waived.
6. **Deliver** — report the final state, per-batch acceptance evidence, changed boundaries, residual risk, and the `RUN_ROOT` location.

If acceptance is missing for a batch, dispatch an acceptance task — do not open the fence yourself.

## Templates

Task Card, Worker Prompt, Worker Report, Acceptance Gate, and External Acceptance Prompt formats live in `references/templates.md`. A worker prompt is a Task Card plus three rules. Store filled cards in `RUN_ROOT/tasks/` and reports in `RUN_ROOT/reports/`.

## Common Failure Modes

- **Manager starts doing the work** — stop, write the missing Task Card, and delegate (or apply a valid exemption).
- **AI guesses past a gap** — convert the guess into a `Needs-decision` stop; escalate it, or, if reversible in auto, log it.
- **Manager answers a Needs-decision itself** — escalate to the user instead (reversible auto calls excepted, with a log line).
- **auto turns into "guess whenever"** — re-check the red lines; irreversible/global points stop even in auto.
- **Acceptance only reads reports** — require a first-hand rerun and judgment against `goal.md`.
- **State lives only in chat** — create/repair `RUN_ROOT`; one line per task in session, detail on disk.
- **Runs overwrite each other** — stop writing to top-level `.conductor/goal.md` or `.conductor/reports/`; create a unique run root under `.conductor/runs/`.
- **Workers overlap** — pause, split allowed paths, or add an integration owner.
- **No delegation runtime** — use fallback labeling; never invent reports.
- **External reviewer treated as chat advice** — add it to the fence, send a self-contained prompt, and persist its PASS/FAIL report.
- **Runtime goal accepted from static files** — verify the effective running state, not only code or `.env`.

## Output Shape

```text
Goal: <done / partial / failed / blocked>
Mode: <auto / strict>   Level: <trivial / lightweight / standard / large goal / fallback>
State: <RUN_ROOT location, or persistent state unavailable>
Batches:
- Batch <N>: <pass / partial / fail / blocked> — <one-line outcome> (RUN_ROOT/batches/<N>/)
Success criteria:
- <criterion> -> <pass/fail/partial/unchecked> (<first-hand evidence>)
Acceptance reruns:
- <command/check> -> <result>
External acceptance: <not required / pass / partial / fail / blocked> (<report path>)
Auto decisions: <count, see RUN_ROOT/decisions.md>   # auto only
Open Needs-decision: <questions for the user, or "none">
Changed: <files, artifacts, commits, docs>
Residual risk: <blockers / non-blocking residuals / follow-up checklist>
Delegation note: <delegated / trivial manager edit / fallback not delegated>
```

## Walkthrough Examples

For a **real, on-disk run** rather than the illustrative sketches below — including an
acceptance agent that returned `Needs-decision` after rerunning checks itself, an error
caught and fixed inside one batch, and external Claude-app acceptance — see
`examples/sample-run/` and its README.

### Lightweight bug (no planning batch)

```text
Mode: strict   Level: lightweight

Batch 1
- P1-IMPL-01 implementation: fix sales dashboard filter counts
    Allowed paths: src/features/sales/dashboard/**, tests/sales/dashboard/**
- P1-ACC-01 acceptance (depends-on P1-IMPL-01): rerun the focused test against the
    original bug report; answer the Acceptance Gate.
Fence: acceptance reruns the test first-hand -> pass. Done.
```

If the acceptance task is missing, the manager does not declare done — it dispatches one.

### Large goal (planning batch first, then fenced execution batches)

```text
Mode: auto   Red lines: defaults + "anything touching billing stops"

Batch 0 — planning (fence: independent intent-check vs the user's request)
- P0-BRIEF-01 goal brief + non-goals
- P0-ARCH-01 module boundaries, data + API contracts
- P0-PLAN-01 batch plan + dependency graph        -> plan.md
- P0-ACC-01 per-batch acceptance criteria          -> goal.md

Batch 1 — foundation (parallel; non-overlapping paths)
- P1-AUTH-01 auth routes + session
- P1-DATA-01 dashboard data contract + mock source
- P1-UI-01 shell, nav, empty states
Fence: integration check + independent acceptance vs goal.md. An open API-contract
question is a red line -> bounced to the user even in auto. On pass, archive to
RUN_ROOT/batches/1/, clear context, advance.

Batch 2 — depends on Batch 1 contracts: live data, filters, route tests, phase acceptance.
```

Parallel edits are allowed only when Task Cards have non-overlapping paths. Shared routing or config gets one owner or moves to an integration task.
