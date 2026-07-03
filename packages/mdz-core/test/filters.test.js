import test from "node:test";
import assert from "node:assert/strict";
import { filterLogOutput, filterTestOutput } from "../src/index.js";

test("filterTestOutput keeps failure context and collapses passing noise", () => {
  const output = [
    ...Array.from({ length: 80 }, (_, index) => `PASS test_${index}`),
    "FAIL auth validates expired token",
    "AssertionError: Expected 200 Received 401",
    "at auth.test.js:42",
    ...Array.from({ length: 80 }, (_, index) => `PASS later_${index}`)
  ].join("\n");

  const result = filterTestOutput(output);

  assert.equal(result.kind, "test");
  assert.equal(result.riskLevel, "low");
  assert.match(result.reduced, /FAIL auth/);
  assert.match(result.reduced, /AssertionError/);
  assert.ok(result.metrics.savedTokens > 0);
  assert.ok(result.metrics.estimatedLatencyMs >= 1);
});

test("filterLogOutput keeps important log windows and repeated signatures", () => {
  const repeated = "2026-06-16T10:00:00Z INFO request ok user=123";
  const output = [
    ...Array.from({ length: 20 }, () => repeated),
    "2026-06-16T10:01:00Z ERROR database timeout on /login",
    "Error: connection refused",
    "at db.js:10",
    ...Array.from({ length: 20 }, () => repeated)
  ].join("\n");

  const result = filterLogOutput(output);

  assert.equal(result.kind, "log");
  assert.equal(result.riskLevel, "low");
  assert.match(result.reduced, /database timeout/);
  assert.match(result.reduced, /Repeated signatures/);
  assert.ok(result.metrics.savedTokens > 0);
});
