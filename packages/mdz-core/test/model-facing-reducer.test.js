import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expandContext, prepareModelFacingReduction, recordModelFacingDelivery } from "../src/index.js";

test("model-facing reduction is net-positive, reversible, and recorded only on delivery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-reducer-"));
  const storeDir = path.join(root, "store");
  const ledgerFile = path.join(root, "ledger.jsonl");
  const original = [
    ...Array.from({ length: 600 }, (_, index) => `PASS test ${index}`),
    "FAIL auth test",
    "AssertionError: Expected 401 Received 200"
  ].join("\n");
  try {
    const reduction = await prepareModelFacingReduction(original, {
      policy: { mode: "safe", storeOriginals: true, storeDir },
      storeDir
    });
    assert.equal(reduction.applied, true);
    assert.ok(reduction.metrics.savedTokens > 0);
    assert.equal(await expandContext(reduction.handle, { storeDir }), original);
    await assert.rejects(readFile(ledgerFile, "utf8"));
    await recordModelFacingDelivery(reduction, { ledgerFile, source: { test: true } });
    assert.match(await readFile(ledgerFile, "utf8"), /"action":"apply"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("observe mode never changes the model-facing payload", async () => {
  const original = "PASS one\n".repeat(500);
  const reduction = await prepareModelFacingReduction(original, { policy: { mode: "observe" } });
  assert.equal(reduction.applied, false);
  assert.equal(reduction.replacement, original);
});
