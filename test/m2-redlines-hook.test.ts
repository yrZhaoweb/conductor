import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist/src/cli.js");

type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runHarness(args: string[], cwd = repoRoot, env?: NodeJS.ProcessEnv): RunResult {
  return run(process.execPath, [cliPath, ...args], cwd, env);
}

function makeGitRepo(goalExtra = ""): { repo: string; runRoot: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "conductor-m2-"));
  assert.equal(run("git", ["init"], repo).status, 0);
  assert.equal(run("git", ["config", "user.email", "test@example.com"], repo).status, 0);
  assert.equal(run("git", ["config", "user.name", "Test User"], repo).status, 0);
  const runRoot = path.join(repo, ".conductor/runs/test-run");
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, "goal.md"), [
    "# Goal",
    "",
    "Project-specific additions:",
    "- Do not touch billing contracts.",
    "",
    goalExtra
  ].join("\n"));
  writeFileSync(path.join(runRoot, "plan.md"), "# Plan\n");
  const init = runHarness(["init", "--run-root", runRoot, "--repo", repo, "--mode", "auto"]);
  assert.equal(init.status, 0, init.stderr);
  return { repo, runRoot };
}

function stageFile(repo: string, filePath: string, contents = "x\n"): void {
  const absolute = path.join(repo, filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  assert.equal(run("git", ["add", filePath], repo).status, 0);
}

describe("M2 red-line hook", () => {
  it("rejects default sensitive staged paths", () => {
    const sensitivePaths = [
      "db/migrations/001_init.sql",
      "schema/change.sql",
      "api/foo.proto",
      "src/auth/session.ts",
      "src/user-acl.ts",
      "src/permissions/check.ts",
      ".env",
      "src/config/app.ts",
      "src/types/shared.ts",
      "src/routes/index.ts",
      "src/generated/client.ts"
    ];

    for (const sensitivePath of sensitivePaths) {
      const { repo, runRoot } = makeGitRepo();
      stageFile(repo, sensitivePath);

      const result = runHarness(["redlines", "check", "--repo", repo, "--run-root", runRoot]);

      assert.equal(result.status, 30, sensitivePath);
      assert.match(result.stderr, new RegExp(sensitivePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("enforces parseable goal.md red-line additions", () => {
    const { repo, runRoot } = makeGitRepo([
      "## Harness Red-Line Patterns",
      "- billing/**",
      ""
    ].join("\n"));
    stageFile(repo, "billing/contracts.ts");

    const result = runHarness(["redlines", "check", "--repo", repo, "--run-root", runRoot]);

    assert.equal(result.status, 30);
    assert.match(result.stderr, /billing\/contracts\.ts/);
  });

  it("does not mechanically enforce free-form project prose as a pattern", () => {
    const { repo, runRoot } = makeGitRepo();
    stageFile(repo, "billing/contracts.ts");

    const result = runHarness(["redlines", "check", "--repo", repo, "--run-root", runRoot]);

    assert.equal(result.status, 0, result.stderr);
  });

  it("installs a chained pre-commit hook idempotently", () => {
    const { repo, runRoot } = makeGitRepo();
    const hookPath = run("git", ["rev-parse", "--git-path", "hooks/pre-commit"], repo).stdout.trim();
    const absoluteHookPath = path.join(repo, hookPath);
    writeFileSync(absoluteHookPath, "#!/bin/sh\nprintf upstream > .git/upstream-ran\n");

    const first = runHarness(["redlines", "install-hook", "--repo", repo, "--run-root", runRoot]);
    const second = runHarness(["redlines", "install-hook", "--repo", repo, "--run-root", runRoot]);

    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(existsSync(absoluteHookPath));
    assert.ok(existsSync(path.join(repo, ".git/hooks/pre-commit.conductor-upstream")));
    assert.equal(existsSync(path.join(repo, ".git/hooks/pre-commit.conductor-upstream.conductor-upstream")), false);

    stageFile(repo, "safe.txt");
    const commit = run("git", ["commit", "-m", "safe"], repo);

    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(readFileSync(path.join(repo, ".git/upstream-ran"), "utf8"), "upstream");
  });

  it("rejects a migration commit through the installed hook", () => {
    const { repo, runRoot } = makeGitRepo();
    assert.equal(runHarness(["redlines", "install-hook", "--repo", repo, "--run-root", runRoot]).status, 0);
    stageFile(repo, "db/migrations/001.sql");

    const commit = run("git", ["commit", "-m", "bad migration"], repo);

    assert.notEqual(commit.status, 0);
    assert.match(commit.stderr, /red-line/i);
    assert.match(commit.stderr, /db\/migrations\/001\.sql/);
  });

  it("allows a red-line commit with a valid one-time override token", () => {
    const { repo, runRoot } = makeGitRepo();
    assert.equal(runHarness(["redlines", "install-hook", "--repo", repo, "--run-root", runRoot]).status, 0);
    stageFile(repo, "db/migrations/001.sql");
    const mint = runHarness([
      "redlines", "override", "mint",
      "--run-root", runRoot,
      "--reason", "human approved migration",
      "--yes"
    ]);
    assert.equal(mint.status, 0, mint.stderr);
    const token = mint.stdout.trim();

    const commit = run("git", ["commit", "-m", "approved migration"], repo, {
      CONDUCTOR_REDLINE_OVERRIDE_TOKEN: token
    });
    assert.equal(commit.status, 0, commit.stderr);

    stageFile(repo, "db/migrations/002.sql");
    const reuse = run("git", ["commit", "-m", "reuse override"], repo, {
      CONDUCTOR_REDLINE_OVERRIDE_TOKEN: token
    });
    assert.notEqual(reuse.status, 0);
    assert.match(reuse.stderr, /override/i);
  });
});
