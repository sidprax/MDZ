import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import {
  analyzeToolSchema,
  analyzePromptCacheStability,
  compactToolSchemas,
  createPromptPrefixSnapshot,
  createDashboard,
  estimateCost,
  inspectCache,
  planToolDeferral,
  pruneCache,
  recommendPolicy,
  recommendResponseProfile,
  replaySession,
  searchToolCatalog,
  storeContext,
  writeDashboard
} from "../src/index.js";

test("cache manager inspects and dry-run prunes stored handles", async () => {
  const storeDir = ".mdz/test-product-cache/store";
  await rm(".mdz/test-product-cache", { recursive: true, force: true });
  await storeContext("large cached context", { storeDir });

  const report = await inspectCache({ storeDir });
  const prune = await pruneCache({ storeDir, maxBytes: 1, dryRun: true });

  assert.equal(report.totals.objects, 1);
  assert.equal(prune.dryRun, true);
  assert.equal(prune.selected.objects, 1);
});

test("cost model estimates configurable token savings", () => {
  const report = estimateCost({
    inputTokens: 100000,
    outputTokens: 10000,
    savedInputTokens: 50000
  }, {
    inputPerMillion: 1,
    outputPerMillion: 5
  });

  assert.equal(report.cost.baselineUsd, 0.15);
  assert.equal(report.cost.optimizedUsd, 0.1);
  assert.equal(report.cost.savedUsd, 0.05);
});

test("policy autopilot recommends mode from usage report", () => {
  const recommendation = recommendPolicy({
    totals: { events: 12, estimatedPercentSaved: 0.35 },
    downsides: { qualityRisk: "low", workflowInterruptions: 0 }
  }, { targetReduction: 0.3 });

  assert.equal(recommendation.recommendedMode, "safe");
});

test("response profile estimates output savings", () => {
  const profile = recommendResponseProfile({ outputTokens: 1000 }, { targetReduction: 0.4 });

  assert.equal(profile.profile, "terse");
  assert.ok(profile.estimatedSavedTokens > 0);
});

test("tool schema analyzer flags large schemas", () => {
  const schema = {
    tools: [{
      name: "big_tool",
      description: "Long description ".repeat(80),
      inputSchema: { properties: { query: { type: "string", description: "Query ".repeat(80) } } }
    }]
  };
  const report = analyzeToolSchema(JSON.stringify(schema));

  assert.equal(report.totals.tools, 1);
  assert.ok(report.totals.estimatedSavedTokens > 0);
});

test("tool schema compaction preserves validation contracts", () => {
  const schema = {
    tools: [{
      name: "search_code",
      description: "Search code by query. " + "Additional guidance and examples. ".repeat(30),
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            minLength: 2,
            description: "The source-code query to search for. " + "Verbose explanation. ".repeat(30),
            examples: ["find references"]
          },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
        }
      }
    }]
  };

  const report = compactToolSchemas(schema);

  assert.equal(report.compatible, true);
  assert.ok(report.metrics.estimatedSavedTokens > 0);
  assert.deepEqual(report.compacted.tools[0].inputSchema.required, ["query"]);
  assert.equal(report.compacted.tools[0].inputSchema.properties.query.minLength, 2);
  assert.equal(report.compacted.tools[0].inputSchema.properties.limit.default, 20);
  assert.equal(report.compacted.tools[0].inputSchema.properties.query.examples, undefined);
});

test("tool deferral keeps a small core and estimates per-turn savings", () => {
  const tools = Array.from({ length: 16 }, (_, index) => ({
    name: index === 0 ? "read_file" : index === 1 ? "run_terminal_command" : `specialized_tool_${index}`,
    description: `Tool ${index}. ` + "Detailed usage guidance. ".repeat(30),
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Detailed query instructions. ".repeat(20) } }
    }
  }));

  const plan = planToolDeferral({ tools }, { maxCoreTools: 2 });

  assert.equal(plan.coreTools.length, 2);
  assert.equal(plan.deferredTools.length, 14);
  assert.ok(plan.metrics.estimatedSavedTokensPerTurn > 0);
  assert.equal(plan.catalog, undefined);
});

test("deterministic tool search routes intent and remembers discoveries", () => {
  const tools = [{
    name: "find_symbol_references",
    description: "Find all references to a code symbol in the workspace.",
    inputSchema: { type: "object", properties: { symbol: { type: "string" } } }
  }, {
    name: "create_issue",
    description: "Create a project issue.",
    inputSchema: { type: "object", properties: { title: { type: "string" } } }
  }];

  const first = searchToolCatalog({ tools }, "find every reference to this symbol");
  const second = searchToolCatalog({ tools }, "find symbol references", { loadedTools: first.session.loadedTools });

  assert.equal(first.results[0].name, "find_symbol_references");
  assert.ok(second.results[0].alreadyLoaded);
  assert.ok(second.session.loadedTools.includes("find_symbol_references"));
});

test("cache stability identifies reusable prefix and tool catalog churn", () => {
  const previous = createPromptPrefixSnapshot({
    systemPrompt: "Stable system rules",
    toolDefinitions: [{ name: "read_file" }],
    projectInstructions: "Run tests",
    conversationPrefix: "user: fix auth"
  }, { generatedAt: "2026-06-19T12:00:00.000Z", model: "gpt-5.5", reasoningEffort: "medium" });
  const current = createPromptPrefixSnapshot({
    systemPrompt: "Stable system rules",
    toolDefinitions: [{ name: "read_file" }, { name: "large_new_tool", description: "x".repeat(500) }],
    projectInstructions: "Run tests",
    conversationPrefix: "user: fix auth\nassistant: inspecting"
  }, { generatedAt: "2026-06-19T12:03:00.000Z", model: "gpt-5.5", reasoningEffort: "medium" });

  const report = analyzePromptCacheStability(current, previous, { retentionMinutes: 10 });

  assert.equal(report.status, "probable-partial-hit");
  assert.ok(report.metrics.reusablePrefixTokens > 0);
  assert.ok(report.metrics.invalidatedTokens > 0);
  assert.ok(report.warnings.some((warning) => /Tool definitions changed/.test(warning)));
  assert.equal(report.confirmedByProvider, false);
});

test("cache stability warns when an idle session probably expired", () => {
  const previous = createPromptPrefixSnapshot({ systemPrompt: "Stable" }, { generatedAt: "2026-06-19T12:00:00.000Z" });
  const current = createPromptPrefixSnapshot({ systemPrompt: "Stable" }, { generatedAt: "2026-06-19T12:30:00.000Z" });
  const report = analyzePromptCacheStability(current, previous, { retentionMinutes: 10 });

  assert.equal(report.status, "probable-expired");
  assert.equal(report.metrics.reusablePrefixTokens, 0);
  assert.ok(report.warnings.some((warning) => /idle/.test(warning)));
});

test("session replay produces turn-level savings", () => {
  const session = [
    "user: Diagnose logs",
    "tool: " + "WARN repeated line with details\n".repeat(80),
    "assistant: root cause found"
  ].join("\n");
  const report = replaySession(session, { mode: "suggest" });

  assert.ok(report.totals.turns >= 2);
  assert.ok(report.turns[0].role);
});

test("dashboard writes local html report", async () => {
  const dir = ".mdz/test-product-dashboard";
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/ledger.jsonl`, "", "utf8");
  const dashboard = await createDashboard({
    ledgerFile: `${dir}/ledger.jsonl`,
    storeDir: `${dir}/store`
  });
  const written = await writeDashboard(dashboard, { dir, baseName: "dashboard-test" });

  assert.match(written.htmlPath, /dashboard-test\.html$/);
});
