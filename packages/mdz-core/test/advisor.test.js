import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { createAdvisorReport, decideAdvisorAction, renderAdvisorReport, writeAdvisorReports } from "../src/index.js";

const recommendation = {
  recommendation: "use",
  totalTokens: 10000,
  estimatedSavedTokens: 4500,
  estimatedPercentSaved: 0.45,
  reason: "Use MDZ: estimated savings are high with acceptable risk.",
  downsides: {
    addedLocalLatencyMs: 12,
    localCpuWork: "low",
    localDiskBytes: 2048,
    qualityRisk: "low",
    privacyCacheSensitivity: "stores-original-locally",
    userApprovalPrompts: 0
  },
  topOpportunities: [{
    type: "tool-output-handle",
    estimatedSavedTokens: 3000,
    riskLevel: "low",
    reason: "Large tool output can be stored behind a handle."
  }]
};

test("decideAdvisorAction follows policy profiles", () => {
  assert.equal(decideAdvisorAction(recommendation, "observe"), "observe");
  assert.equal(decideAdvisorAction(recommendation, "suggest"), "ask");
  assert.equal(decideAdvisorAction(recommendation, "safe"), "apply");
});

test("createAdvisorReport renders user-friendly action and choices", () => {
  const report = createAdvisorReport(recommendation, { mode: "suggest" });
  const rendered = renderAdvisorReport(report);

  assert.equal(report.action, "ask");
  assert.match(rendered, /MDZ recommends: ask/);
  assert.match(rendered, /Expected savings: 45%/);
  assert.ok(report.suggestedChoices.includes("Apply once"));
});

test("writeAdvisorReports writes JSON and markdown reports", async () => {
  const dir = ".mdz/test-reports";
  await rm(dir, { recursive: true, force: true });
  const report = createAdvisorReport(recommendation, { mode: "safe" });
  const files = await writeAdvisorReports(report, { dir, baseName: "advisor-test" });

  const json = JSON.parse(await readFile(files.jsonPath, "utf8"));
  const markdown = await readFile(files.mdPath, "utf8");

  assert.equal(json.action, "apply");
  assert.match(markdown, /MDZ recommends: apply/);
});
