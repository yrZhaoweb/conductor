# Conductor

Conductor is an agent skill for coordinating a large goal through delegated child-agent work while the current session stays focused on planning, dispatch, tracking, and final reporting.

It is designed for workflows where implementation, testing, review, integration, and acceptance should be assigned to separate agents or separate runtime sessions.

## Use When

- A goal is too large for one reliable pass.
- Work can be split by module, route, document section, data source, or phase.
- The manager session should not directly implement, test, review, or accept the work.
- You need task cards, worker reports, acceptance gates, persistent state, and evidence-backed progress tracking.

## Install

Copy this repository into your skills directory:

```bash
mkdir -p ~/.codex/skills/conductor
cp -R SKILL.md agents references evals ~/.codex/skills/conductor/
```

Then invoke it as `$conductor` when your runtime supports skill references.

## Contents

- `SKILL.md`: the main skill contract and workflow.
- `references/templates.md`: task card, worker prompt, worker report, and acceptance gate templates.
- `evals/README.md`: lightweight prompt evals for fallback honesty, edit conflicts, cold-start context, and acceptance reruns.
- `agents/openai.yaml`: optional agent metadata for runtimes that support it.

## Structure Note

`SKILL.md` keeps the orchestration contract short. Reusable exchange formats live in `references/templates.md`, and behavior checks live in `evals/README.md`.
