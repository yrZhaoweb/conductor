# Phase 1 Research: Current State and Gap

Date: 2026-06-22
Scope: research only. No harness implementation code was written in this phase.

## Files Read

- `SKILL.md`
- `references/templates.md`
- `evals/README.md`
- `examples/sample-run/README.md`
- `examples/sample-run/goal.md`
- `examples/sample-run/plan.md`
- `examples/sample-run/decisions.md`
- `examples/sample-run/tasks/P1-IMPL-01.md`
- `examples/sample-run/tasks/P1-ACC-01.md`
- `examples/sample-run/tasks/P1-FIX-01.md`
- `examples/sample-run/tasks/P1-ACC-02.md`
- `examples/sample-run/reports/P0-ACC-01.md`
- `examples/sample-run/reports/P0-CLAUDE.md`
- `examples/sample-run/reports/P1-IMPL-01.md`
- `examples/sample-run/reports/P1-ACC-01.md`
- `examples/sample-run/reports/P1-FIX-01.md`
- `examples/sample-run/reports/P1-ACC-02.md`
- `examples/sample-run/reports/P1-CLAUDE-FINAL.md`
- `examples/sample-run/batches/0/summary.md`
- `examples/sample-run/batches/1/summary.md`
- Also checked `README.md` and `agents/openai.yaml` for repo shape and runtime metadata.

## Repository Shape

The repository is currently a prompt-only skill package. It has no `package.json`, no `src/`
directory, no CLI, no hook installer, and no machine-readable schemas for task cards,
acceptance verdicts, or run state.

`README.md` describes installation as copying `README.md`, `SKILL.md`, `agents`,
`references`, `evals`, and `examples` into a runtime skill directory. Nothing in the repo
currently executes the Conductor contract.

The sample run is useful evidence, but it is historical. Its README says it predates the
current run-root isolation convention and stores files at top-level `.conductor/` rather
than `.conductor/runs/<date>-<slug>/`. It also records a real gap: Batch 0 re-acceptance
passed in chat, but the re-acceptance report was never persisted to disk. That is exactly
the class of failure a harness should make impossible.

## Existing Contract Facts

### RUN_ROOT layout

`SKILL.md` defines a unique run root under `.conductor/runs/<YYYYMMDD-HHMM>-<slug>/` and
the layout:

- `goal.md`
- `plan.md`
- `tasks/`
- `reports/`
- `decisions.md`
- `batches/`

`references/templates.md` says completed task cards live under `RUN_ROOT/tasks/` and
reports live under `RUN_ROOT/reports/`.

### Current verdict vocabulary

There is no `verdict.json` schema today. Verdict-like state is free-form Markdown:

- `SKILL.md` fence outcomes: `Pass`, `Partial`, `Fail`, `Blocked`.
- `references/templates.md` Acceptance Gate field: `Judgment: <pass / partial / fail / blocked>`.
- Sample reports use `Status: accepted`, `Status: Needs-decision`, and batch summaries use
  `Status: passed`.

So the contract has semantic outcomes, but no canonical machine-readable outcome file,
no evidence references a program can validate, and no privileged writer boundary.

### Default red lines and sensitive paths

`SKILL.md` default red lines:

- Database structure or migrations
- External / cross-service API contracts
- Permission and authentication logic
- Deletion or other irreversible operations
- Cross-module shared contracts
- Core-functionality decisions the PRD did not cover

`SKILL.md` also defines structural sensitive path patterns for allowed-path red-line
flagging:

- `**/migrations/**`
- `*.sql`
- `*.proto`
- `**/auth/**`
- `**/*acl*`
- `**/permissions/**`
- shared `config`
- shared `types`
- route-manifest files
- generated files

`evals/README.md` Case 13 specifically tests the migration-bypass scenario: a task named
"tidy up the data layer" with `Allowed paths` including `db/migrations/` must be flagged
red-line-triggered even if the worker does not recognize the risk.

### Acceptance independence

The prompt-level rule is clear:

- Judge against `RUN_ROOT/goal.md` and the batch acceptance criteria.
- Rerun at least one check first-hand.
- Do not treat the implementer's report conclusions as evidence.
- No self-acceptance.

The template captures this as a Markdown Acceptance Gate with required rerun text, but
there is no process isolation and no validation that the rerun evidence points to a real
log produced by the acceptance process.

### Parallel path safety

`SKILL.md` says same-batch work requires no dependency, no shared write path, and no
read-after-write on another worker's mutable output. It also says overlapping work should
be split into serial batches, worktrees, or an integration owner. Today this is a planning
instruction only; there is no worktree creation or merge gate.

## Local Runtime Check

### Codex CLI

Path:

```text
/Applications/Codex.app/Contents/Resources/codex
```

Verified non-interactive support:

```bash
codex exec --help
```

Useful confirmed shape:

```bash
codex -a never exec -s read-only -C /Users/yrzhao/myspace/conductor --ephemeral "<prompt>"
```

Smoke test:

```bash
codex -a never exec -s read-only -C /Users/yrzhao/myspace/conductor --ephemeral "Return exactly: CODEX_RUNTIME_OK"
```

Result: exit code `0`; final output included `CODEX_RUNTIME_OK`.

Operational caveat: stdout/stderr are noisy with startup warnings. For the harness, prefer
capturing the final response with `-o/--output-last-message <file>` or JSONL with `--json`
instead of parsing raw terminal output.

