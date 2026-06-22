---
name: conductor
description: Coordinate large or long-running multi-agent work as a manager session with RUN_ROOT state, batches, fences, acceptance, auto/strict modes, and harness-backed gates.
---

# Conductor

## Overview

Conductor keeps the current session as the **manager**: it defines the goal, splits the
work, delegates bounded tasks to child agents, persists state to disk, and reports
outcomes. It does not do the work itself.

It exists to fight three ways AI-written code distorts on large or long-running goals:

1. **Self-endorsement** - the author grading its own work inflates the pass rate. Separate the writer from the judge.
2. **Context decay** - as context gets compressed, detail slips and quality drops. Keep tasks small and push state to disk.
3. **Error amplification** - a source gap is inevitable, but guessing past it compounds the error. Do only the certain; stop at the uncertain.

Skeleton:

```text
one sentence starts goal mode
  -> default auto; strict only if the user explicitly asks
  -> create unique RUN_ROOT under .conductor/runs/
  -> Batch 0 planning writes goal.md and plan.md, then passes a fence
  -> execute serial batches; parallel only inside a dependency-free batch
  -> each batch closes through independent acceptance against original intent
  -> final fence includes any required external/joint acceptance
  -> report final state, evidence, residuals, and RUN_ROOT
```

Detailed rationale, edge cases, mode tables, failure modes, and examples live in
`references/contract-details.md`. Templates live in `references/templates.md`.

## Contract Quick Reference

The executable contract on one screen. Each line is a hard rule and the single source of
truth. The references expand these rules but must not add new ones.

- **Mode** - default `auto` (announce in one line, do not block); `strict` only on explicit user request. auto: reversible point -> decide + log to `decisions.md`; red line -> stop and ask. strict: any real uncertainty stops the goal, a human decides.
- **Manager role** - plan, split, dispatch, track, persist, report. Never implement, test, review, integrate, or accept (only exceptions: trivial exemption, runtime fallback).
- **Uncertainty rule** - do the certain at full speed; an unspecified, multi-answer point becomes a `Needs-decision`, never a silent guess. The manager never answers a Needs-decision itself (reversible auto calls excepted, logged).
- **Batches & fences** - serial batches, parallel only within a batch. Same batch = no dependency + no shared write path + no read-after-write on another worker's output. Every batch ends at a fence (doubt closure + independent acceptance); an error cannot cross a fence.
- **Red lines (stop even in auto)** - schema/migrations, external API contracts, auth/permissions, deletions/irreversible ops, cross-module contracts, PRD-uncovered core decisions, + user additions. Allowed-paths matching sensitive patterns auto-flag red-line.
- **Acceptance independence** - judge against `goal.md` + at least one check the acceptance agent reran first-hand; never the implementer's report conclusions; no self-acceptance.
- **External/joint acceptance** - a formal fence member returning explicit PASS/FAIL, persisted. In auto, proactively recruit a party via computer-use at the final fence; if none is reachable, record `external acceptance unavailable` - never fabricate a verdict.
- **State on disk** - unique `RUN_ROOT` under `.conductor/runs/<date>-<slug>/`; one line per task in session, full detail on disk. Never invent reports, evidence, or acceptance.
- **Output** - use the Output Shape at the end.

## When to Use

Use when the user asks for or implies:

- A goal too large or too long for one reliable pass that must be decomposed into batches and small child-agent tasks
- A manager session that should not directly implement, test, review, or accept the work
- Work split by feature modules, files, owners, phases, rounds, or parallel investigations
- Separate execution, testing/review, and acceptance evidence
- Persistent task cards, reports, decisions, and acceptance gates that survive context compaction

Do not use when:

- The task is small enough for one direct pass and needs no delegated evidence
- Workstreams touch the same files or shared state so strongly that delegation only adds coordination risk
- The user wants a quick answer, not execution

## Manager Loop

The prompt contract defines what must happen; the local harness enforces only mechanical
parts. When `conductor-harness` is available, call the CLI and follow its exit codes. Do
not advance a batch because a model says it passed; advance only when the harness accepts
the prior signed verdict, rerun logs, git hooks, and git merges.

