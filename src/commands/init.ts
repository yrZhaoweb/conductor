import { existsSync, writeFileSync } from "node:fs";
import { EXIT, HarnessError } from "../core/errors.js";
import { writeJsonFile } from "../core/json.js";
import { ensureDir, safeJoin } from "../core/paths.js";
import { ensureSigningKeys } from "../core/signatures.js";

export function initRun(runRoot: string, repo: string, mode: string): void {
  if (!["auto", "strict"].includes(mode)) {
    throw new HarnessError(EXIT.USAGE, `Invalid mode: ${mode}`);
  }
  ensureDir(runRoot);
  ensureDir(safeJoin(runRoot, "tasks"));
  ensureDir(safeJoin(runRoot, "reports"));
  ensureDir(safeJoin(runRoot, "batches"));
  ensureDir(safeJoin(runRoot, "worktrees"));
  ensureDir(safeJoin(runRoot, ".harness"));
  ensureDir(safeJoin(runRoot, ".harness", "redline-overrides"));
  const decisionsPath = safeJoin(runRoot, "decisions.md");
  if (!existsSync(decisionsPath)) {
    writeFileSync(decisionsPath, "# Auto Decisions\n");
  }
  ensureSigningKeys(runRoot);
  writeJsonFile(safeJoin(runRoot, ".harness", "config.json"), {
    schemaVersion: 1,
    repo,
    runRoot,
    mode,
    createdAt: new Date().toISOString()
  });
}
