import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("bypass suite manifest", () => {
  it("is intentionally wired into npm run test:bypass", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    const script = packageJson.scripts?.["test:bypass"] ?? "";
    assert.match(script, /node --test dist\/test\/bypass\/\*\.test\.js/);
    assert.match(packageJson.scripts?.test ?? "", /npm run test:bypass/);
  });
});
