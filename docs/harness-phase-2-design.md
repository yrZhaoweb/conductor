# Phase 2 Design: Conductor Harness

Date: 2026-06-22
Scope: design only. No harness implementation code is included in this phase.

## Design Goals

The harness turns Conductor's prompt rules into process gates. The manager's statements
do not advance the run; only CLI exit codes, validated JSON, rerun logs, git hooks, and
git merge state do.

This design intentionally keeps the harness small:

- Node.js + TypeScript.
- Runtime logic uses only Node standard library modules: `child_process`, `fs`, `path`,
  `crypto`, plus small standard helpers such as `os` and `process` if needed.
- No database.
- State stays under `RUN_ROOT/`.
- Red-line blocking uses a native git `pre-commit` shell hook installed by the harness.

Phase 1 identified a same-OS-user caveat: if every process runs as the same unrestricted
user, raw filesystem permissions alone cannot stop a determined process from editing any
file it can access. This design uses signed, evidence-backed verdicts so direct
`verdict.json` forgery fails validation. A stronger optional mode can run acceptance under
a separate OS user, but the default implementation should not depend on that being
available.

## Directory Structure

Repository additions:

```text
package.json
tsconfig.json
src/
  cli.ts
  commands/
    accept.ts
    batch.ts
    redlines.ts
    worker.ts
  core/
    acceptance-context.ts
    evidence.ts
    git.ts
    glob.ts
    json.ts
    paths.ts
    signatures.ts
    verdict.ts
  hooks/
    pre-commit.sh
test/
  bypass/
  fixtures/
docs/
  harness-phase-1-current-state-and-gap.md
  harness-phase-2-design.md
```

Installed run state additions under each `RUN_ROOT`:

```text
RUN_ROOT/
  goal.md
  plan.md
  decisions.md
  tasks/
    <task-id>.json
    <task-id>.md                 # optional human-readable mirror
  reports/
    <task-id>.md
  batches/
    <N>/
      state.json
      summary.md
      verdict.json
      acceptance/
        request.json
        prompt.md
        context/
          goal.md
          batch-criteria.md
          reruns/
            <rerun-id>.log
        reruns/
          <rerun-id>.json
          <rerun-id>.log
        runtime-output.json
        runtime-final.md
  worktrees/
    <task-id>.json
  .harness/
    config.json
    hook.json
    acceptance-public-key.pem
    acceptance-private-key.pem   # 0600; not read by manager commands
    redline-overrides/
```

The `.harness/acceptance-private-key.pem` file is the pragmatic default for a same-user
development machine. It gives the official manager CLI no verdict-writing code path, and
the gate rejects unsigned files. For a stricter deployment, `config.json` may point to an
external private-key command or separate acceptance user so the manager OS identity cannot
read the private key.

## CLI Command Signatures

All commands return `0` on success and non-zero on rejection or invalid state.

Common options:

```text
--run-root <path>        Absolute or repo-relative RUN_ROOT.
--repo <path>            Target git repo; defaults to cwd when safe.
--json                   Emit machine-readable result to stdout.
```

Exit code classes:

```text
0   success
10  invalid arguments or schema
20  fence blocked / missing prior PASS
30  red-line hook rejection
40  acceptance invalid or failed
50  child process/runtime failure
60  git/worktree/merge failure
```

### Run Initialization

```text
conductor-harness init \
  --repo <repo> \
  --slug <short-goal-slug> \
  --mode <auto|strict> \
  [--runtime codex|claude|command] \
  [--runtime-command <command-template>]
```

Creates the run root layout, writes `.harness/config.json`, generates the acceptance signing
key pair, and initializes `decisions.md`, `tasks/`, `reports/`, `batches/`, and `worktrees/`.

This command may create `RUN_ROOT/goal.md` from `--goal-file` later, but it should not
invent goal content. The manager remains responsible for writing the contract documents.

### Batch Fence Gate

```text
conductor-harness batch start \
  --run-root <RUN_ROOT> \
  --batch <N>
```

Rules:

- Batch `0` may start without a prior verdict.
- Batch `N > 0` starts only if `RUN_ROOT/batches/<N-1>/verdict.json` exists and validates
  with `verdict === "PASS"`.
- Missing, malformed, unsigned, stale, or non-PASS verdicts return exit code `20`.
- On success, writes or updates `RUN_ROOT/batches/<N>/state.json` with status `started`.

```text
conductor-harness batch check \
  --run-root <RUN_ROOT> \
  --batch <N>
```

Validates `batches/<N>/verdict.json` without starting another batch.

### Acceptance

