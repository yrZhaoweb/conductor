# Phase 3 Plan: Harness Implementation Milestones

Status: partial

Date: 2026-06-22
Scope: implementation plan record. The core milestones are implemented in `src/` and
`test/`, but some planned fallbacks and watchpoints remain design notes.

## Success Criteria For Phase 4

- M1 gives a real run a usable fence gate plus independent acceptance path.
- M2 prevents commits touching default or goal-added red-line paths unless a human override
  token is supplied.
- M3 runs workers in isolated git worktrees and merges through git, with conflict failures
  surfaced as non-zero exits.
- M4 updates `SKILL.md` only at the Manager Loop / harness handoff layer, preserving the
  original design philosophy while making CLI exit codes the mechanical source of truth.
- Phase 5 bypass tests prove attempted bypasses fail with non-zero exits or invalid verdicts.

## Cross-Cutting Implementation Notes

- Keep the runtime dependency-free beyond Node.js and TypeScript. Harness code may use Node
  standard libraries such as `child_process`, `fs`, `path`, `crypto`, `os`, and `process`.
- Use manual TypeScript validators for JSON shapes. Do not add JSON-schema runtime
  dependencies.
- Use a deterministic `--runtime command` adapter in tests so bypass coverage does not rely
  on model availability or spend.
- Treat the signed `verdict.json` design from Phase 2 as the default enforcement layer,
  with the private signing key outside `RUN_ROOT`. Document that separate OS-user
  acceptance or external signing is a stronger optional deployment mode, not an M1 blocker.
- Keep Markdown task/report templates as human-readable mirrors, but make JSON files and
  process exit codes the harness's source of truth.

## M1: Fence Gate + Independent Acceptance

Goal: make batch advancement depend on signed `verdict.json` created only by the acceptance
command after first-hand rerun logs validate.

This is the first shippable wall. After M1 passes, report: "现在可以在真实 run 上试 M1 了".

### New / Modified Files

- `package.json`
  - Add scripts:
    - `build`: compile TypeScript.
    - `test`: run all harness tests.
    - `test:m1`: run M1-specific tests.
    - `harness`: run the built CLI.
- `tsconfig.json`
  - Compile `src/**/*.ts` to `dist/`.
- `src/cli.ts`
  - Minimal argument parser.
  - Dispatch `init`, `batch start`, `batch check`, and `accept run`.
  - Standardize exit codes.
- `src/commands/batch.ts`
  - Implement `batch start` and `batch check`.
  - Batch `0` starts without prior verdict.
  - Batch `N > 0` requires valid signed prior PASS verdict.
- `src/commands/accept.ts`
  - Run rerun commands.
  - Build acceptance whitelist context.
  - Invoke runtime adapter.
  - Validate acceptance output.
  - Write signed verdict.
- `src/core/json.ts`
  - Safe JSON read/write helpers.
  - Atomic write helper using temp file + rename.
- `src/core/paths.ts`
  - Resolve and constrain paths under `RUN_ROOT`.
  - Prevent `..` or absolute-path escape for run artifacts.
- `src/core/signatures.ts`
  - Generate/load Ed25519 keys.
  - Canonicalize verdict payload without `signature`.
  - Sign and verify verdicts.
- `src/core/evidence.ts`
  - Run rerun commands via `child_process`.
  - Capture stdout/stderr, exit code, timestamps, and SHA-256.
  - Write rerun `.log` and `.json` metadata.
- `src/core/acceptance-context.ts`
  - Copy only `goal.md`, batch criteria, prompt, and rerun logs into the acceptance context.
  - Assert reports/worker files are not copied.
- `src/core/verdict.ts`
  - Validate verdict schema.
  - Verify signature, batch number, PASS status, rerun log paths, and SHA-256 hashes.
- `test/fixtures/acceptance-pass.js`
  - Emits valid acceptance runtime JSON referencing a rerun id.
- `test/fixtures/acceptance-no-rerun.js`
  - Emits PASS without rerun evidence.
- `test/fixtures/acceptance-uses-report.js`
  - Attempts to reference implementer-report-derived evidence.
