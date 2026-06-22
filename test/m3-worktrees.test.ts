import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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

function run(command: string, args: string[], cwd: string): RunResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runHarness(args: string[], cwd = repoRoot): RunResult {
  return run(process.execPath, [cliPath, ...args], cwd);
}

function makeGitRepo(): { repo: string; runRoot: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "conductor-m3-"));
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
  const init = runHarness(["init", "--run-root", runRoot, "--repo", repo, "--mode", "auto"]);
  assert.equal(init.status, 0, init.stderr);
  return { repo, runRoot };
}

function writeTask(runRoot: string, taskId: string, allowedPaths: string[]): string {
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

function metadata(runRoot: string, taskId: string): { worktreePath: string; branch: string } {
  return JSON.parse(readFileSync(path.join(runRoot, "worktrees", `${taskId}.json`), "utf8"));
}

function commitInWorktree(worktreePath: string, filePath: string, contents: string): void {
  const absolute = path.join(worktreePath, filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  assert.equal(run("git", ["add", filePath], worktreePath).status, 0);
  const commit = run("git", ["commit", "-m", `change ${filePath}`], worktreePath);
  assert.equal(commit.status, 0, commit.stderr);
}

describe("M3 worker worktrees", () => {
  it("creates one branch and worktree per task", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskPath = writeTask(runRoot, "P1-A", ["src/a.txt"]);

    const result = runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskPath]);

    assert.equal(result.status, 0, result.stderr);
    const meta = metadata(runRoot, "P1-A");
    assert.ok(meta.branch.includes("P1-A"));
    assert.ok(existsSync(path.join(meta.worktreePath, "src/a.txt")));
  });

  it("returns existing metadata when starting the same task twice", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskPath = writeTask(runRoot, "P1-A", ["src/a.txt"]);

    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskPath]).status, 0);
    const first = metadata(runRoot, "P1-A");
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskPath]).status, 0);
    const second = metadata(runRoot, "P1-A");

    assert.deepEqual(second, first);
  });

  it("merges two workers that edit different files", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskA = writeTask(runRoot, "P1-A", ["src/a.txt"]);
    const taskB = writeTask(runRoot, "P1-B", ["src/b.txt"]);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskA]).status, 0);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskB]).status, 0);
    commitInWorktree(metadata(runRoot, "P1-A").worktreePath, "src/a.txt", "worker a\n");
    commitInWorktree(metadata(runRoot, "P1-B").worktreePath, "src/b.txt", "worker b\n");

    const mergeA = runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-A"]);
    const mergeB = runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-B"]);

    assert.equal(mergeA.status, 0, mergeA.stderr);
    assert.equal(mergeB.status, 0, mergeB.stderr);
    assert.equal(readFileSync(path.join(repo, "src/a.txt"), "utf8"), "worker a\n");
    assert.equal(readFileSync(path.join(repo, "src/b.txt"), "utf8"), "worker b\n");
  });

  it("surfaces git merge conflicts as non-zero exits", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskA = writeTask(runRoot, "P1-A", ["src/shared.txt"]);
    const taskB = writeTask(runRoot, "P1-B", ["src/shared.txt"]);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskA]).status, 0);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskB]).status, 0);
    commitInWorktree(metadata(runRoot, "P1-A").worktreePath, "src/shared.txt", "worker a\n");
    commitInWorktree(metadata(runRoot, "P1-B").worktreePath, "src/shared.txt", "worker b\n");

    assert.equal(runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-A"]).status, 0);
    const mergeB = runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-B"]);

    assert.equal(mergeB.status, 60);
    assert.match(mergeB.stderr, /merge/i);
  });

  it("rejects task branch diffs outside allowed paths", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskPath = writeTask(runRoot, "P1-A", ["src/a.txt"]);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskPath]).status, 0);
    commitInWorktree(metadata(runRoot, "P1-A").worktreePath, "src/b.txt", "outside\n");

    const result = runHarness(["worker", "check-paths", "--run-root", runRoot, "--repo", repo, "--task", "P1-A"]);

    assert.equal(result.status, 60);
    assert.match(result.stderr, /outside allowed paths/i);
  });
});