```text
conductor-harness accept run \
  --run-root <RUN_ROOT> \
  --repo <repo> \
  --batch <N> \
  --task <acceptance-task-id> \
  --criteria <criteria-file-or-id> \
  --rerun "<command>" \
  [--rerun "<command>"] \
  [--runtime codex|claude|command] \
  [--runtime-command <command-template>]
```

Rules:

- Harness runs each `--rerun` command itself in `<repo>` and captures stdout, stderr,
  command, exit code, timestamps, and SHA-256.
- Harness builds a whitelist context directory containing only:
  - `goal.md`,
  - extracted batch criteria,
  - rerun logs and rerun metadata,
  - a generated acceptance prompt.
- The child acceptance process runs with cwd set to that context directory.
- Implementer reports are not copied into the context directory and are not passed in the
  prompt.
- The child process must return structured acceptance JSON. The harness validates it,
  verifies that every claimed evidence reference points to a real rerun log, then writes
  and signs `RUN_ROOT/batches/<N>/verdict.json`.
- If judgment is not `PASS`, `batch start --batch N+1` will reject it.

Deterministic test/runtime adapter:

```text
conductor-harness accept run \
  --runtime command \
  --runtime-command "node test/fixtures/acceptance-pass.js"
```

The command runtime lets bypass tests avoid model calls while exercising the same schema,
evidence, signing, and fence code paths.

### Red-Line Hook

```text
conductor-harness redlines install-hook \
  --repo <repo> \
  --run-root <RUN_ROOT>
```

Installs or updates the git `pre-commit` hook.

```text
conductor-harness redlines check \
  --repo <repo> \
  --run-root <RUN_ROOT>
```

Runs the same staged-path check used by the hook. The hook calls this command.

```text
conductor-harness redlines override mint \
  --run-root <RUN_ROOT> \
  --reason "<human reason>" \
  [--expires-minutes <N>]
```

Creates a one-time override token. The command should require an interactive TTY and a
confirmation phrase so unattended agents cannot mint a token through the normal non-TTY
path. The hook accepts an override only through:

```text
CONDUCTOR_REDLINE_OVERRIDE_TOKEN=<token> git commit
```

The hook consumes the token after a successful match.

### Worker Worktrees

```text
conductor-harness worker start \
  --run-root <RUN_ROOT> \
  --repo <repo> \
  --task <RUN_ROOT/tasks/<task-id>.json>
```

Creates a git worktree for the task and records it in `RUN_ROOT/worktrees/<task-id>.json`.

```text
conductor-harness worker merge \
  --run-root <RUN_ROOT> \
  --repo <repo> \
  --task <task-id>
```

Merges the worker branch back into the manager repo. Git conflicts return exit code `60`.

```text
conductor-harness worker check-paths \
  --run-root <RUN_ROOT> \
  --repo <repo> \
  --task <task-id>
```

Optional enhancement: compare the task branch diff against `allowedPaths` before merge.
This can ship after basic worktree isolation.

Fallback if `git worktree` is unavailable or blocked:

```text
RUN_ROOT/worktrees/<task-id>.json
{
  "mode": "copy-fallback",
  "reason": "<git worktree failure>",
  "copyPath": "<path>",
  "mergeStrategy": "git diff/apply"
}
```

The fallback must still merge through git patch application and must record conflicts or
patch failures as non-zero outcomes.

## Schemas

Schemas are implemented with manual TypeScript validators, not a JSON-schema runtime
dependency. JSON Schema files may be emitted for Codex/Claude structured output, but runtime
validation remains local code.

### Task Card JSON

Human Markdown task cards may remain, but harness-enforced task cards are JSON:

```json
{
  "schemaVersion": 1,
  "taskId": "P1-IMPL-01",
  "role": "implementation",
  "batch": 1,
  "mode": "auto",
  "status": "pending",
  "objective": "Bounded task objective",
  "scope": "Included surfaces",
  "allowedPaths": ["web/app/**"],
  "readPaths": ["web/app/**", "web/components/**"],
  "nonGoals": ["Do not edit auth"],
  "redLines": ["database/migrations", "auth/permissions"],
  "redLineTriggered": false,
  "dependsOn": ["P0-ACC-01"],
  "expectedEvidence": ["pnpm --dir web test"],
  "reportPath": "reports/P1-IMPL-01.md"
}
```

Validation requirements:

- `taskId` stable and filesystem-safe.
- `role` in `implementation | testing | review | acceptance | integration | investigation`.
- `batch` non-negative integer.
- `allowedPaths` required for implementation/integration roles.
- Acceptance tasks may have `allowedPaths` restricted to reports/log outputs only.
- If `allowedPaths` match sensitive patterns, `redLineTriggered` must be true or the
  harness warns/fails before dispatch.

### Acceptance Request

