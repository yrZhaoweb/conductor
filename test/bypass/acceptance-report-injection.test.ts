import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fixturesDir, makeRunRoot, runHarness } from "./helpers.js";

describe("bypass: acceptance report injection", () => {
  it("rejects acceptance that cites implementer-report conclusions instead of rerun logs", () => {
    const { repo, runRoot } = makeRunRoot();

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
    assert.equal(
      existsSync(path.join(runRoot, "batches/0/acceptance/context/reports/P1-IMPL-01.md")),
      false
    );
  });
});
