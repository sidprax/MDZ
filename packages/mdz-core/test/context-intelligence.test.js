import test from "node:test";
import assert from "node:assert/strict";
import { checkSufficiency, createCompressionPlan, extractEvidence, profileContext } from "../src/index.js";

const sample = [
  "user: Fix the failing auth test.",
  "tool output:",
  "FAIL auth validates expired token",
  "AssertionError: Expected status 401, received 200",
  "src/auth/session.ts line=42",
  "npm test -- auth",
  "decision: token expiry comparison is using local time"
].join("\n");

test("profileContext classifies important segments", () => {
  const profile = profileContext(sample);

  assert.ok(profile.totals.tokens > 0);
  assert.ok(profile.segments.some((segment) => segment.kind === "user_intent"));
  assert.ok(profile.importance.high >= 1);
});

test("extractEvidence keeps failures, files, commands, and decisions", () => {
  const evidence = extractEvidence(sample);

  assert.ok(evidence.totalEvidence > 0);
  assert.ok(evidence.byType.failure >= 1);
  assert.ok(evidence.byType["file-path"] >= 1);
  assert.ok(evidence.requiredMarkers.some((marker) => marker.includes("FAIL auth")));
});

test("createCompressionPlan proposes policy-aware actions", () => {
  const plan = createCompressionPlan(sample.repeat(80), { mode: "suggest" });

  assert.equal(plan.mode, "suggest");
  assert.ok(plan.summary.originalTokens > 0);
  assert.ok(["ask", "skip", "apply"].includes(plan.recommendation));
  assert.ok(plan.actions.length > 0);
});

test("checkSufficiency reports missing evidence", () => {
  const report = checkSufficiency(sample, "reduced summary", { minCoverage: 0.8 });

  assert.equal(report.sufficient, false);
  assert.equal(report.riskLevel, "high");
  assert.ok(report.missingMarkers.length > 0);
});