### Claude Code

Path:

```text
/Users/yrzhao/.nvm/versions/node/v24.15.0/bin/claude
```

Verified help shape:

```bash
claude -p --output-format json "<prompt>"
```

The CLI documents `-p/--print` as non-interactive mode and supports `--output-format json`,
`--json-schema`, tool controls, permission mode, and worktree options.

Smoke test attempted:

```bash
claude -p --output-format json --max-budget-usd 0.05 "Return exactly: CLAUDE_RUNTIME_OK"
```

Result: exit code `1` because the low budget cap was exceeded. This confirms the command
path and JSON error shape, but not a successful budget-bounded Claude acceptance run.
For M1, Codex CLI is the verified primary runtime. Claude can remain optional unless we
retest it with an acceptable budget or a cheaper explicit model.

## Four Walls: Current Prompt vs Required Enforcement

| Wall | What the prompt currently says | Why it is soft today | Required code-level force point |
| --- | --- | --- | --- |
| Fence gate | `SKILL.md` says batches are serial, every batch ends at a fence, and a batch advances only on acceptance pass. Manager Loop says close on pass and archive to `RUN_ROOT/batches/N/`. | A manager can write `Status: passed` in Markdown. There is no `batches/N/verdict.json`, no schema, no process-owned writer, and the sample run already shows a pass result that existed only in chat. | Batch start must be a CLI operation that refuses batch `N+1` unless `RUN_ROOT/batches/N/verdict.json` exists, parses, validates, has `verdict === "PASS"`, and cites existing evidence logs. The manager-facing code path must not be able to write that verdict. |
| Red-line hook | `SKILL.md` lists default red lines and sensitive path patterns. Task Cards include `Red lines` and `Allowed paths`; eval Case 13 says migrations must be flagged even when task wording sounds harmless. | Detection is done by the manager/worker reading paths and deciding. A worker can commit a migration while calling it a data-layer cleanup. Sample acceptance manually inspected diffs for red-line paths, but nothing stops a commit. | Install a git hook that checks staged paths against default patterns plus goal-specific additions parsed from `goal.md`. Reject the commit with non-zero exit unless a human override token is supplied. |
| Independent acceptance process | `SKILL.md` and templates say acceptance must judge against `goal.md` plus first-hand reruns, not implementer conclusions. | Acceptance is just another Markdown report. The process can read implementer reports, claim reruns, or omit logs. There is no whitelist context builder and no evidence validator. | Harness must spawn acceptance as a separate child process with a whitelist input bundle: `goal.md`, batch criteria, allowed verification commands, and paths to rerun logs it created. A verdict without real rerun-log evidence must be invalid. |
| Worktree path isolation | `SKILL.md` says parallel tasks need disjoint write paths and no read-after-write dependency; Runtime Adapter mentions worktrees/sessions; eval Case 12 covers read/write races. | Workers in the sample run operated in one repo. Allowed paths are prompt text, not filesystem isolation. Git conflict detection happens only if someone chooses to check. | Worker start must create an isolated git worktree (or documented equivalent fallback directory) per worker. Integration/merge must happen through git and fail on conflicts. Optional path whitelist enforcement can be layered later. |

## Boundary: What Harness Can and Cannot Remove

The harness can make process boundaries hard: exit codes, file existence, schema validation,
evidence-log references, git hook rejection, and git merge conflicts can all be made
observable and non-negotiable.

It cannot remove semantic judgment. These still require model or human reasoning:

- whether a PRD gap is a red line,
- whether an assumption is reversible,
- whether runtime evidence is sufficient for a goal,
- whether a path that does not match a default pattern still represents a shared contract.

So the correct goal is not "100% safe"; it is to shrink self-discipline down to the
semantic layer and make the mechanical workflow impossible to skip.

## Important Same-UID Caveat

There is one real implementation boundary to settle in Phase 2. If manager, worker, and
acceptance subprocesses all run as the same OS user with unrestricted shell access, plain
filesystem permissions alone cannot fully prevent a malicious direct write such as creating
`batches/N/verdict.json` by hand. A Node harness can remove the manager's official code path
for writing verdicts, but same-user shell access is stronger than that.

Possible ways to make direct verdict forgery structurally invalid:

- run acceptance under a distinct OS identity or permission boundary, if available;
- use a crypto-signed verdict where only the acceptance subprocess receives the signing
  secret, and the fence gate rejects unsigned or wrongly signed files;
- scope the bypass guarantee to harness-mediated manager commands, then document that raw
  same-user shell writes are outside the threat model.

This is not an implementation blocker yet, but it is the key design fork for making the
"directly write verdict file" bypass test meaningful.

## Phase 1 Conclusion

The existing skill has a precise behavioral contract, good templates, and useful eval cases,
but all four target mechanisms are advisory. The minimum harness should introduce:

1. a canonical machine-readable verdict with evidence validation,
2. CLI batch-start/fence commands that trust only that verdict and process exit codes,
3. a git hook for red-line staged paths,
4. a separate acceptance subprocess with whitelist context and rerun logs,
5. worker worktrees plus git-level merge/integration.

Codex CLI is locally verified as the primary non-interactive runtime for acceptance workers.
Claude Code is installed and exposes non-interactive mode, but its successful smoke test was
not confirmed under the low budget cap used in this phase.
