import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  commitInWorktree,
  makeGitRepo,
  metadata,
  runHarness,
  writeTask
} from "./helpers.js";

describe("bypass: worker worktree conflict", () => {
  it("does not let two conflicting worker branches merge cleanly", () => {
    const { repo, runRoot } = makeGitRepo();
    const taskA = writeTask(runRoot, "P1-A", ["src/shared.txt"]);
    const taskB = writeTask(runRoot, "P1-B", ["src/shared.txt"]);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskA]).status, 0);
    assert.equal(runHarness(["worker", "start", "--run-root", runRoot, "--repo", repo, "--task", taskB]).status, 0);
    commitInWorktree(metadata(runRoot, "P1-A").worktreePath, "src/shared.txt", "worker a\n");
    commitInWorktree(metadata(runRoot, "P1-B").worktreePath, "src/shared.txt", "worker b\n");

    const first = runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-A"]);
    const second = runHarness(["worker", "merge", "--run-root", runRoot, "--repo", repo, "--task", "P1-B"]);

    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 60);
    assert.match(second.stderr, /merge/i);
  });
});