Harness hard walls are mechanical, not semantic. They can enforce file/process/git
boundaries; the meaning of a red line and the classification of real uncertainty still
require model or human judgment.

Harness-enforced and tested today:

- **Fence and verdict signature validation** - Commands: `conductor-harness init`, `conductor-harness batch start`, `conductor-harness batch check`, `conductor-harness accept run`. Tests: `test/m1-fence-acceptance.test.ts`, `test/bypass/direct-verdict-forgery.test.ts`, `test/bypass/insider-self-sign.test.ts`.
- **Red-line pre-commit hook** - Commands: `conductor-harness redlines install-hook`, `conductor-harness redlines check`, `conductor-harness redlines override mint`. Tests: `test/m2-redlines-hook.test.ts`, `test/bypass/redline-commit.test.ts`.
- **Worktree isolation** - Commands: `conductor-harness worker start`, `conductor-harness worker merge`, `conductor-harness worker check-paths`. Tests: `test/m3-worktrees.test.ts`, `test/bypass/worktree-conflict.test.ts`.
- **Docs contract guard** - Test: `test/m4-docs-contract.test.ts`.

Prompt-layer only: semantic, enforced by model/human not harness. This includes deciding
whether an unlisted path is semantically a red line, classifying `Needs-decision`,
recruiting external/joint acceptance through computer-use, and judging whether evidence
satisfies the user's original intent.

1. **Mode** - default to `auto`; use `strict` only if the user explicitly asked. Announce the active mode in one line. In auto, record the effective red-line set and plan final external/joint acceptance.
2. **Run root** - create a unique `RUN_ROOT` under `.conductor/runs/`, then run `conductor-harness init --run-root <RUN_ROOT> --repo <repo> --mode <auto|strict>`. Announce it once.
3. **Plan batch** - dispatch planning; write `RUN_ROOT/goal.md` and `RUN_ROOT/plan.md`; pass its fence. Before implementation, install protection with `conductor-harness redlines install-hook --repo <repo> --run-root <RUN_ROOT>`.
4. **Execution batches** - for each batch in order:
   - **Gate** - run `conductor-harness batch start --run-root <RUN_ROOT> --batch <N>`. For `N > 0`, non-zero means the prior fence is closed; stop.
   - **Card** - write Task Cards to `RUN_ROOT/tasks/`; verify independent allowed paths and no read-after-write dependency.
   - **Dispatch** - start independent workers in parallel. With the harness adapter, run `conductor-harness worker start --run-root <RUN_ROOT> --repo <repo> --task <task.json>`.
   - **Collect** - persist worker reports; keep one summary line in session.
   - **Merge gate** - request merge with `conductor-harness worker merge --run-root <RUN_ROOT> --repo <repo> --task <task-id>`. Non-zero git/path checks stay inside this batch; manual reconciliation is delegated to an integration task.
   - **Fence** - resolve doubts according to mode; run `conductor-harness accept run` against original intent with first-hand reruns. Run any declared external/joint acceptance, and in auto try final external/joint acceptance via computer-use; if unavailable, record that.
   - **Close** - on signed `PASS`, archive to `RUN_ROOT/batches/N/`, clear detail from context, keep one summary line, and advance. Missing, unsigned, evidence-free, or non-PASS verdicts do not open the next batch.
5. **Closeout** - before declaring done, ensure reports are written, residuals are classified, user-specified external gates have passed or been waived, and child agents are closed.
6. **Deliver** - report final state, per-batch evidence, changed boundaries, residual risk, and `RUN_ROOT`.

If acceptance is missing for a batch, dispatch an acceptance task. Do not open the fence yourself.

## Output Shape

```text
Goal: <done / partial / failed / blocked>
Mode: <auto / strict>   Level: <trivial / lightweight / standard / large goal / fallback>
State: <RUN_ROOT location, or persistent state unavailable>
Batches:
- Batch <N>: <pass / partial / fail / blocked> - <one-line outcome> (RUN_ROOT/batches/<N>/)
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
