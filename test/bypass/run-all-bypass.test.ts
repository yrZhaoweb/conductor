import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("bypass suite manifest", () => {
  it("is intentionally run through npm run test:bypass", () => {
    assert.equal(process.env.npm_lifecycle_event, "test:bypass");
  });
});
