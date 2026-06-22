# Harness Threat Model

The harness makes Conductor's mechanical workflow harder to bypass:

- Batch `N+1` cannot start unless batch `N` has a signed `PASS` verdict.
- A `PASS` verdict must cite rerun logs created by the harness.
- The acceptance private key is stored outside `RUN_ROOT`; `RUN_ROOT/.harness/` contains
  only the public key used for verification.
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

This implementation chooses **Plan A** for the acceptance signing boundary. The private key
does not live in `RUN_ROOT`; it is kept under the harness state directory
(`$CONDUCTOR_HARNESS_KEY_DIR` when set, otherwise
`$XDG_STATE_HOME/conductor/harness-keys/`, falling back to
`~/.local/state/conductor/harness-keys/`). `RUN_ROOT/.harness/` keeps only
`acceptance-public-key.pem`.

That closes the concrete run-root insider self-signing hole: an implementation worker that
can read and write `RUN_ROOT` can no longer pick up `acceptance-private-key.pem` and
self-issue a valid `PASS`. The worker or acceptance agent should request signing only by
running `conductor-harness accept run`, which creates rerun logs, validates acceptance
output, and signs the resulting verdict.

The remaining same-OS-user limit is still real. On a development machine where manager,
workers, acceptance, and arbitrary shell commands all run as the same unrestricted OS user,
a determined process may be able to inspect harness configuration/source and read other
files that user can read, including the external harness state directory. Stronger
deployments should put signing behind a separate OS user, a narrower filesystem sandbox, or
an external signing service/command. The default goal is practical: `RUN_ROOT` contents are
not sufficient to self-sign, and normal manager/worker code paths cannot advance without
valid harness artifacts.
