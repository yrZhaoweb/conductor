# Conductor

Conductor is an agent skill that turns the current session into a **manager**: it decomposes a large goal, delegates bounded tasks to child agents, persists state to disk, and reports outcomes — while never doing the implementation, testing, review, or acceptance itself.

It is built to fight three failure modes of AI-written code on big or long-running work:

- **Self-endorsement** — the author grading its own work. Conductor separates the writer from the judge.
- **Context decay** — quality dropping as context gets compressed. Conductor keeps tasks small and pushes state to disk.
- **Error amplification** — a guess filling a source gap and compounding each round. Conductor does only the certain and stops at the uncertain.

## How it works

- **Two modes.** `strict` stops at any real uncertainty and asks you. `auto` proceeds on reversible, low-risk points (logging each to `RUN_ROOT/decisions.md`) but still stops at irreversible red lines — schema, API contracts, auth, deletions, PRD-uncovered core decisions. The skill forces you to confirm the mode before any work starts.
- **Serial batches, parallel within a batch.** Each batch ends at a **fence** that does two jobs: it collects and resolves the batch's open questions, and it runs an independent acceptance agent against the original intent. Errors cannot cross a fence, so a source error stays contained to one batch instead of compounding.
- **The first batch is always planning.** It decomposes the goal, plans the batches and their dependency graph, sets per-batch acceptance criteria, and writes `goal.md` — then passes its own fence before any building begins.
- **State lives on disk per run.** The manager creates a unique `RUN_ROOT` under `.conductor/runs/<date>-<slug>/`; full Task Cards and Worker Reports live there so different goals do not overwrite each other. A closed batch is cleared from context, so the session carries the weight of only one batch at any moment.
- **Acceptance is independent.** The acceptance agent judges against `RUN_ROOT/goal.md` and checks it reran itself — not the implementer's "all tests passed."
- **External acceptance is formal.** If the user names Claude App, Chrome/Computer, another model, or a human reviewer as an acceptance participant, that participant becomes part of the fence and must return an explicit judgment before completion.
- **Runtime acceptance checks reality.** For local apps, live providers, auth, payments/points, or runtime config, the fence verifies effective running state rather than only code or `.env`.

## Use When

- A goal is too large for one reliable pass and must be split into batches and small child-agent tasks.
- The manager session should not directly implement, test, review, or accept the work.
- You want task cards, worker reports, acceptance gates, a decision log, and evidence-backed progress that survives context compaction.

## Install

Copy this repository into your runtime's skills directory. Conductor is
runtime-agnostic (see the Runtime Adapter table in `SKILL.md`); pick the path your
agent loads skills from:

```bash
# Claude Code
SKILLS_DIR=~/.claude/skills
# Codex
# SKILLS_DIR=~/.codex/skills
# or your runtime's equivalent: SKILLS_DIR=<your-skills-dir>

mkdir -p "$SKILLS_DIR/conductor"
cp -R README.md SKILL.md agents references evals examples "$SKILLS_DIR/conductor/"
```

Then invoke it as `$conductor` (or your runtime's skill-reference form).

## Contents

- `SKILL.md`: the orchestration contract — modes, batch execution, persistence, the uncertainty rule, acceptance, and the manager loop.
- `references/templates.md`: Task Card, Worker Prompt, Worker Report, Acceptance Gate, and External Acceptance Prompt templates.
- `evals/README.md`: prompt evals for mode confirmation, auto red-line stops, fallback honesty, edit conflicts, cold-start context, acceptance reruns, external acceptance, and run-root isolation.
- `examples/sample-run/`: a real, lightly redacted `RUN_ROOT` from an actual run — first-hand evidence of the contract in action (independent acceptance returning Needs-decision, an error caught and fixed inside one batch, external Claude acceptance).
- `agents/openai.yaml`: optional manifest read by runtimes that support agent metadata (display name, short description, default invocation prompt). Runtimes that do not support it ignore the file; nothing in the contract depends on it.

## Run-root layout

Each conductor invocation creates a unique run root:

```text
.conductor/runs/<YYYYMMDD-HHMM>-<short-goal-slug>/
├── goal.md          # original-intent anchor + effective red lines
├── plan.md          # batch blueprint: tasks per batch, dependency graph, acceptance criteria
├── tasks/           # one Task Card per task
├── reports/         # Worker, Acceptance, or External Acceptance reports
├── decisions.md     # auto-mode decision log
└── batches/         # per-batch outputs and acceptance results
```

Do not write new run files directly to top-level `.conductor/goal.md`, `.conductor/tasks/`, or `.conductor/reports/`; those paths are treated as legacy data and left untouched.
