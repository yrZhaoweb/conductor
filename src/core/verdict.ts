import { existsSync, readFileSync } from "node:fs";
import { EXIT, HarnessError } from "./errors.js";
import { readJsonFile, writeJsonFile } from "./json.js";
import { safeJoin } from "./paths.js";
import { sha256, signPayload, SignatureBlock, verifyPayload } from "./signatures.js";

export type CriterionResult = {
  id: string;
  status: string;
  evidenceRefs: string[];
};

export type Verdict = {
  schemaVersion: 1;
  runRoot: string;
  batch: number;
  taskId: string;
  verdict: "PASS" | "PARTIAL" | "FAIL" | "BLOCKED";
  createdAt: string;
  criteria: CriterionResult[];
  rerunLogs: Array<{
    id: string;
    path: string;
    metadataPath: string;
    sha256: string;
    command: string;
    exitCode: number | null;
  }>;
  runtime: {
    kind: string;
    exitCode: number | null;
    outputPath: string;
  };
  signature: SignatureBlock;
};

export function writeSignedVerdict(runRoot: string, batch: number, verdict: Omit<Verdict, "signature">): Verdict {
  const signature = signPayload(runRoot, verdict);
  const signed = { ...verdict, signature };
  writeJsonFile(safeJoin(runRoot, "batches", String(batch), "verdict.json"), signed);
  return signed;
}

export function validateVerdict(runRoot: string, batch: number, requirePass: boolean): Verdict {
  const verdictPath = safeJoin(runRoot, "batches", String(batch), "verdict.json");
  if (!existsSync(verdictPath)) {
    throw new HarnessError(EXIT.FENCE, `Missing verdict: ${verdictPath}`);
  }
  const verdict = readJsonFile<Verdict>(verdictPath);
  validateVerdictShape(verdict);
  if (verdict.batch !== batch) {
    throw new HarnessError(EXIT.FENCE, `Verdict batch mismatch: expected ${batch}`);
  }
  if (!verdict.signature) {
    throw new HarnessError(EXIT.FENCE, "Verdict signature missing");
  }
  const { signature, ...payload } = verdict;
  if (!verifyPayload(runRoot, payload, signature)) {
    throw new HarnessError(EXIT.FENCE, "Verdict signature verification failed");
  }
  for (const rerun of verdict.rerunLogs) {
    if (!rerun.path.startsWith(`batches/${batch}/acceptance/reruns/`)) {
      throw new HarnessError(EXIT.FENCE, `Rerun log path is outside batch reruns: ${rerun.path}`);
    }
    const logPath = safeJoin(runRoot, rerun.path);
    if (!existsSync(logPath)) {
      throw new HarnessError(EXIT.FENCE, `Rerun log missing: ${rerun.path}`);
    }
    const actualHash = sha256(readFileSync(logPath));
    if (actualHash !== rerun.sha256) {
      throw new HarnessError(EXIT.FENCE, `Rerun log hash mismatch: ${rerun.path}`);
    }
  }
  if (requirePass && verdict.verdict !== "PASS") {
    throw new HarnessError(EXIT.FENCE, `Prior verdict is ${verdict.verdict}, not PASS`);
  }
  return verdict;
}

function validateVerdictShape(verdict: Verdict): void {
  if (verdict.schemaVersion !== 1) {
    throw new HarnessError(EXIT.FENCE, "Unsupported verdict schema");
  }
  if (!["PASS", "PARTIAL", "FAIL", "BLOCKED"].includes(verdict.verdict)) {
    throw new HarnessError(EXIT.FENCE, "Invalid verdict value");
  }
  if (!Array.isArray(verdict.rerunLogs)) {
    throw new HarnessError(EXIT.FENCE, "Verdict rerunLogs must be an array");
  }
}
