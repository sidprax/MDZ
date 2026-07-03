import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expandContext, parseHandle, storeContext } from "../src/index.js";

test("storeContext creates a reversible MDZ handle", async () => {
  const storeDir = await mkdtemp(path.join(tmpdir(), "mdz-store-"));
  try {
    const original = "line 1\nline 2\nline 3";
    const stored = await storeContext(original, { storeDir });

    assert.match(stored.handle, /^mdz:\/\/context\//);
    assert.equal(parseHandle(stored.handle), stored.id);
    assert.equal(await expandContext(stored.handle, { storeDir }), original);
    assert.equal(await expandContext(stored.handle, { storeDir, startLine: 2, endLine: 2 }), "line 2");
  } finally {
    await rm(storeDir, { recursive: true, force: true });
  }
});
