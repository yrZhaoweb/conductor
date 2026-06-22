import { spawnSync } from "node:child_process";
import path from "node:path";
import { EXIT, HarnessError } from "./errors.js";

export type GitResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type StagedPath = {
  status: string;
  path: string;
};

export function runGit(repo: string, args: string[]): GitResult {
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export function requireGit(repo: string, args: string[]): string {
  const result = runGit(repo, args);
  if (result.status !== 0) {
    throw new HarnessError(EXIT.GIT, result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

export function gitPath(repo: string, gitRelativePath: string): string {
  const raw = requireGit(repo, ["rev-parse", "--git-path", gitRelativePath]).trim();
  return path.isAbsolute(raw) ? raw : path.join(repo, raw);
}

export function stagedPaths(repo: string): StagedPath[] {
  const result = requireGit(repo, ["diff", "--cached", "--name-status", "--diff-filter=ACMRTD"]);
  if (!result.trim()) {
    return [];
  }
  return result.trim().split(/\r?\n/).map((line) => {
    const parts = line.split(/\t+/);
    const status = parts[0] ?? "";
    const filePath = parts[parts.length - 1] ?? "";
    return { status, path: filePath };
  });
}
