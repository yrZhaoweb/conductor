import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RerunLog } from "./evidence.js";
import { safeJoin } from "./paths.js";

export function buildAcceptanceContext(
  runRoot: string,
  batch: number,
  criteria: string,
  reruns: RerunLog[]
): { contextDir: string; promptPath: string } {
  const contextDir = safeJoin(runRoot, "batches", String(batch), "acceptance", "context");
  mkdirSync(contextDir, { recursive: true });
  copyFileSync(safeJoin(runRoot, "goal.md"), path.join(contextDir, "goal.md"));
  writeFileSync(path.join(contextDir, "batch-criteria.md"), resolveCriteria(runRoot, criteria));
  const contextRerunDir = path.join(contextDir, "reruns");
  mkdirSync(contextRerunDir, { recursive: true });
  for (const rerun of reruns) {
    copyFileSync(safeJoin(runRoot, rerun.path), path.join(contextRerunDir, `${rerun.id}.log`));
  }
  const prompt = [
    "You are the independent Conductor acceptance process.",
    "Judge only from goal.md, batch-criteria.md, and rerun logs in ./reruns.",
    "Implementer reports are absent by design and must not be treated as evidence.",
    "Return JSON with schemaVersion, taskId, batch, judgment, criteria, rerunRefs, gaps, residuals, and notes.",
    "A PASS must cite at least one rerun id such as R1."
  ].join("\n");
  const promptPath = safeJoin(runRoot, "batches", String(batch), "acceptance", "prompt.md");
  writeFileSync(promptPath, `${prompt}\n`);
  writeFileSync(path.join(contextDir, "prompt.md"), `${prompt}\n`);
  return { contextDir, promptPath };
}

function resolveCriteria(runRoot: string, criteria: string): string {
  const candidate = path.isAbsolute(criteria) ? criteria : safeJoin(runRoot, criteria);
  if (existsSync(candidate)) {
    return readFileSync(candidate, "utf8");
  }
  const planPath = safeJoin(runRoot, "plan.md");
  if (existsSync(planPath)) {
    const plan = readFileSync(planPath, "utf8");
    const headingIndex = plan.toLowerCase().indexOf(criteria.toLowerCase());
    if (headingIndex >= 0) {
      return plan.slice(headingIndex).split(/\n(?=##\s+)/)[0].trim() + "\n";
    }
  }
  return `${criteria}\n`;
}
