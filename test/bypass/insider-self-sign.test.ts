import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sign as cryptoSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { makeRunRoot, runHarness } from "./helpers.js";
import { sha256, stableStringify } from "../../src/core/signatures.js";

describe("bypass: insider self-sign", () => {
  it("does not expose a run-root private key an insider can use to self-sign PASS", () => {
    const { runRoot } = makeRunRoot();
    const publicPath = path.join(runRoot, ".harness", "acceptance-public-key.pem");
    const legacyPrivatePath = path.join(runRoot, ".harness", "acceptance-private-key.pem");
    const exposedPrivateKey = existsSync(legacyPrivatePath);
    const batchDir = path.join(runRoot, "batches/0");
    const rerunDir = path.join(batchDir, "acceptance/reruns");
    const rerunLog = [
      "Command: insider-forged",
      `Cwd: ${runRoot}`,
      "ExitCode: 0",
      "",
      "STDOUT:",
      "ok",
      "",
      "STDERR:",
      ""
    ].join("\n");
    mkdirSync(rerunDir, { recursive: true });
    writeFileSync(path.join(rerunDir, "R1.log"), rerunLog);
    writeFileSync(path.join(rerunDir, "R1.json"), "{}\n");

    const payload = {
      schemaVersion: 1,
      runRoot,
      batch: 0,
      taskId: "P0-ACC-INSIDER",
      verdict: "PASS",
      createdAt: new Date().toISOString(),
      criteria: [{ id: "C1", status: "pass", evidenceRefs: ["R1"] }],
      rerunLogs: [{
        id: "R1",
        path: "batches/0/acceptance/reruns/R1.log",
        metadataPath: "batches/0/acceptance/reruns/R1.json",
        sha256: sha256(rerunLog),
        command: "insider-forged",
        exitCode: 0
      }],
      runtime: { kind: "insider", exitCode: 0, outputPath: "batches/0/acceptance/runtime-final.md" }
    };
    const publicPem = readFileSync(publicPath, "utf8");
    const signature = exposedPrivateKey
      ? cryptoSign(null, Buffer.from(stableStringify(payload)), readFileSync(legacyPrivatePath, "utf8")).toString("base64")
      : "not-a-valid-signature";
    writeFileSync(path.join(batchDir, "verdict.json"), JSON.stringify({
      ...payload,
      signature: {
        algorithm: "ed25519",
        keyId: sha256(publicPem),
        value: signature
      }
    }, null, 2));

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(
      result.status,
      20,
      "an insider with only RUN_ROOT contents must not be able to self-sign a PASS verdict"
    );
    assert.equal(exposedPrivateKey, false, "RUN_ROOT must contain only the public acceptance key");
    assert.match(result.stderr, /signature/i);
  });
});
