import test from "node:test";
import assert from "node:assert/strict";
import { estimateSavings, estimateTokens } from "../src/index.js";

test("estimateTokens returns a nonzero estimate for normal text", () => {
  const result = estimateTokens("Run the failing tests and fix the auth bug.");

  assert.equal(result.method, "heuristic-v1");
  assert.equal(result.confidence, "medium");
  assert.ok(result.tokens > 0);
  assert.ok(result.chars > 0);
});

test("estimateSavings reports reduced token usage", () => {
  const result = estimateSavings("error ".repeat(100), "error x100");

  assert.ok(result.originalTokens > result.reducedTokens);
  assert.ok(result.savedTokens > 0);
  assert.ok(result.percentSaved > 0);
});
