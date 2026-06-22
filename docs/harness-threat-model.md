# Harness Threat Model

The harness makes Conductor's mechanical workflow harder to bypass:

- Batch `N+1` cannot start unless batch `N` has a signed `PASS` verdict.
- A `PASS` verdict must cite rerun logs created by the harness.
- Acceptance context contains `goal.md`, batch criteria, and rerun logs, not implementer
  report conclusions.
- Git commits touching sensitive paths are rejected by a `pre-commit` hook unless a
  one-time override token is supplied.
- Workers can run in separate git worktrees, and conflicts surface as git merge failures.

These are hard process gates: files, hashes, signatures, exit codes, hooks, and git merges.

What remains semantic:

- deciding whether an unlisted path is still a cross-module contract,
- deciding whether a PRD gap is a red line,
- choosing sufficient rerun commands,
- judging whether evidence satisfies the original intent.

Same-UID caveat:

The default implementation uses signed verdicts to reject direct fake `verdict.json`
files. On a development machine where manager, workers, and acceptance all run as the same
OS user, a sufficiently privileged process could still read files that user can read,
including local signing keys. Stronger deployments can move signing to a separate OS user
or external signing command. The default goal is narrower and practical: make normal
manager/worker code paths unable to advance without valid harness artifacts.
