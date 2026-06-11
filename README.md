# Conductor

Conductor is an agent skill that turns the current session into a **manager**: it decomposes a large goal, delegates bounded tasks to child agents, persists state to disk, and reports outcomes — while never doing the implementation, testing, review, or acceptance itself.

It is built to fight three failure modes of AI-written code on big or long-running work:

- **Self-endorsement** — the author grading its own work. Conductor separates the writer from the judge.
- **Context decay** — quality dropping as context gets compressed. Conductor keeps tasks small and pushes state to disk.
- **Error amplification** — a guess filling a source gap and compounding each round. Conductor does only the certain and stops at the uncertain.

## How it works

- **Two modes.** `strict` stops at any real uncertainty and asks you. `auto` proceeds on reversible, low-risk points (logging each to `decisions.md`) but still stops at irreversible red lines — schema, API contracts, auth, deletions, PRD-uncovered core decisions. The skill forces you to confirm the mode before any work starts.
- **Serial batches, parallel within a batch.** Each batch ends at a **fence** that does two jobs: it collects and resolves the batch's open questions, and it runs an independent acceptance agent against the original intent. Errors cannot cross a fence, so a source error stays contained to one batch instead of compounding.
- **The first batch is always planning.** It decomposes the goal, plans the batches and their dependency graph, sets per-batch acceptance criteria, and writes `goal.md` — then passes its own fence before any building begins.
- **State lives on disk.** The manager session keeps one line per task; full Task Cards and Worker Reports live in `.conductor/`. A closed batch is cleared from context, so the session carries the weight of only one batch at any moment.
- **Acceptance is independent.** The acceptance agent judges against `goal.md` and checks it reran itself — not the implementer's "all tests passed."

## Use When

- A goal is too large for one reliable pass and must be split into batches and small child-agent tasks.
- The manager session should not directly implement, test, review, or accept the work.
- You want task cards, worker reports, acceptance gates, a decision log, and evidence-backed progress that survives context compaction.

## Install

Copy this repository into your skills directory:

```bash
mkdir -p ~/.codex/skills/conductor
cp -R SKILL.md agents references evals ~/.codex/skills/conductor/
```

Then invoke it as `$conductor` when your runtime supports skill references.

## Contents

- `SKILL.md`: the orchestration contract — modes, batch execution, persistence, the uncertainty rule, acceptance, and the manager loop.
- `references/templates.md`: Task Card, Worker Prompt, Worker Report, and Acceptance Gate templates.
- `evals/README.md`: prompt evals for mode confirmation, auto red-line stops, fallback honesty, edit conflicts, cold-start context, and acceptance reruns.
- `agents/openai.yaml`: optional agent metadata for runtimes that support it.

## `.conductor/` layout

```text
.conductor/
├── goal.md          # original-intent anchor + effective red lines
├── plan.md          # batch blueprint: tasks per batch, dependency graph, acceptance criteria
├── tasks/           # one Task Card per task
├── reports/         # one Worker Report or Acceptance result per task
├── decisions.md     # auto-mode decision log
└── batches/         # per-batch outputs and acceptance results
```
