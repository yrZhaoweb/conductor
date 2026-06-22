import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist/src/cli.js");
const fixturesDir = path.join(repoRoot, "test/fixtures");

type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runHarness(args: string[], cwd = repoRoot): RunResult {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function makeRepo(): { repo: string; runRoot: string } {
  const repo = mkdtempSync(path.join(tmpdir(), "conductor-m1-"));
  const runRoot = path.join(repo, ".conductor/runs/test-run");
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, "goal.md"), "# Goal\n\nDo the thing.\n");
  writeFileSync(path.join(runRoot, "plan.md"), [
    "# Plan",
    "",
    "## Batch 0 Acceptance Criteria",
    "- C1: command evidence passes",
    "",
    "## Batch 1 Acceptance Criteria",
    "- C1: command evidence passes",
    ""
  ].join("\n"));
  mkdirSync(path.join(runRoot, "reports"), { recursive: true });
  writeFileSync(path.join(runRoot, "reports/P1-IMPL-01.md"), "implementer says pass\n");
  return { repo, runRoot };
}

function initRun(runRoot: string, repo: string): void {
  const init = runHarness(["init", "--run-root", runRoot, "--repo", repo, "--mode", "auto"]);
  assert.equal(init.status, 0, init.stderr);
}

describe("M1 fence gate and independent acceptance", () => {
  let repo: string;
  let runRoot: string;

  beforeEach(() => {
    ({ repo, runRoot } = makeRepo());
  });

  it("starts batch 0 without a prior verdict", () => {
    initRun(runRoot, repo);

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "0"]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(path.join(runRoot, "batches/0/state.json")));
  });

  it("blocks batch 1 when batch 0 has no verdict", () => {
    initRun(runRoot, repo);

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /verdict/i);
  });

  it("blocks unsigned forged PASS verdicts", () => {
    initRun(runRoot, repo);
    const batchDir = path.join(runRoot, "batches/0");
    mkdirSync(batchDir, { recursive: true });
    writeFileSync(path.join(batchDir, "verdict.json"), JSON.stringify({
      schemaVersion: 1,
      runRoot,
      batch: 0,
      taskId: "P0-ACC-01",
      verdict: "PASS",
      createdAt: new Date().toISOString(),
      criteria: [],
      rerunLogs: [],
      runtime: { kind: "command", exitCode: 0, outputPath: "fake" }
    }, null, 2));

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /signature/i);
  });

  it("writes signed PASS verdicts from acceptance rerun evidence", () => {
    initRun(runRoot, repo);

    const result = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--rerun", `${process.execPath} -e "console.log('ok')"`,
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-pass.cjs")}`
    ]);

    assert.equal(result.status, 0, result.stderr);
    const verdictPath = path.join(runRoot, "batches/0/verdict.json");
    const verdict = JSON.parse(readFileSync(verdictPath, "utf8"));
    assert.equal(verdict.verdict, "PASS");
    assert.equal(verdict.signature.algorithm, "ed25519");
    assert.equal(verdict.rerunLogs[0].id, "R1");
    assert.ok(existsSync(path.join(runRoot, verdict.rerunLogs[0].path)));

    const next = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);
    assert.equal(next.status, 0, next.stderr);
  });

  it("rejects PASS acceptance output without rerun evidence", () => {
    initRun(runRoot, repo);

    const result = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-no-rerun.cjs")}`
    ]);

    assert.equal(result.status, 40);
    assert.match(result.stderr, /rerun/i);
  });

  it("rejects implementer report references as acceptance evidence", () => {
    initRun(runRoot, repo);

    const result = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--rerun", `${process.execPath} -e "console.log('ok')"`,
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-uses-report.cjs")}`
    ]);

    assert.equal(result.status, 40);
    assert.match(result.stderr, /evidence/i);
  });

  it("does not copy implementer reports into acceptance context", () => {
    initRun(runRoot, repo);

    const result = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--rerun", `${process.execPath} -e "console.log('ok')"`,
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-pass.cjs")}`
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(path.join(runRoot, "batches/0/acceptance/context/goal.md")));
    assert.ok(existsSync(path.join(runRoot, "batches/0/acceptance/context/batch-criteria.md")));
    assert.equal(existsSync(path.join(runRoot, "batches/0/acceptance/context/reports/P1-IMPL-01.md")), false);
  });

  it("fails batch check after rerun log tampering", () => {
    initRun(runRoot, repo);
    const accepted = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--rerun", `${process.execPath} -e "console.log('ok')"`,
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-pass.cjs")}`
    ]);
    assert.equal(accepted.status, 0, accepted.stderr);
    writeFileSync(path.join(runRoot, "batches/0/acceptance/reruns/R1.log"), "tampered\n");

    const result = runHarness(["batch", "check", "--run-root", runRoot, "--batch", "0"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /hash/i);
  });

  it("fails batch check after verdict tampering", () => {
    initRun(runRoot, repo);
    const accepted = runHarness([
      "accept", "run",
      "--run-root", runRoot,
      "--repo", repo,
      "--batch", "0",
      "--task", "P0-ACC-01",
      "--criteria", "Batch 0 Acceptance Criteria",
      "--rerun", `${process.execPath} -e "console.log('ok')"`,
      "--runtime", "command",
      "--runtime-command", `${process.execPath} ${path.join(fixturesDir, "acceptance-pass.cjs")}`
    ]);
    assert.equal(accepted.status, 0, accepted.stderr);
    const verdictPath = path.join(runRoot, "batches/0/verdict.json");
    const verdict = JSON.parse(readFileSync(verdictPath, "utf8"));
    verdict.taskId = "P0-ACC-TAMPERED";
    writeFileSync(verdictPath, JSON.stringify(verdict, null, 2));

    const result = runHarness(["batch", "check", "--run-root", runRoot, "--batch", "0"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /signature/i);
  });
});
