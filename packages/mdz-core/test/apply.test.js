import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { applyOptimization, applySessionOptimization } from "../src/index.js";

test("applyOptimization filters test output and stores original handle", async () => {
  await rm(".mdz/test-apply", { recursive: true, force: true });
  const text = [
    ...Array.from({ length: 120 }, (_, index) => `PASS generated test ${index}`),
    "FAIL auth validates expired token",
    "AssertionError: Expected status 401, received 200"
  ].join("\n");

  const result = await applyOptimization(text, {
    type: "test-output",
    mode: "safe",
    storeDir: ".mdz/test-apply/store",
    out: ".mdz/test-apply/reduced.txt",
    ledgerFile: ".mdz/test-apply/ledger.jsonl"
  });
  const reduced = await readFile(".mdz/test-apply/reduced.txt", "utf8");

  assert.equal(result.action, "apply");
  assert.match(result.handle, /^mdz:\/\/context\//);
  assert.ok(result.savings.estimatedSavedTokens > 0);
  assert.equal(result.ledger.file, ".mdz/test-apply/ledger.jsonl");
  assert.match(reduced, /FAIL auth validates expired token/);
});

test("applySessionOptimization creates a provenance summary", async () => {
  await rm(".mdz/test-apply-session", { recursive: true, force: true });
  const session = Array.from({ length: 30 }, () => "tool output: repeated long line from a previous command that can be collapsed").join("\n");
  const result = await applySessionOptimization(session, {
    mode: "suggest",
    storeDir: ".mdz/test-apply-session/store",
    ledgerFile: ".mdz/test-apply-session/ledger.jsonl"
  });

  assert.match(result.handle, /^mdz:\/\/context\//);
  assert.match(result.reduced.text, /MDZ Reduced Session Artifact v2/);
  assert.match(result.reduced.text, /Original handle: mdz:\/\/context\//);
  assert.match(result.reduced.text, /Expansion Instructions/);
  assert.ok(result.reduced.tokens > 39);
  assert.ok(result.comparison);
});

test("applySessionOptimization keeps useful structure for large sessions", async () => {
  await rm(".mdz/test-apply-session-large", { recursive: true, force: true });
  const session = [
    "user: Please diagnose the failing auth flow.",
    "tool output:",
    ...Array.from({ length: 120 }, (_, index) => `ERROR auth validates expired token attempt=${index} file=src/auth/session.ts line=${40 + index}`),
    "assistant: The root cause appears to be token expiry validation."
  ].join("\n");
  const result = await applySessionOptimization(session, {
    mode: "suggest",
    storeDir: ".mdz/test-apply-session-large/store",
    ledgerFile: ".mdz/test-apply-session-large/ledger.jsonl"
  });

  assert.match(result.reduced.text, /Top opportunities/);
  assert.match(result.reduced.text, /Largest Contributors/);
  assert.match(result.reduced.text, /Retained Excerpts/);
  assert.match(result.reduced.text, /ERROR auth validates expired token/);
  assert.equal(typeof result.comparison.passed, "boolean");
});

test("applySessionOptimization does not count audit artifact size as savings when skipping", async () => {
  await rm(".mdz/test-apply-session-skip", { recursive: true, force: true });
  const session = "user: small request\nassistant: small answer";
  const result = await applySessionOptimization(session, {
    mode: "suggest",
    storeDir: ".mdz/test-apply-session-skip/store",
    ledgerFile: ".mdz/test-apply-session-skip/ledger.jsonl"
  });

  assert.equal(result.action, "skip");
  assert.equal(result.reduced.tokens, result.savings.totalTokens);
  assert.ok(result.reduced.artifactTokens >= result.reduced.tokens);
  assert.equal(result.ledger.entry.tokens.reduced, result.ledger.entry.tokens.original);
  assert.equal(result.ledger.entry.savings.estimatedSavedTokens, 0);
});
