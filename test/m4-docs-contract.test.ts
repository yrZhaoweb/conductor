import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("M4 documentation handoff", () => {
  it("updates SKILL.md Manager Loop to call the harness and follow exit codes", () => {
    const skill = read("SKILL.md");
    const managerLoop = skill.slice(skill.indexOf("## Manager Loop"), skill.indexOf("## Templates"));

    assert.match(managerLoop, /conductor-harness/);
    assert.match(managerLoop, /exit codes?/i);
    assert.match(managerLoop, /signed verdicts?/i);
    assert.match(managerLoop, /rerun logs?/i);
    assert.match(managerLoop, /git hooks?/i);
    assert.match(managerLoop, /git merges?/i);
    assert.match(managerLoop, /semantic/i);
  });

  it("keeps the core Conductor rationale intact", () => {
    const skill = read("SKILL.md");

    assert.match(skill, /Separate the writer from the judge/);
    assert.match(skill, /Keep tasks small and push state to disk/);
    assert.match(skill, /Do only the certain; stop at the uncertain/);
    assert.match(skill, /Acceptance independence/);
    assert.match(skill, /Red lines/);
  });

  it("documents real harness usage in README and templates", () => {
    const readme = read("README.md");
    const templates = read("references/templates.md");
    const evals = read("evals/README.md");

    assert.match(readme, /npm run build/);
    assert.match(readme, /conductor-harness init/);
    assert.match(readme, /conductor-harness accept run/);
    assert.match(templates, /verdict\.json/);
    assert.match(templates, /signed/i);
    assert.match(templates, /Task Card JSON/);
    assert.match(evals, /npm run test:bypass/);
  });

  it("adds usage and threat-model docs", () => {
    assert.equal(existsSync(path.join(repoRoot, "docs/harness-usage.md")), true);
    assert.equal(existsSync(path.join(repoRoot, "docs/harness-threat-model.md")), true);
  });
});
