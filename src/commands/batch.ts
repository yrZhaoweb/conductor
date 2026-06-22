import { writeJsonFile } from "../core/json.js";
import { ensureDir, safeJoin } from "../core/paths.js";
import { validateVerdict } from "../core/verdict.js";

export function batchStart(runRoot: string, batch: number): void {
  if (batch > 0) {
    validateVerdict(runRoot, batch - 1, true);
  }
  const batchDir = safeJoin(runRoot, "batches", String(batch));
  ensureDir(batchDir);
  writeJsonFile(safeJoin(runRoot, "batches", String(batch), "state.json"), {
    schemaVersion: 1,
    batch,
    status: "started",
    startedAt: new Date().toISOString()
  });
}

export function batchCheck(runRoot: string, batch: number): void {
  validateVerdict(runRoot, batch, false);
}
