import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderSessionScan, scanSessionFile, scanSessionText } from "../src/index.js";

test("scanSessionText detects repeated Codex instructions and tool output", () => {
  const baseInstructions = "You are Codex, a coding agent based on GPT-5. ".repeat(120);
  const toolOutput = "Exit code: 0\nWall time: 1.0 seconds\nOutput:\n" + "WARN noisy test line\n".repeat(600);
  const text = [
    JSON.stringify({ type: "session_meta", payload: { base_instructions: { text: baseInstructions } } }),
    JSON.stringify({ type: "session_meta", payload: { base_instructions: { text: baseInstructions } } }),
    JSON.stringify({ type: "tool_result", payload: { output: toolOutput } })
  ].join("\n");

  const report = scanSessionText(text, { file: "rollout.jsonl", platform: "codex" });

  assert.equal(report.source.platform, "codex");
  assert.ok(report.totals.estimatedReducibleTokens > 0);
  assert.ok(report.categories.some((item) => item.category === "static-instructions"));
  assert.ok(report.categories.some((item) => item.category === "tool-output"));
  assert.ok(report.repeatedBlocks.some((item) => item.occurrences === 2));
  assert.match(renderSessionScan(report), /Top Savings Examples/);
});

test("scanSessionText detects Antigravity code blocks as tool output", () => {
  const codeContent = "const cp = require('child_process');\n".repeat(250);
  const report = scanSessionText(JSON.stringify({
    step_index: 10,
    source: "MODEL",
    type: "TOOL_CALL",
    tool_calls: [{ args: { CodeContent: codeContent } }]
  }), { file: "transcript.jsonl", platform: "antigravity" });

  assert.equal(report.source.platform, "antigravity");
  assert.ok(report.categories.some((item) => item.category === "tool-output"));
  assert.ok(report.recommendations.some((item) => item.includes("Antigravity-aware")));
});

test("scanSessionFile detects inline media payload savings", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mdz-scan-"));
  const file = path.join(dir, "media.jsonl");
  const image = `data:image/png;base64,${"A".repeat(12000)}`;
  await writeFile(file, JSON.stringify({ type: "tool_result", payload: { output: [{ image_url: image }] } }), "utf8");

  try {
    const report = await scanSessionFile(file, { platform: "codex" });
    assert.ok(report.categories.some((item) => item.category === "media-inline"));
    assert.ok(report.recommendations.some((item) => item.includes("media/base64 handle")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