```json
{
  "schemaVersion": 1,
  "runRoot": "/abs/.conductor/runs/20260622-demo",
  "repo": "/abs/repo",
  "batch": 1,
  "taskId": "P1-ACC-01",
  "goalPath": "goal.md",
  "criteria": [
    {
      "id": "C1",
      "text": "Focused tests pass"
    }
  ],
  "reruns": [
    {
      "id": "R1",
      "command": "pnpm test",
      "cwd": "/abs/repo",
      "logPath": "batches/1/acceptance/reruns/R1.log",
      "metadataPath": "batches/1/acceptance/reruns/R1.json",
      "exitCode": 0,
      "sha256": "<hex>"
    }
  ],
  "forbiddenContext": [
    "reports/*",
    "worker summaries",
    "implementer conclusions"
  ]
}
```

### Acceptance Runtime Output

The child acceptance process returns this shape:

```json
{
  "schemaVersion": 1,
  "taskId": "P1-ACC-01",
  "batch": 1,
  "judgment": "PASS",
  "criteria": [
    {
      "id": "C1",
      "status": "pass",
      "evidenceRefs": ["R1"]
    }
  ],
  "rerunRefs": ["R1"],
  "gaps": [],
  "residuals": [],
  "notes": "Judged from goal, criteria, and rerun logs only."
}
```

Validation requirements:

- `judgment` in `PASS | PARTIAL | FAIL | BLOCKED`.
- `PASS` requires at least one `rerunRef`.
- Every `rerunRef` and every criterion `evidenceRefs` entry must point to a rerun metadata
  file created by the harness for this batch.
- A `PASS` with unchecked criteria, missing logs, or nonexistent evidence is invalid and
  becomes exit code `40`.

### Verdict JSON

`RUN_ROOT/batches/<N>/verdict.json` is the only fence source of truth:

```json
{
  "schemaVersion": 1,
  "runRoot": "/abs/.conductor/runs/20260622-demo",
  "batch": 1,
  "taskId": "P1-ACC-01",
  "verdict": "PASS",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "criteria": [
    {
      "id": "C1",
      "status": "pass",
      "evidenceRefs": ["R1"]
    }
  ],
  "rerunLogs": [
    {
      "id": "R1",
      "path": "batches/1/acceptance/reruns/R1.log",
      "metadataPath": "batches/1/acceptance/reruns/R1.json",
      "sha256": "<hex>",
      "command": "pnpm test",
      "exitCode": 0
    }
  ],
  "runtime": {
    "kind": "codex",
    "exitCode": 0,
    "outputPath": "batches/1/acceptance/runtime-final.md"
  },
  "signature": {
    "algorithm": "ed25519",
    "keyId": "<public-key-sha256>",
    "value": "<base64-signature-over-canonical-verdict-without-signature>"
  }
}
```

Validation requirements:

- File path must be exactly `RUN_ROOT/batches/<N>/verdict.json`.
- `batch` must equal `<N>`.
- `verdict` must be one of `PASS | PARTIAL | FAIL | BLOCKED`.
- `batch start N+1` accepts only `PASS`.
- Each rerun log path must stay under `RUN_ROOT/batches/<N>/acceptance/reruns/`.
- Each log's SHA-256 must match current file contents.
- Signature must verify against `.harness/acceptance-public-key.pem`.

Directly writing a fake `verdict.json` without valid evidence and signature fails the gate.

## Git Hook Install and Chain Strategy

Harness installs a managed wrapper at `.git/hooks/pre-commit`.

If no hook exists:

```sh
#!/bin/sh
set -eu
exec "<repo>/dist/cli.js" redlines check --repo "<repo>" --run-root "<RUN_ROOT>"
```

If a hook already exists:

1. Move it to `.git/hooks/pre-commit.conductor-upstream` unless it is already a managed
   Conductor wrapper.
2. Install a new wrapper that runs Conductor red-line checks first.
3. If Conductor passes, execute the upstream hook.

Wrapper shape:

```sh
#!/bin/sh
set -eu

"<node>" "<harness-cli>" redlines check --repo "<repo>" --run-root "<RUN_ROOT>"

if [ -x ".git/hooks/pre-commit.conductor-upstream" ]; then
  exec ".git/hooks/pre-commit.conductor-upstream" "$@"
fi
```

The hook's target run root is recorded in `.git/conductor-hook.json` and in
`RUN_ROOT/.harness/hook.json`. Re-installing updates the managed wrapper without deleting
the upstream hook.

Red-line staged-path check:

```text
git diff --cached --name-status --diff-filter=ACMRTD
```

Reject when:

- staged path matches default sensitive patterns,
- staged path matches machine-readable project additions in `goal.md`,
- staged status is deletion (`D`) and no override token is present.

