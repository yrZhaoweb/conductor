import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeGitRepo, run, runHarness, stageFile } from "./helpers.js";

describe("bypass: red-line commit", () => {
  it("rejects committing a migration even when the task wording sounds harmless", () => {
    const { repo, runRoot } = makeGitRepo();
    const installed = runHarness(["redlines", "install-hook", "--repo", repo, "--run-root", runRoot]);
    assert.equal(installed.status, 0, installed.stderr);
    stageFile(repo, "db/migrations/001.sql", "-- tidy up the data layer\n");

    const commit = run("git", ["commit", "-m", "tidy up data layer"], repo);

    assert.notEqual(commit.status, 0);
    assert.match(commit.stderr, /red-line/i);
    assert.match(commit.stderr, /db\/migrations\/001\.sql/);
  });
});
