import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { readLatestAdvice } from "../src/index.js";

test("readLatestAdvice returns the newest hook advisor report", async () => {
  const dir = ".mdz/test-hooks";
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  await writeFile(`${dir}/old.json`, JSON.stringify({
    generatedAt: "2026-06-16T10:00:00.000Z",
    hook: "UserPromptSubmit",
    advisor: { action: "skip" },
    text: "old"
  }), "utf8");
  await writeFile(`${dir}/new.json`, JSON.stringify({
    generatedAt: "2026-06-16T11:00:00.000Z",
    hook: "PostToolUse",
    advisor: { action: "ask" },
    text: "new"
  }), "utf8");

  const advice = await readLatestAdvice({ dir });

  assert.equal(advice.text, "new");
  assert.equal(advice.hook, "PostToolUse");
  assert.equal(advice.advisor.action, "ask");
});