Default sensitive patterns:

```text
**/migrations/**
*.sql
*.proto
**/auth/**
**/*acl*
**/permissions/**
.env
.env.*
**/.env
**/.env.*
**/config/**
**/*config*
**/types/**
**/*types*
**/*route*
**/*route-manifest*
**/generated/**
**/*.generated.*
```

Project additions in `goal.md` use a small parseable section:

```text
## Harness Red-Line Patterns
- billing/**
- packages/shared-contracts/**
```

Free-form prose under "Project-specific additions" remains human guidance. The harness
can show it in diagnostics, but only parseable patterns are mechanically enforced.

## Acceptance Subprocess Invocation

Primary verified runtime: Codex CLI.

```text
codex -a never exec \
  -s read-only \
  -C <acceptance-context-dir> \
  --ephemeral \
  -o <RUN_ROOT>/batches/<N>/acceptance/runtime-final.md \
  --output-schema <acceptance-output-schema.json> \
  <generated-prompt>
```

Notes:

- The context dir contains only whitelisted files.
- No `--add-dir <repo>` is passed to the acceptance process.
- Rerun commands are executed by the harness before the child model starts.
- Codex stdout is noisy, so the harness reads the `-o` final message and command exit code.

Claude Code remains an adapter:

```text
claude -p \
  --output-format json \
  --json-schema <acceptance-output-schema.json> \
  --permission-mode dontAsk \
  --tools "" \
  <generated-prompt>
```

Phase 1 did not confirm a successful budget-bounded Claude smoke test, so M1 should use
Codex or `--runtime command` for tests.

Generated acceptance prompt:

- states that the process is the acceptance judge,
- points to local `goal.md`, `batch-criteria.md`, and rerun logs in the context dir,
- explicitly says implementer reports are absent by design,
- requires JSON matching the schema,
- forbids treating missing reruns as PASS.

## Hard Walls vs Remaining Semantic Judgment

| Area | Hard wall in this design | Still semantic/self-discipline |
| --- | --- | --- |
| Fence gate | `batch start N+1` exits non-zero unless prior signed verdict validates and is `PASS`. Missing logs, wrong hashes, wrong batch, invalid signature, or non-PASS block. | Whether acceptance criteria fully capture the user's intent. |
| Verdict writer separation | Manager commands have no official code path to write `verdict.json`; `accept run` writes it only after subprocess output and rerun evidence validate. Fake direct files without signature/evidence fail. | On same-UID machines, a process that steals the private key can still forge. Separate OS user mode is needed for stronger filesystem isolation. |
| Acceptance independence | Acceptance child cwd contains only goal, batch criteria, and rerun logs. Implementer reports are not copied or prompted. | The acceptance model's judgment over the provided evidence is still model reasoning. |
| Rerun evidence | Harness-created rerun logs have metadata and SHA-256; PASS without real refs is invalid. | Choosing the right rerun commands is a planning/semantic decision. |
| Red-line hook | Git commit exits non-zero when staged paths match sensitive patterns or deletion status without override. Migration Case 13 is blocked at commit time. | Whether an unlisted path semantically changes an API/auth/shared contract remains model or human judgment. |
| Override | Hook requires one-time override token and records reason/expiry. | Confirming that the override was truly human is limited by local terminal/session trust. |
| Worktree isolation | Each worker branch/worktree isolates writes; merge conflicts are git-level non-zero failures. | Declaring read sets and recognizing read-after-write dependencies still requires planning judgment unless path enforcement is expanded. |

## Minimum Delivery Order Alignment

M1 should implement walls 1 and 3 together:

- `batch start/check`
- `accept run`
- evidence logs
- signed `verdict.json`
- command-runtime adapter for deterministic tests

M2 should implement wall 2:

- default sensitive matcher,
- `goal.md` parseable additions,
- hook install/chaining,
- override token.

M3 should implement wall 4:

- `worker start`,
- `worker merge`,
- git worktree fallback recording,
- optional path diff check.

M4 should update docs and `SKILL.md` Manager Loop:

- Manager calls CLI and follows exit codes.
- Harness is the source of mechanical enforcement.
- Semantic red-line/uncertainty judgment remains outside what code can fully solve.

## Phase 2 Assumptions To Confirm

This design makes one deliberate choice: signed verdicts are the default enforcement layer
for same-user machines. They are enough for the required bypass test where a non-self-
disciplined agent directly writes an unsigned or evidence-free verdict file, but they are
not the same as separate OS-user file permissions.

If the desired threat model requires the manager OS identity itself to be unable to read
the acceptance signing key, Phase 3 should add an `--acceptance-user <user>` or external
signing-command requirement before implementation starts.