- `test/m1-fence-acceptance.test.ts`
  - M1 focused test suite.

### Tests

- `batch start --batch 0` succeeds and writes `batches/0/state.json`.
- `batch start --batch 1` fails when `batches/0/verdict.json` is missing.
- `batch start --batch 1` fails when prior verdict is unsigned.
- `batch start --batch 1` fails when prior verdict is signed but not `PASS`.
- `accept run --runtime command` writes rerun logs and signed `batches/N/verdict.json`
  when runtime output is valid.
- `accept run` rejects PASS with no rerun references.
- `accept run` rejects evidence refs that do not point to harness-created rerun metadata.
- Acceptance context contains `goal.md`, criteria, prompt, and rerun logs, but no
  `reports/` or implementer report files.
- Tampering with a rerun log after verdict creation makes `batch check` fail.
- Tampering with verdict contents after signing makes `batch check` fail.

### Verification Commands

```bash
npm run build
npm run test:m1
```

## M2: Red-Line Git Hook

Goal: reject commits touching sensitive paths at the git `pre-commit` layer, including
the migration-bypass scenario from eval Case 13.

### New / Modified Files

- `src/commands/redlines.ts`
  - Implement `redlines install-hook`, `redlines check`, and override token commands.
- `src/core/glob.ts`
  - Small internal matcher for the required path patterns.
  - Support `**`, `*`, suffix, and directory-segment matching needed by default red lines.
- `src/core/git.ts`
  - Run git commands.
  - Locate `.git` directory with `git rev-parse --git-path`.
  - Read staged paths via `git diff --cached --name-status --diff-filter=ACMRTD`.
- `src/hooks/pre-commit.sh`
  - Managed shell wrapper template.
  - Runs red-line check before any upstream hook.
- `test/m2-redlines-hook.test.ts`
  - Hook and matcher tests.

### Tests

- Default matcher catches:
  - `db/migrations/001_init.sql`
  - `schema/change.sql`
  - `api/foo.proto`
  - `src/auth/session.ts`
  - `src/user-acl.ts`
  - `src/permissions/check.ts`
  - `.env`
  - `src/config/app.ts`
  - `src/types/shared.ts`
  - `src/routes/index.ts`
  - `src/generated/client.ts`
- `goal.md` parseable `## Harness Red-Line Patterns` additions are enforced.
- Free-form project red-line prose is reported as advisory but not parsed as patterns.
- Existing pre-commit hook is moved to `pre-commit.conductor-upstream` and chained.
- Re-running install is idempotent and does not keep wrapping the hook.
- Commit with staged migration file is rejected with exit code `30`.
- Commit with same file and valid one-time override token passes the harness check and
  consumes the token.
- Invalid, expired, or reused override token is rejected.

### Verification Commands

```bash
npm run build
npm run test:m2
```

## M3: Worktree Path Isolation

Goal: give each worker a separate git worktree and make integration happen through git,
so write conflicts are physical merge failures rather than manager judgment.

### New / Modified Files

- `src/commands/worker.ts`
  - Implement `worker start`, `worker merge`, and `worker check-paths`.
- `src/core/git.ts`
  - Extend with worktree helpers:
    - `git worktree add`
    - branch creation
    - merge
    - diff path listing
    - fallback patch creation/application if worktree setup fails.
- `src/core/task-card.ts`
  - Validate task card JSON.
  - Read `allowedPaths`, `readPaths`, batch, role, and task id.
- `test/fixtures/tasks/`
  - Valid and invalid task-card JSON fixtures.
- `test/m3-worktrees.test.ts`
  - Worktree start/merge tests.

### Tests

- `worker start` creates a branch and worktree per task id.
- Starting the same task twice returns existing worktree metadata without duplicate
  branches.
- Two workers changing different files merge cleanly.
- Two workers changing the same file produce a git merge conflict and return exit code `60`.
- Worktree metadata is written to `RUN_ROOT/worktrees/<task-id>.json`.
- If `git worktree add` fails in a controlled fixture, fallback mode records
  `mode: "copy-fallback"` and still merges through a git patch path.
