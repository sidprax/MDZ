import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { readPolicy, writePolicy } from "../src/index.js";

test("readPolicy returns enabled defaults when no policy exists", async () => {
  const file = ".mdz/test-policy/missing.json";
  await rm(".mdz/test-policy", { recursive: true, force: true });
  const policy = await readPolicy({ file });

  assert.equal(policy.mode, "enabled");
  assert.equal(policy.storeOriginals, true);
  assert.equal(policy.visibilityLevel, "visible");
});

test("writePolicy persists selected mode", async () => {
  const file = ".mdz/test-policy/policy.json";
  await rm(".mdz/test-policy", { recursive: true, force: true });
  const written = await writePolicy({ mode: "safe" }, { file });
  const raw = JSON.parse(await readFile(file, "utf8"));
  const policy = await readPolicy({ file });

  assert.equal(written.file, file);
  assert.equal(raw.mode, "safe");
  assert.equal(policy.mode, "safe");
  assert.equal(policy.maxAutoRisk, "low");
});

test("writePolicy persists visibility preferences", async () => {
  const file = ".mdz/test-policy/visibility.json";
  await rm(".mdz/test-policy", { recursive: true, force: true });

  await writePolicy({ mode: "suggest", visibilityLevel: "digest", digestCadence: "daily" }, { file });
  const policy = await readPolicy({ file });

  assert.equal(policy.visibilityLevel, "digest");
  assert.equal(policy.digestCadence, "daily");
});
