import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { EXIT, HarnessError } from "../core/errors.js";
import { buildAcceptanceContext } from "../core/acceptance-context.js";
import { runReruns, RerunLog } from "../core/evidence.js";
import { writeJsonFile } from "../core/json.js";
import { safeJoin, toRunRelative } from "../core/paths.js";
import { CriterionResult, writeSignedVerdict } from "../core/verdict.js";

type AcceptanceOutput = {
  schemaVersion: 1;
  taskId: string;
  batch: number;
  judgment: "PASS" | "PARTIAL" | "FAIL" | "BLOCKED";
  criteria: CriterionResult[];
  rerunRefs: string[];
  gaps: string[];
  residuals: string[];
  notes: string;
};

export type AcceptOptions = {
  runRoot: string;
  repo: string;
  batch: number;
  taskId: string;
  criteria: string;
  reruns: string[];
  runtime: string;
  runtimeCommand?: string;
};

export function acceptRun(options: AcceptOptions): void {
  const acceptanceDir = safeJoin(options.runRoot, "batches", String(options.batch), "acceptance");
  mkdirSync(acceptanceDir, { recursive: true });
  const rerunLogs = runReruns(options.runRoot, options.repo, options.batch, options.reruns);
  const { contextDir, promptPath } = buildAcceptanceContext(
    options.runRoot,
    options.batch,
    options.criteria,
    rerunLogs
  );
  const runtime = runAcceptanceRuntime(options, contextDir, promptPath);
  writeJsonFile(safeJoin(options.runRoot, "batches", String(options.batch), "acceptance", "runtime-output.json"), runtime.raw);
  const output = parseAcceptanceOutput(runtime.stdout);
  validateAcceptanceOutput(output, options, rerunLogs);
  writeSignedVerdict(options.runRoot, options.batch, {
    schemaVersion: 1,
    runRoot: options.runRoot,
    batch: options.batch,
    taskId: options.taskId,
    verdict: output.judgment,
    createdAt: new Date().toISOString(),
    criteria: output.criteria,
    rerunLogs: rerunLogs.map((rerun) => ({
      id: rerun.id,
      path: rerun.path,
      metadataPath: rerun.metadataPath,
      sha256: rerun.sha256,
      command: rerun.command,
      exitCode: rerun.exitCode
    })),
    runtime: {
      kind: options.runtime,
      exitCode: runtime.exitCode,
      outputPath: toRunRelative(
        options.runRoot,
        safeJoin(options.runRoot, "batches", String(options.batch), "acceptance", "runtime-final.md")
      )
    }
  });
}

function runAcceptanceRuntime(
  options: AcceptOptions,
  contextDir: string,
  promptPath: string
): { stdout: string; exitCode: number | null; raw: unknown } {
  if (options.runtime === "command") {
    if (!options.runtimeCommand) {
      throw new HarnessError(EXIT.USAGE, "--runtime-command is required for command runtime");
    }
    const result = spawnSync(options.runtimeCommand, {
      cwd: contextDir,
      encoding: "utf8",
      shell: true,
      env: {
        ...process.env,
        CONDUCTOR_ACCEPTANCE_TASK_ID: options.taskId,
        CONDUCTOR_ACCEPTANCE_BATCH: String(options.batch)
      }
    });
    const outputPath = safeJoin(options.runRoot, "batches", String(options.batch), "acceptance", "runtime-final.md");
    writeJsonFile(outputPath, safeJsonOrText(result.stdout));
    if (result.status !== 0) {
      throw new HarnessError(EXIT.RUNTIME, `Acceptance runtime failed: ${result.stderr || result.stdout}`);
    }
    return {
      stdout: result.stdout,
      exitCode: result.status,
      raw: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status
      }
    };
  }

  if (options.runtime === "codex") {
    const outputPath = safeJoin(options.runRoot, "batches", String(options.batch), "acceptance", "runtime-final.md");
    const prompt = readFileSync(promptPath, "utf8");
    const result = spawnSync("codex", [
      "-a", "never",
      "exec",
      "-s", "read-only",
      "-C", contextDir,
      "--ephemeral",
      "-o", outputPath,
      prompt
    ], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new HarnessError(EXIT.RUNTIME, `Codex acceptance failed: ${result.stderr || result.stdout}`);
    }
    return {
      stdout: readFileSync(outputPath, "utf8"),
      exitCode: result.status,
      raw: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status
      }
    };
  }

  throw new HarnessError(EXIT.USAGE, `Unsupported runtime: ${options.runtime}`);
}

function parseAcceptanceOutput(stdout: string): AcceptanceOutput {
  try {
    return JSON.parse(stdout) as AcceptanceOutput;
  } catch {
    throw new HarnessError(EXIT.ACCEPTANCE, "Acceptance runtime did not return valid JSON");
  }
}

function validateAcceptanceOutput(output: AcceptanceOutput, options: AcceptOptions, reruns: RerunLog[]): void {
  if (output.schemaVersion !== 1) {
    throw new HarnessError(EXIT.ACCEPTANCE, "Unsupported acceptance schema");
  }
  if (output.taskId !== options.taskId || output.batch !== options.batch) {
    throw new HarnessError(EXIT.ACCEPTANCE, "Acceptance output target mismatch");
  }
  if (!["PASS", "PARTIAL", "FAIL", "BLOCKED"].includes(output.judgment)) {
    throw new HarnessError(EXIT.ACCEPTANCE, "Invalid acceptance judgment");
  }
  const validRerunIds = new Set(reruns.map((rerun) => rerun.id));
  if (output.judgment === "PASS" && output.rerunRefs.length === 0) {
    throw new HarnessError(EXIT.ACCEPTANCE, "PASS requires at least one rerun reference");
  }
  for (const ref of output.rerunRefs) {
    if (!validRerunIds.has(ref)) {
      throw new HarnessError(EXIT.ACCEPTANCE, `Invalid rerun evidence reference: ${ref}`);
    }
  }
  for (const criterion of output.criteria) {
    for (const ref of criterion.evidenceRefs) {
      if (!validRerunIds.has(ref)) {
        throw new HarnessError(EXIT.ACCEPTANCE, `Invalid criterion evidence reference: ${ref}`);
      }
    }
  }
}

function safeJsonOrText(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    return { text: stdout };
  }
}
