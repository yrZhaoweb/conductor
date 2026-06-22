import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeRunRoot, runHarness } from "./helpers.js";

describe("bypass: skip fence", () => {
  it("refuses to start batch N+1 before batch N has a signed PASS verdict", () => {
    const { runRoot } = makeRunRoot();

    const result = runHarness(["batch", "start", "--run-root", runRoot, "--batch", "1"]);

    assert.equal(result.status, 20);
    assert.match(result.stderr, /verdict/i);
  });
});
