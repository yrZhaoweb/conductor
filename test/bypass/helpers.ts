import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const repoRoot = process.cwd();
export const cliPath = path.join(repoRoot, "dist/src/cli.js");
export const fixturesDir = path.join(repoRoot, "test/fixtures");

export type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
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

export function runHarness(args: string[], cwd = repoRoot, env?: NodeJS.ProcessEnv): RunResult {
  return run(process.execPath, [cliPath, ...args], cwd, env);
}

export function makeRunRoot(): { repo: string; runRoot: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "conductor-bypass-run-"));
  const runRoot = path.join(repo, ".conductor/runs/test-run");
  mkdirSync(path.join(runRoot, "reports"), { recursive: true });
  writeFileSync(path.join(runRoot, "goal.md"), "# Goal\n\nDo the thing.\n");
  writeFileSync(path.join(runRoot, "plan.md"), [
    "# Plan",
    "",
    "## Batch 0 Acceptance Criteria",
    "- C1: command evidence passes",
    ""
  ].join("\n"));
  writeFileSync(path.join(runRoot, "reports/P1-IMPL-01.md"), "implementer says pass\n");
  initRun(repo, runRoot);
  return { repo, runRoot };
}

export function makeGitRepo(): { repo: string; runRoot: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "conductor-bypass-git-"));
  assert.equal(run("git", ["init", "-b", "main"], repo).status, 0);
  assert.equal(run("git", ["config", "user.email", "test@example.com"], repo).status, 0);
  assert.equal(run("git", ["config", "user.name", "Test User"], repo).status, 0);
  mkdirSync(path.join(repo, "src"), { recursive: true });
  writeFileSync(path.join(repo, "src/a.txt"), "base a\n");
  writeFileSync(path.join(repo, "src/b.txt"), "base b\n");
  writeFileSync(path.join(repo, "src/shared.txt"), "base\n");
  assert.equal(run("git", ["add", "."], repo).status, 0);
  assert.equal(run("git", ["commit", "-m", "initial"], repo).status, 0);
  const runRoot = path.join(repo, ".conductor/runs/test-run");
  mkdirSync(path.join(runRoot, "tasks"), { recursive: true });
  writeFileSync(path.join(runRoot, "goal.md"), "# Goal\n");
  writeFileSync(path.join(runRoot, "plan.md"), "# Plan\n");
  initRun(repo, runRoot);
  return { repo, runRoot };
}

export function initRun(repo: string, runRoot: string): void {
  const init = runHarness(["init", "--run-root", runRoot, "--repo", repo, "--mode", "auto"]);
  assert.equal(init.status, 0, init.stderr);
}

export function acceptBatch(repo: string, runRoot: string, batch = 0): void {
  const accepted = runHarness([
    "accept", "run",
    "--run-root", runRoot,
    "--repo", repo,
    "--batch", String(batch),
    "--task", `P${batch}-ACC-01`,
    "--criteria", `Batch ${batch} Acceptance Criteria`,
    "--rerun", `${process.execPath} -e "console.log('ok')"`,
    "--runtime", "command",
    "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-pass.cjs")}`
  ]);
  assert.equal(accepted.status, 0, accepted.stderr);
}

export function stageFile(repo: string, filePath: string, contents = "x\n"): void {
  const absolute = path.join(repo, filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  assert.equal(run("git", ["add", filePath], repo).status, 0);
}

export function writeTask(runRoot: string, taskId: string, allowedPaths: string[]): string {
  const taskPath = path.join(runRoot, "tasks", `${taskId}.json`);
  writeFileSync(taskPath, JSON.stringify({
    schemaVersion: 1,
    taskId,
    role: "implementation",
    batch: 1,
    mode: "auto",
    status: "pending",
    objective: `Task ${taskId}`,
    scope: "test",
    allowedPaths,
    readPaths: [],
    nonGoals: [],
    redLines: [],
    redLineTriggered: false,
    dependsOn: [],
    expectedEvidence: [],
    reportPath: `reports/${taskId}.md`
  }, null, 2));
  return taskPath;
}

export function metadata(runRoot: string, taskId: string): { worktreePath: string; branch: string } {
  return JSON.parse(readFileSync(path.join(runRoot, "worktrees", `${taskId}.json`), "utf8"));
}

export function commitInWorktree(worktreePath: string, filePath: string, contents: string): void {
  const absolute = path.join(worktreePath, filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  assert.equal(run("git", ["add", filePath], worktreePath).status, 0);
  const commit = run("git", ["commit", "-m", `change ${filePath}`], worktreePath);
  assert.equal(commit.status, 0, commit.stderr);
}
