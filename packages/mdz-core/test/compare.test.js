import test from "node:test";
import assert from "node:assert/strict";
import { compareContext, renderCompareReport } from "../src/index.js";

test("compareContext passes when important markers are retained", () => {
  const original = [
    "PASS one",
    "FAIL auth validates expired token",
    "AssertionError: Expected status 401, received 200"
  ].join("\n");
  const reduced = [
    "MDZ reduced output",
    "FAIL auth validates expired token",
    "AssertionError: Expected status 401, received 200"
  ].join("\n");
  const report = compareContext(original, reduced, {
    markers: ["FAIL auth validates expired token"]
  });

  assert.equal(report.passed, true);
  assert.equal(report.riskLevel, "low");
  assert.ok(report.tokens.saved >= 0);
  assert.match(renderCompareReport(report), /MDZ Context Comparison/);
});

test("compareContext flags missing markers", () => {
  const report = compareContext("ERROR database timeout", "MDZ summary", {
    markers: ["ERROR database timeout"]
  });

  assert.equal(report.passed, false);
  assert.equal(report.riskLevel, "high");
  assert.deepEqual(report.markers.missing, ["ERROR database timeout"]);
});
