import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSession, isCodexJsonl, parseCodexSessionJsonl, recommendForSession, runBenchmarkScenario } from "../src/index.js";

const sampleJsonl = [
  JSON.stringify({
    timestamp: "2026-06-16T00:00:00Z",
    type: "session_meta",
    payload: {
      base_instructions: {
        text: "Follow repository instructions. ".repeat(300)
      },
      cwd: "C:/repo"
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-16T00:00:01Z",
    type: "event_msg",
    payload: {
      type: "user_message",
      message: "Run tests and fix auth."
    }
  }),
  JSON.stringify({
    timestamp: "2026-06-16T00:00:02Z",
    type: "response_item",
    payload: {
      type: "function_call_output",
      output: "PASS generated test\n".repeat(1000) + "FAIL auth validates expired token\nAssertionError: Expected 401 Received 200"
    }
  })
].join("\n");

test("parseCodexSessionJsonl extracts typed segments and opportunities", () => {
  assert.equal(isCodexJsonl(sampleJsonl), true);
  const parsed = parseCodexSessionJsonl(sampleJsonl);

  assert.equal(parsed.format, "codex-jsonl");
  assert.ok(parsed.totals.byKind.base_instructions.tokens > 0);
  assert.ok(parsed.totals.byKind.tool_output.tokens > 0);
  assert.ok(parsed.opportunities.some((item) => item.type === "tool-output-handle"));
});

test("analyzeSession uses Codex JSONL parser automatically", () => {
  const analysis = analyzeSession(sampleJsonl);

  assert.equal(analysis.format, "codex-jsonl");
  assert.ok(analysis.expected.savedTokens > 0);
  assert.ok(analysis.segmentSummary.tool_output.count > 0);
});

test("recommendForSession returns use for high-savings Codex JSONL", () => {
  const recommendation = recommendForSession(sampleJsonl);

  assert.equal(recommendation.format, "codex-jsonl");
  assert.equal(recommendation.recommendation, "use");
  assert.ok(recommendation.estimatedPercentSaved > 0.25);
});

test("runBenchmarkScenario reduces Codex JSONL custom session", async () => {
  const file = ".mdz/test-codex-session.jsonl";
  await import("node:fs/promises").then(({ mkdir, writeFile }) =>
    mkdir(".mdz", { recursive: true }).then(() => writeFile(file, sampleJsonl, "utf8"))
  );

  const report = await runBenchmarkScenario({
    id: "custom",
    fixture: file,
    type: "session"
  }, {
    mode: "safe",
    storeDir: ".mdz/test-benchmark-store"
  });

  assert.ok(report.savings.estimatedTokensSaved > 0);
  assert.equal(report.mdz.riskLevel, "medium");
});
