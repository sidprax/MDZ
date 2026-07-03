import test from "node:test";
import assert from "node:assert/strict";
import {
  auditResponse,
  compressResponse,
  createAnswerLengthContract,
  createAssistantOutputLedgerEvent,
  createOutputContract,
  recommendOutputBudget,
  recordFeedback,
  createLearningReport
} from "../src/index.js";
import { rm } from "node:fs/promises";

test("output contract creates task-aware budget and sections", () => {
  const contract = createOutputContract({ prompt: "FAIL auth test expected 401" });

  assert.equal(contract.taskType, "test-failure");
  assert.equal(contract.profile, "terse");
  assert.ok(contract.maxOutputTokens > 0);
  assert.ok(contract.sections.includes("Validation"));
});

test("auditResponse flags over-budget verbose answers", () => {
  const response = "Detailed explanation. ".repeat(500);
  const audit = auditResponse(response, { taskType: "test-failure", maxTokens: 100 });

  assert.equal(audit.overBudget, true);
  assert.ok(audit.estimatedSavingsIfCompressed > 0);
});

test("compressResponse reduces verbose responses deterministically", () => {
  const response = [
    "Implemented the auth fix in src/auth/session.ts.",
    "This is a long explanatory paragraph. ".repeat(100),
    "Validation: npm test passed.",
    "Caveat: none."
  ].join("\n");
  const compressed = compressResponse(response, { taskType: "test-failure", maxLines: 3 });

  assert.ok(compressed.reducedTokens < compressed.originalTokens);
  assert.match(compressed.compressed, /Validation/);
});

test("compressResponse deduplicates long single-line responses", () => {
  const response = "Implemented output ledger accounting. Validation passed. ".repeat(120);
  const compressed = compressResponse(response, { taskType: "test-failure", maxLines: 2 });

  assert.ok(compressed.reducedTokens < compressed.originalTokens);
  assert.match(compressed.compressed, /Implemented output ledger accounting/);
  assert.match(compressed.compressed, /Validation passed/);
});

test("assistant output ledger events distinguish audit from applied compression", () => {
  const audit = auditResponse("Verbose answer. ".repeat(200), { taskType: "test-failure", maxTokens: 50 });
  const auditEvent = createAssistantOutputLedgerEvent(audit, { mode: "safe" });
  const compressed = compressResponse("Implemented fix.\nValidation passed.\n".repeat(100), { taskType: "test-failure", maxLines: 2 });
  const compressedEvent = createAssistantOutputLedgerEvent(compressed, { mode: "safe" });

  assert.equal(auditEvent.type, "assistant-output");
  assert.equal(auditEvent.action, "observe");
  assert.ok(auditEvent.savings.estimatedSavedTokens > 0);
  assert.equal(compressedEvent.type, "assistant-output");
  assert.equal(compressedEvent.action, "apply");
  assert.ok(compressedEvent.tokens.reduced < compressedEvent.tokens.original);
});

test("answer and output budget contracts are exposed", () => {
  const answer = createAnswerLengthContract({ prompt: "review code" }, { maxTokens: 300 });
  const budget = recommendOutputBudget({ prompt: "review code for regressions" });

  assert.equal(answer.maxOutputTokens, 300);
  assert.ok(budget.maxOutputTokens > 0);
});

test("learning profile records verbosity feedback", async () => {
  const dir = ".mdz/test-output-learning";
  await rm(dir, { recursive: true, force: true });
  await recordFeedback({ event: "too-verbose" }, { file: `${dir}/events.jsonl`, profileFile: `${dir}/profile.json` });
  const report = await createLearningReport({ file: `${dir}/events.jsonl` });

  assert.equal(report.profile.signals.tooVerbose, 1);
  assert.equal(report.profile.preferredOutputProfile, "terse");
});