- `worker check-paths` rejects diffs outside `allowedPaths` when invoked.

### Verification Commands

```bash
npm run build
npm run test:m3
```

## M4: Skill / Documentation Handoff

Goal: update the prompt skill so the manager loop calls the harness and follows exit
codes, without changing Conductor's design philosophy.

### New / Modified Files

- `SKILL.md`
  - Update only the Manager Loop and closely related harness handoff language.
  - Say the manager calls `conductor-harness` for run init, batch start, acceptance, red-line
    hook installation, and worker worktrees.
  - State that mechanical enforcement comes from harness exit codes, signed verdicts,
    rerun logs, git hooks, and git merges.
  - Preserve the semantic boundary: red-line meaning and uncertainty classification still
    require model/human judgment.
- `README.md`
  - Add install/build instructions for the harness.
  - Explain minimal usage flow.
- `references/templates.md`
  - Add JSON task card/verdict pointers while keeping human-readable templates.
- `evals/README.md`
  - Add harness-backed bypass checks as the automated counterpart to prompt evals.
- `docs/harness-usage.md`
  - Short operator guide with command examples.
- `docs/harness-threat-model.md`
  - Explain hard walls, same-UID caveat, signed verdicts, and optional separate-user mode.
- `test/m4-docs-contract.test.ts`
  - Lightweight text checks for required harness handoff phrases.

### Tests

- `SKILL.md` Manager Loop mentions CLI/exit-code gate.
- `SKILL.md` does not remove the core Conductor rationale: independent acceptance, fences,
  red lines, state persistence, and semantic uncertainty boundary.
- README usage command examples reference real CLI commands.
- Template docs mention JSON task cards and signed verdicts.

### Verification Commands

```bash
npm run build
npm run test:m4
```

## Phase 5 Bypass Suite Plan

This is listed here so Phase 4 implementation leaves test seams in place.

### New / Modified Files

- `test/bypass/direct-verdict-forgery.test.ts`
- `test/bypass/skip-fence.test.ts`
- `test/bypass/redline-commit.test.ts`
- `test/bypass/acceptance-report-injection.test.ts`
- `test/bypass/worktree-conflict.test.ts`
- `test/bypass/run-all-bypass.test.ts`

### Required Bypass Assertions

- Directly writing `batches/N/verdict.json` without a valid signature fails `batch start N+1`.
- Directly writing a signed-looking verdict with bad signature fails.
- Deleting or modifying a rerun log after verdict creation fails `batch check`.
- Starting batch `N+1` before prior PASS exits non-zero.
- Committing `db/migrations/001.sql` is rejected by the hook even if the task wording says
  "tidy up data layer".
- Passing implementer-report conclusions to the acceptance runtime is rejected because the
  context builder never includes reports and evidence refs must point to rerun metadata.
- Two worker worktrees editing the same line cannot both merge cleanly; the second merge
  exits non-zero.

### Verification Command

```bash
npm run test:bypass
```

## Phase 4 Execution Order

1. Implement M1 and run `npm run build && npm run test:m1`.
2. Stop and report that M1 is ready for a real run trial.
3. Implement M2 and run `npm run build && npm run test:m2`.
4. Implement M3 and run `npm run build && npm run test:m3`.
5. Implement M4 and run `npm run build && npm run test:m4`.
6. Run the full suite:

```bash
npm run test
```

7. Proceed to Phase 5 bypass hardening and run `npm run test:bypass`.

## Open Design Watchpoints

- If Ed25519 PEM support in the active Node runtime has unexpected behavior, write a tiny
  probe before implementing `src/core/signatures.ts`.
- If TypeScript is not available locally, add it as a dev dependency in `package.json`.
  This keeps runtime framework-free while allowing TypeScript compilation.
- If Codex `--output-schema` behaves differently than help text suggests, use
  `--runtime command` for deterministic tests and keep Codex adapter behind a small
  runtime interface.
- If git worktree fails on this repo because of local state, use the planned copy-fallback
  and record the reason in `RUN_ROOT/worktrees/<task-id>.json`.
