import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const implementedHarnessClaims = [
  {
    label: "Fence and verdict signature validation",
    commands: ["conductor-harness init", "conductor-harness batch start", "conductor-harness batch check", "conductor-harness accept run"],
    sources: ["src/commands/batch.ts", "src/commands/accept.ts", "src/core/verdict.ts", "src/core/signatures.ts"],
    tests: ["test/m1-fence-acceptance.test.ts", "test/bypass/direct-verdict-forgery.test.ts", "test/bypass/insider-self-sign.test.ts"]
  },
  {
    label: "Red-line pre-commit hook",
    commands: ["conductor-harness redlines install-hook", "conductor-harness redlines check", "conductor-harness redlines override mint"],
    sources: ["src/commands/redlines.ts", "src/core/glob.ts"],
    tests: ["test/m2-redlines-hook.test.ts", "test/bypass/redline-commit.test.ts"]
  },
  {
    label: "Worktree isolation",
    commands: ["conductor-harness worker start", "conductor-harness worker merge", "conductor-harness worker check-paths"],
    sources: ["src/commands/worker.ts", "src/core/git.ts"],
    tests: ["test/m3-worktrees.test.ts", "test/bypass/worktree-conflict.test.ts"]
  },
  {
    label: "Docs contract guard",
    commands: [],
    sources: ["test/m4-docs-contract.test.ts"],
    tests: ["test/m4-docs-contract.test.ts"]
  }
];

describe("M4 documentation handoff", () => {
  it("updates SKILL.md Manager Loop to call the harness and follow exit codes", () => {
    const skill = read("SKILL.md");
    const managerLoop = skill.slice(skill.indexOf("## Manager Loop"), skill.indexOf("## Output Shape"));

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

  it("keeps harness-enforced README and SKILL claims tied to source commands and tests", () => {
    const readme = read("README.md");
    const skill = read("SKILL.md");
    const cli = read("src/cli.ts");
    const docs = [readme, skill];

    for (const claim of implementedHarnessClaims) {
      for (const doc of docs) {
        assert.match(doc, new RegExp(escapeRegExp(claim.label)), claim.label);
        for (const command of claim.commands) {
          assert.match(doc, new RegExp(escapeRegExp(command)), `${claim.label} missing ${command}`);
        }
        for (const testPath of claim.tests) {
          assert.match(doc, new RegExp(escapeRegExp(testPath)), `${claim.label} missing ${testPath}`);
        }
      }
      for (const command of claim.commands) {
        assertCommandDispatches(cli, command);
      }
      for (const sourcePath of claim.sources) {
        assert.equal(existsSync(path.join(repoRoot, sourcePath)), true, `${sourcePath} must exist`);
      }
      for (const testPath of claim.tests) {
        assert.equal(existsSync(path.join(repoRoot, testPath)), true, `${testPath} must exist`);
      }
    }

    assert.match(readme, /semantic, enforced by model\/human not harness/);
    assert.match(skill, /semantic, enforced by model\/human not harness/);
  });

  it("keeps SKILL concise and expands every quick-reference rule in references", () => {
    const skill = read("SKILL.md");
    const details = read("references/contract-details.md");
    const skillLines = skill.trimEnd().split(/\r?\n/);
    const quickReference = skill.slice(
      skill.indexOf("## Contract Quick Reference"),
      skill.indexOf("## When to Use")
    );
    const quickRuleLabels = [...quickReference.matchAll(/^- \*\*(.+?)\*\*/gm)]
      .map((match) => normalizeRuleLabel(match[1]));
    const detailRuleLabels = [...details.matchAll(/^## (.+)$/gm)]
      .map((match) => normalizeRuleLabel(match[1]));

    assert.ok(skillLines.length <= 250, `SKILL.md has ${skillLines.length} lines`);
    assert.match(skill, /references\/contract-details\.md/);
    assert.ok(quickRuleLabels.length > 0, "Quick Reference must list hard rules");
    for (const label of quickRuleLabels) {
      assert.ok(detailRuleLabels.includes(label), `Missing reference expansion for ${label}`);
    }
    for (const label of detailRuleLabels) {
      assert.ok(quickRuleLabels.includes(label), `Reference introduces a top-level rule outside Quick Reference: ${label}`);
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertCommandDispatches(cli: string, command: string): void {
  const parts = command.replace(/^conductor-harness\s+/, "").split(/\s+/);
  assert.match(cli, new RegExp(`command === "${escapeRegExp(parts[0])}"`), `${command} missing primary dispatch`);
  if (parts[1]) {
    assert.match(cli, new RegExp(`subcommand === "${escapeRegExp(parts[1])}"`), `${command} missing subcommand dispatch`);
  }
  if (parts[2]) {
    assert.match(cli, new RegExp(`args\\.positionals\\[2\\] === "${escapeRegExp(parts[2])}"`), `${command} missing tertiary dispatch`);
  }
}

function normalizeRuleLabel(label: string): string {
  return label.toLowerCase().replace(/\s*\(.+?\)\s*/g, "").replace(/\s+/g, " ").trim();
}
