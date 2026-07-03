import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSession, createUsageReport } from "../src/index.js";

test("analyzeSession finds large-block optimization opportunities", () => {
  const session = [
    "user: Please inspect this output.",
    "tool output:",
    "ERROR auth failure\n".repeat(1200),
    "assistant: The auth service is failing."
  ].join("\n");

  const analysis = analyzeSession(session);

  assert.ok(analysis.totalTokens > 0);
  assert.ok(analysis.opportunities.length > 0);
  assert.ok(analysis.expected.savedTokens > 0);
  assert.ok(analysis.expected.addedLatencyMs > 0);
  assert.ok(analysis.expected.localDiskBytes > 0);
});

test("createUsageReport includes downside estimates", () => {
  const report = createUsageReport(
    {
      metrics: {
        originalTokens: 1000,
        reducedTokens: 400,
        savedTokens: 600,
        estimatedLatencyMs: 12,
        estimatedDiskBytes: 2048,
        estimatedCpuWork: "low"
      },
      riskLevel: "low"
    },
    { mode: "safe" }
  );

  assert.equal(report.mode, "safe");
  assert.equal(report.totals.savedTokens, 600);
  assert.equal(report.downsides.addedLatencyMs, 12);
  assert.equal(report.downsides.localDiskBytes, 2048);
  assert.equal(report.downsides.qualityRisk, "low");
});
