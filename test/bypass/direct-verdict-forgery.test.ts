import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { acceptBatch, makeRunRoot, runHarness } from "./helpers.js";

describe("bypass: direct verdict forgery", () => {
  it("rejects an unsigned hand-written PASS verdict", () => {
    const { runRoot } = makeRunRoot();
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
      runtime: { kind: "forged", exitCode: 0, outputPath: "none" }
    }, null, 2));

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /signature/i);
  });

  it("rejects a signed-looking verdict with a bad signature", () => {
    const { runRoot } = makeRunRoot();
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
      runtime: { kind: "forged", exitCode: 0, outputPath: "none" },
      signature: { algorithm: "ed25519", keyId: "wrong", value: "bad" }
    }, null, 2));

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /signature/i);
  });

  it("rejects a valid verdict after rerun evidence is tampered", () => {
    const { repo, runRoot } = makeRunRoot();
    acceptBatch(repo, runRoot);
    writeFileSync(path.join(runRoot, "batches/0/acceptance/reruns/R1.log"), "tampered\n");

    const result = runHarness(["batch", "check", "--run-root", runRoot, "--batch", "0"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /hash/i);
  });

  it("rejects a valid verdict after its payload is edited", () => {
    const { repo, runRoot } = makeRunRoot();
    acceptBatch(repo, runRoot);
    const verdictPath = path.join(runRoot, "batches/0/verdict.json");
    const verdict = JSON.parse(readFileSync(verdictPath, "utf8"));
    verdict.taskId = "FORGED-AFTER-SIGN";
    writeFileSync(verdictPath, JSON.stringify(verdict, null, 2));

    const result = runHarness(["batch", "check", "--run-root", runRoot, "--batch", "0"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /signature/i);
  });
});
