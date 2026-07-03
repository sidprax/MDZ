import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createLedgerReport, createSavingsDigest, readLedger, recordLedgerEvent, renderLedgerReport, renderSavingsDigest, writeLedgerReport, writeSavingsDigest } from "../src/index.js";

test("ledger records events and summarizes savings", async () => {
  const dir = ".mdz/test-ledger";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await recordLedgerEvent({
    type: "tool-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 1000, reduced: 250 },
    savings: { estimatedSavedTokens: 750, estimatedPercentSaved: 0.75 },
    downsides: { addedLocalLatencyMs: 2, localDiskBytes: 500, qualityRisk: "low" }
  }, { file });

  const ledger = await readLedger({ file });
  const report = await createLedgerReport({ file });
  const written = await writeLedgerReport(report, { dir, baseName: "usage-test" });

  assert.equal(ledger.entries.length, 1);
  assert.equal(report.totals.savedTokens, 750);
  assert.equal(report.totals.byAction.apply, 1);
  assert.equal(report.totals.byTokenClass.inputContext.savedTokens, 750);
  assert.equal(report.totals.byTokenClass.assistantOutput.savedTokens, 0);
  assert.equal(report.topSavingsExamples.length, 1);
  assert.equal(report.topSavingsExamples[0].actualSavedTokens, 750);
  assert.ok(report.savingsAttribution.length >= 1);
  assert.match(renderLedgerReport(report), /MDZ Usage Report/);
  assert.match(renderLedgerReport(report), /Input\/context:/);
  assert.match(renderLedgerReport(report), /Assistant output:/);
  assert.match(renderLedgerReport(report), /How Tokens Were Saved/);
  assert.match(renderLedgerReport(report), /Savings Attribution/);
  assert.match(written.mdPath, /usage-test\.md$/);
  assert.match(written.htmlPath, /usage-test\.html$/);
});

test("ledger reports assistant output savings separately", async () => {
  const dir = ".mdz/test-ledger-output";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await recordLedgerEvent({
    type: "prompt",
    mode: "safe",
    action: "apply",
    tokens: { original: 1000, reduced: 700 },
    savings: { estimatedSavedTokens: 300, estimatedPercentSaved: 0.3 },
    downsides: { qualityRisk: "low" }
  }, { file });
  await recordLedgerEvent({
    type: "assistant-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 500, reduced: 200 },
    savings: { estimatedSavedTokens: 300, estimatedPercentSaved: 0.6 },
    downsides: { qualityRisk: "low" }
  }, { file });

  const report = await createLedgerReport({ file });

  assert.equal(report.totals.savedTokens, 600);
  assert.equal(report.totals.byTokenClass.inputContext.savedTokens, 300);
  assert.equal(report.totals.byTokenClass.assistantOutput.savedTokens, 300);
  assert.match(renderLedgerReport(report), /Assistant output: 1 events, 500 original, 300 actual saved, 300 potential/);
});

test("ledger ranks privacy-safe savings examples by actual then potential savings", async () => {
  const dir = ".mdz/test-ledger-examples";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await recordLedgerEvent({
    type: "tool-output",
    mode: "observe",
    action: "observe",
    tokens: { original: 2000, reduced: 2000 },
    savings: { estimatedSavedTokens: 1200, estimatedPercentSaved: 0.6 },
    downsides: { qualityRisk: "low" },
    example: {
      technique: "test-output-filtering",
      summary: "Collapsed repeated passing-test lines while retaining the failure window.",
      before: "420 lines / 2,000 tokens",
      after: "Observed only"
    }
  }, { file });
  await recordLedgerEvent({
    type: "assistant-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 800, reduced: 300 },
    savings: { estimatedSavedTokens: 500, estimatedPercentSaved: 0.625 },
    downsides: { qualityRisk: "low" },
    notes: ["Compressed assistant response before sending."]
  }, { file });

  const report = await createLedgerReport({ file, exampleLimit: 5 });

  assert.equal(report.topSavingsExamples[0].technique, "assistant-output-compression");
  assert.equal(report.topSavingsExamples[0].actualSavedTokens, 500);
  assert.equal(report.topSavingsExamples[1].potentialSavedTokens, 1200);
  assert.doesNotMatch(JSON.stringify(report.topSavingsExamples), /secret|raw prompt/i);
});

test("savings digest summarizes recent savings and writes reports", async () => {
  const dir = ".mdz/test-digest";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await recordLedgerEvent({
    type: "test-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 1000, reduced: 200 },
    savings: { estimatedSavedTokens: 800, estimatedPercentSaved: 0.8 },
    downsides: { qualityRisk: "low" }
  }, { file });

  const digest = await createSavingsDigest({ ledgerFile: file, visibilityLevel: "digest" });
  const written = await writeSavingsDigest(digest, { dir, baseName: "digest-test" });

  assert.equal(digest.shouldNotify, true);
  assert.match(renderSavingsDigest(digest), /MDZ Savings Digest/);
  assert.match(written.mdPath, /digest-test\.md$/);
});

test("ledger treats observe reductions as observations, not applied output", async () => {
  const dir = ".mdz/test-ledger-observe";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await recordLedgerEvent({
    type: "tool-output",
    mode: "observe",
    action: "observe",
    tokens: { original: 100, reduced: 140 },
    savings: { estimatedSavedTokens: 0, estimatedPercentSaved: 0 },
    downsides: { qualityRisk: "low" }
  }, { file });
  await recordLedgerEvent({
    type: "test-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 1000, reduced: 250 },
    savings: { estimatedSavedTokens: 750, estimatedPercentSaved: 0.75 },
    downsides: { qualityRisk: "low" }
  }, { file });

  const report = await createLedgerReport({ file });

  assert.equal(report.totals.originalTokens, 1100);
  assert.equal(report.totals.reducedTokens, 350);
  assert.equal(report.totals.savedTokens, 750);
  assert.equal(report.totals.appliedEvents, 1);
});

test("ledger preserves concurrent hook events", async () => {
  const dir = ".mdz/test-ledger-concurrent";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });

  await Promise.all(Array.from({ length: 20 }, (_, index) => recordLedgerEvent({
    id: `concurrent-${index}`,
    type: "tool-output",
    mode: "observe",
    action: "observe",
    tokens: { original: 10, reduced: 10 },
    savings: { estimatedSavedTokens: index, estimatedPercentSaved: 0 },
    downsides: { qualityRisk: "low" }
  }, { file })));

  const ledger = await readLedger({ file });
  assert.equal(ledger.entries.length, 20);
  assert.equal(ledger.parseErrors.length, 0);
});

test("ledger does not count unconfirmed Antigravity or Claude hook recommendations as actual", async () => {
  const dir = ".mdz/test-ledger-unconfirmed-hooks";
  const file = `${dir}/ledger.jsonl`;
  await rm(dir, { recursive: true, force: true });
  await recordLedgerEvent({
    source: { platform: "antigravity", hook: "PostToolUse" },
    type: "tool-output",
    mode: "safe",
    action: "apply",
    tokens: { original: 1000, reduced: 100 },
    savings: { estimatedSavedTokens: 900, estimatedPercentSaved: 0.9 },
    downsides: { qualityRisk: "low" }
  }, { file });
  const report = await createLedgerReport({ file });
  assert.equal(report.totals.savedTokens, 0);
  assert.equal(report.totals.reducedTokens, 1000);
  assert.equal(report.totals.appliedEvents, 0);
  assert.equal(report.totals.potentialSavedTokens, 900);
});
