import { randomBytes, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, HarnessError } from "../core/errors.js";
import { matchesAnyPattern } from "../core/glob.js";
import { gitPath, stagedPaths } from "../core/git.js";
import { writeJsonFile } from "../core/json.js";
import { safeJoin } from "../core/paths.js";

const MANAGED_MARKER = "conductor-harness-managed";

const DEFAULT_PATTERNS = [
  "**/migrations/**",
  "*.sql",
  "*.proto",
  "**/auth/**",
  "**/*acl*",
  "**/permissions/**",
  ".env",
  ".env.*",
  "**/.env",
  "**/.env.*",
  "**/config/**",
  "**/*config*",
  "**/types/**",
  "**/*types*",
  "**/routes/**",
  "**/*route*",
  "**/*route-manifest*",
  "**/generated/**",
  "**/*.generated.*"
];

type OverrideTokenFile = {
  schemaVersion: 1;
  tokenHash: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
};

export function redlinesCheck(repo: string, runRoot: string): void {
  const additions = readGoalPatterns(runRoot);
  const patterns = [...DEFAULT_PATTERNS, ...additions];
  const violations = stagedPaths(repo).flatMap((entry) => {
    const pattern = entry.status.startsWith("D") ? "<deletion>" : matchesAnyPattern(entry.path, patterns);
    return pattern ? [{ ...entry, pattern }] : [];
  });
  if (violations.length === 0) {
    return;
  }
  const token = process.env.CONDUCTOR_REDLINE_OVERRIDE_TOKEN;
  if (token && consumeOverrideToken(runRoot, token)) {
    return;
  }
  const details = violations.map((violation) => {
    return `- ${violation.path} (${violation.pattern})`;
  }).join("\n");
  throw new HarnessError(EXIT.REDLINE, `Conductor red-line paths staged:\n${details}`);
}

export function installHook(repo: string, runRoot: string): void {
  const hookPath = gitPath(repo, "hooks/pre-commit");
  const upstreamPath = `${hookPath}.conductor-upstream`;
  mkdirSync(path.dirname(hookPath), { recursive: true });
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!existing.includes(MANAGED_MARKER) && !existsSync(upstreamPath)) {
      renameSync(hookPath, upstreamPath);
      chmodSync(upstreamPath, 0o755);
    }
  }
  writeFileSync(hookPath, hookScript(repo, runRoot, upstreamPath), { mode: 0o755 });
  chmodSync(hookPath, 0o755);
  writeJsonFile(path.join(repo, ".git", "conductor-hook.json"), {
    schemaVersion: 1,
    repo,
    runRoot,
    hookPath,
    upstreamPath,
    installedAt: new Date().toISOString()
  });
  writeJsonFile(safeJoin(runRoot, ".harness", "hook.json"), {
    schemaVersion: 1,
    repo,
    runRoot,
    hookPath,
    upstreamPath,
    installedAt: new Date().toISOString()
  });
}

export function mintOverride(runRoot: string, reason: string, yes: boolean, expiresMinutes: number): string {
  if (!yes && !process.stdin.isTTY) {
    throw new HarnessError(EXIT.USAGE, "Override minting requires --yes in non-interactive mode");
  }
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const now = Date.now();
  const record: OverrideTokenFile = {
    schemaVersion: 1,
    tokenHash,
    reason,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiresMinutes * 60_000).toISOString()
  };
  writeJsonFile(overridePath(runRoot, tokenHash), record);
  return token;
}

function hookScript(repo: string, runRoot: string, upstreamPath: string): string {
  const commandModulePath = fileURLToPath(import.meta.url);
  const cliPath = path.resolve(path.dirname(commandModulePath), "..", "cli.js");
  return `#!/bin/sh
# ${MANAGED_MARKER}
set -eu
"${process.execPath}" "${cliPath}" redlines check --repo "${repo}" --run-root "${runRoot}"
if [ -x "${upstreamPath}" ]; then
  exec "${upstreamPath}" "$@"
fi
`;
}

function readGoalPatterns(runRoot: string): string[] {
  const goalPath = safeJoin(runRoot, "goal.md");
  if (!existsSync(goalPath)) {
    return [];
  }
  const lines = readFileSync(goalPath, "utf8").split(/\r?\n/);
  const patterns: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+Harness Red-Line Patterns\s*$/i.test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (inSection) {
      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) {
        patterns.push(match[1]);
      }
    }
  }
  return patterns;
}

function consumeOverrideToken(runRoot: string, token: string): boolean {
  const tokenHash = hashToken(token);
  const filePath = overridePath(runRoot, tokenHash);
  if (!existsSync(filePath)) {
    throw new HarnessError(EXIT.REDLINE, "Invalid red-line override token");
  }
  const record = JSON.parse(readFileSync(filePath, "utf8")) as OverrideTokenFile;
  if (record.tokenHash !== tokenHash || Date.parse(record.expiresAt) < Date.now()) {
    throw new HarnessError(EXIT.REDLINE, "Expired or invalid red-line override token");
  }
  unlinkSync(filePath);
  return true;
}

function overridePath(runRoot: string, tokenHash: string): string {
  const dir = safeJoin(runRoot, ".harness", "redline-overrides");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, `${tokenHash}.json`);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
