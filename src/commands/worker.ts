import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { EXIT, HarnessError } from "../core/errors.js";
import { matchesAnyPattern } from "../core/glob.js";
import { requireGit, runGit } from "../core/git.js";
import { readJsonFile, writeJsonFile } from "../core/json.js";
import { ensureDir, safeJoin } from "../core/paths.js";
import { readTaskCard, TaskCard } from "../core/task-card.js";

type WorktreeMetadata = {
  schemaVersion: 1;
  taskId: string;
  branch: string;
  worktreePath: string;
  baseCommit: string;
  mode: "git-worktree";
  createdAt: string;
  taskPath: string;
  allowedPaths: string[];
};

export function workerStart(runRoot: string, repo: string, taskPath: string): void {
  const task = readTaskCard(taskPath);
  const metadataPath = metadataPathFor(runRoot, task.taskId);
  if (existsSync(metadataPath)) {
    return;
  }
  const baseCommit = requireGit(repo, ["rev-parse", "HEAD"]).trim();
  const branch = `codex/conductor-${task.taskId}-${shortHash(`${runRoot}:${task.taskId}`)}`;
  const worktreePath = safeJoin(runRoot, "worktrees", `${task.taskId}.worktree`);
  ensureDir(path.dirname(worktreePath));
  const result = runGit(repo, ["worktree", "add", "-b", branch, worktreePath, baseCommit]);
  if (result.status !== 0) {
    throw new HarnessError(EXIT.GIT, result.stderr || result.stdout || "git worktree add failed");
  }
  writeJsonFile(metadataPath, {
    schemaVersion: 1,
    taskId: task.taskId,
    branch,
    worktreePath,
    baseCommit,
    mode: "git-worktree",
    createdAt: new Date().toISOString(),
    taskPath,
    allowedPaths: task.allowedPaths
  } satisfies WorktreeMetadata);
}

export function workerMerge(runRoot: string, repo: string, taskId: string): void {
  const metadata = readMetadata(runRoot, taskId);
  const check = runGit(metadata.worktreePath, ["status", "--porcelain"]);
  if (check.status !== 0) {
    throw new HarnessError(EXIT.GIT, check.stderr || "git status failed in worktree");
  }
  if (check.stdout.trim()) {
    throw new HarnessError(EXIT.GIT, `Worker worktree has uncommitted changes: ${taskId}`);
  }
  const result = runGit(repo, ["merge", "--no-ff", metadata.branch, "-m", `Merge ${taskId}`]);
  if (result.status !== 0) {
    throw new HarnessError(EXIT.GIT, result.stderr || result.stdout || "git merge failed");
  }
}

export function workerCheckPaths(runRoot: string, repo: string, taskId: string): void {
  const metadata = readMetadata(runRoot, taskId);
  const diff = requireGit(repo, ["diff", "--name-only", `${metadata.baseCommit}...${metadata.branch}`]);
  const changed = diff.trim() ? diff.trim().split(/\r?\n/) : [];
  const outside = changed.filter((filePath) => !matchesAnyPattern(filePath, metadata.allowedPaths));
  if (outside.length > 0) {
    throw new HarnessError(EXIT.GIT, `Task ${taskId} changed files outside allowed paths:\n${outside.join("\n")}`);
  }
}

function readMetadata(runRoot: string, taskId: string): WorktreeMetadata {
  return readJsonFile<WorktreeMetadata>(metadataPathFor(runRoot, taskId));
}

function metadataPathFor(runRoot: string, taskId: string): string {
  return safeJoin(runRoot, "worktrees", `${taskId}.json`);
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
