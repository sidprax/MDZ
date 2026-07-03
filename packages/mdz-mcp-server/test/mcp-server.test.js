import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MDZ MCP server lists and calls core tools over stdio", async () => {
  const outputLedgerFile = ".mdz/test-mcp-output-ledger.jsonl";
  await rm(outputLedgerFile, { force: true });
  const client = new Client({
    name: "mdz-test-client",
    version: "0.1.0"
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["packages/mdz-mcp-server/bin/mdz-mcp-server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe"
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);

    assert.ok(toolNames.includes("estimate_tokens"));
    assert.ok(toolNames.includes("filter_output"));
    assert.ok(toolNames.includes("analyze_session"));
    assert.ok(toolNames.includes("run_benchmark"));
    assert.ok(toolNames.includes("recommend_mdz"));
    assert.ok(toolNames.includes("advisor"));
    assert.ok(toolNames.includes("latest_advice"));
    assert.ok(toolNames.includes("compare_context"));
    assert.ok(toolNames.includes("usage_report"));
    assert.ok(toolNames.includes("savings_digest"));
    assert.ok(toolNames.includes("doctor"));
    assert.ok(toolNames.includes("install_mdz"));
    assert.ok(toolNames.includes("uninstall_mdz"));
    assert.ok(toolNames.includes("profile_context"));
    assert.ok(toolNames.includes("extract_evidence"));
    assert.ok(toolNames.includes("plan_compression"));
    assert.ok(toolNames.includes("check_sufficiency"));
    assert.ok(toolNames.includes("find_sessions"));
    assert.ok(toolNames.includes("manage_cache"));
    assert.ok(toolNames.includes("estimate_cost"));
    assert.ok(toolNames.includes("policy_autopilot"));
    assert.ok(toolNames.includes("response_profile"));
    assert.ok(toolNames.includes("output_contract"));
    assert.ok(toolNames.includes("answer_contract"));
    assert.ok(toolNames.includes("output_budget"));
    assert.ok(toolNames.includes("audit_response"));
    assert.ok(toolNames.includes("compress_response"));
    assert.ok(toolNames.includes("analyze_tool_schema"));
    assert.ok(toolNames.includes("compact_tool_schemas"));
    assert.ok(toolNames.includes("plan_tool_deferral"));
    assert.ok(toolNames.includes("search_tool_catalog"));
    assert.ok(toolNames.includes("create_prefix_snapshot"));
    assert.ok(toolNames.includes("analyze_cache_stability"));
    assert.ok(toolNames.includes("replay_session"));
    assert.ok(toolNames.includes("dashboard"));
    assert.ok(toolNames.includes("record_feedback"));
    assert.ok(toolNames.includes("learning_report"));
    assert.ok(toolNames.includes("classify_task"));
    assert.ok(toolNames.includes("plan_budget"));
    assert.ok(toolNames.includes("create_task_contract"));
    assert.ok(toolNames.includes("scan_secrets"));
    assert.ok(toolNames.includes("redact_text"));
    assert.ok(toolNames.includes("semantic_cache"));
    assert.ok(toolNames.includes("repo_memory_map"));
    assert.ok(toolNames.includes("tool_guardrails"));
    assert.ok(toolNames.includes("compact_state"));
    assert.ok(toolNames.includes("create_handoff"));
    assert.ok(toolNames.includes("diff_context"));
    assert.ok(toolNames.includes("quality_check"));
    assert.ok(toolNames.includes("attribute_savings"));
    assert.ok(toolNames.includes("compression_experiment"));
    assert.ok(toolNames.includes("project_policy"));
    assert.ok(toolNames.includes("setup_wizard"));

    const estimate = await client.callTool({
      name: "estimate_tokens",
      arguments: {
        text: "Run tests and fix the failing auth validation."
      }
    });

    assert.ok(estimate.structuredContent.estimate.tokens > 0);

    const filtered = await client.callTool({
      name: "filter_output",
      arguments: {
        kind: "test",
        text: ["PASS one", "PASS two", "FAIL auth test", "AssertionError: Expected 200 Received 401"].join("\n")
      }
    });

    assert.equal(filtered.structuredContent.kind, "test");
    assert.equal(filtered.structuredContent.riskLevel, "low");
    assert.ok(filtered.structuredContent.metrics.savedTokens >= 0);

    const benchmark = await client.callTool({
      name: "run_benchmark",
      arguments: {
        scenario: "verbose-test-failure",
        mode: "safe",
        storeDir: ".mdz/test-mcp-benchmark-store"
      }
    });

    assert.equal(benchmark.structuredContent.scenario.id, "verbose-test-failure");
    assert.ok(benchmark.structuredContent.downsides.localDiskBytes > 0);

    const recommendation = await client.callTool({
      name: "recommend_mdz",
      arguments: {
        text: [
          JSON.stringify({ type: "session_meta", payload: { base_instructions: { text: "Rule ".repeat(2000) } } }),
          JSON.stringify({ type: "response_item", payload: { type: "function_call_output", output: "PASS x\n".repeat(1000) } })
        ].join("\n")
      }
    });

    assert.ok(["use", "ask", "skip"].includes(recommendation.structuredContent.recommendation));
    assert.ok(recommendation.structuredContent.totalTokens > 0);

    const advisor = await client.callTool({
      name: "advisor",
      arguments: {
        text: "short prompt",
        mode: "suggest",
        format: "text"
      }
    });

    assert.match(advisor.content[0].text, /MDZ recommends:/);

    const comparison = await client.callTool({
      name: "compare_context",
      arguments: {
        originalText: "ERROR database timeout",
        reducedText: "ERROR database timeout",
        markers: ["ERROR database timeout"]
      }
    });

    assert.equal(comparison.structuredContent.passed, true);

    const doctor = await client.callTool({
      name: "doctor",
      arguments: {
        platform: "generic"
      }
    });

    assert.equal(doctor.structuredContent.ready, true);

    const digest = await client.callTool({
      name: "savings_digest",
      arguments: {
        format: "json"
      }
    });
    assert.ok(digest.structuredContent.report.totals.events >= 0);

    const plan = await client.callTool({
      name: "plan_compression",
      arguments: {
        text: "user: fix auth\nERROR token expired\nsrc/auth/session.ts",
        mode: "suggest"
      }
    });

    assert.ok(plan.structuredContent.summary.originalTokens > 0);

    const sessions = await client.callTool({
      name: "find_sessions",
      arguments: {
        platform: "generic",
        root: process.cwd(),
        limit: 3
      }
    });

    assert.ok(Array.isArray(sessions.structuredContent.candidates));

    const cost = await client.callTool({
      name: "estimate_cost",
      arguments: {
        inputTokens: 1000,
        savedInputTokens: 500,
        inputPerMillion: 1,
        outputPerMillion: 5
      }
    });
    assert.ok(cost.structuredContent.cost.savedUsd > 0);

    const replay = await client.callTool({
      name: "replay_session",
      arguments: {
        text: "user: hi\nassistant: hello",
        mode: "observe"
      }
    });
    assert.ok(replay.structuredContent.totals.turns >= 1);

    const scan = await client.callTool({
      name: "scan_session",
      arguments: {
        text: JSON.stringify({
          type: "tool_result",
          payload: { output: "Exit code: 0\n" + "WARN noisy line\n".repeat(600) }
        }),
        platform: "codex"
      }
    });
    assert.ok(scan.structuredContent.totals.estimatedReducibleTokens > 0);

    const classified = await client.callTool({
      name: "classify_task",
      arguments: {
        text: "FAIL auth test AssertionError expected 401"
      }
    });
    assert.equal(classified.structuredContent.taskType, "test-failure");

    const secretScan = await client.callTool({
      name: "scan_secrets",
      arguments: {
        text: "api_key=supersecretvalue12345"
      }
    });
    assert.equal(secretScan.structuredContent.findingCount, 1);

    const guardrails = await client.callTool({
      name: "tool_guardrails",
      arguments: {
        text: "inspect repository and read entire files",
        tool: "read"
      }
    });
    assert.ok(guardrails.structuredContent.recommendationCount > 0);

    const outputContract = await client.callTool({
      name: "output_contract",
      arguments: {
        text: "FAIL auth test expected 401"
      }
    });
    assert.equal(outputContract.structuredContent.taskType, "test-failure");

    const auditResponse = await client.callTool({
      name: "audit_response",
      arguments: {
        text: "Verbose answer. ".repeat(300),
        taskType: "test-failure",
        maxTokens: 100,
        ledgerFile: outputLedgerFile
      }
    });
    assert.equal(auditResponse.structuredContent.overBudget, true);

    const compressedResponse = await client.callTool({
      name: "compress_response",
      arguments: {
        text: "Implemented the fix.\nValidation passed.\n".repeat(120),
        taskType: "test-failure",
        maxLines: 2,
        ledgerFile: outputLedgerFile
      }
    });
    assert.ok(compressedResponse.structuredContent.estimatedSavedTokens > 0);
    const outputLedger = await readFile(outputLedgerFile, "utf8");
    assert.match(outputLedger, /"type":"assistant-output"/);

    const toolCatalog = {
      tools: [{
        name: "find_symbol_references",
        description: "Find all references to a code symbol. " + "Extended guidance. ".repeat(40),
        inputSchema: { type: "object", required: ["symbol"], properties: { symbol: { type: "string", description: "Symbol name. ".repeat(30) } } }
      }, {
        name: "create_issue",
        description: "Create a project issue. " + "Extended guidance. ".repeat(40),
        inputSchema: { type: "object", properties: { title: { type: "string" } } }
      }]
    };
    const compactedTools = await client.callTool({
      name: "compact_tool_schemas",
      arguments: { text: JSON.stringify(toolCatalog), includeCompacted: true, ledgerFile: outputLedgerFile }
    });
    assert.equal(compactedTools.structuredContent.compatible, true);
    assert.ok(compactedTools.structuredContent.metrics.estimatedSavedTokens > 0);

    const deferral = await client.callTool({
      name: "plan_tool_deferral",
      arguments: { text: JSON.stringify(toolCatalog), maxCoreTools: 1, routerOverheadTokens: 0, ledgerFile: outputLedgerFile }
    });
    assert.equal(deferral.structuredContent.metrics.deferredTools, 1);

    const routed = await client.callTool({
      name: "search_tool_catalog",
      arguments: { text: JSON.stringify(toolCatalog), query: "find symbol references" }
    });
    assert.equal(routed.structuredContent.results[0].name, "find_symbol_references");

    const previousPrefix = await client.callTool({
      name: "create_prefix_snapshot",
      arguments: { systemPrompt: "Stable", toolDefinitions: "read_file", model: "gpt-5.5" }
    });
    const currentPrefix = await client.callTool({
      name: "create_prefix_snapshot",
      arguments: { systemPrompt: "Stable", toolDefinitions: "read_file plus new tool", model: "gpt-5.5" }
    });
    const cacheStability = await client.callTool({
      name: "analyze_cache_stability",
      arguments: {
        currentText: JSON.stringify(currentPrefix.structuredContent),
        previousText: JSON.stringify(previousPrefix.structuredContent),
        retentionMinutes: 10
      }
    });
    assert.equal(cacheStability.structuredContent.confirmedByProvider, false);
    assert.ok(cacheStability.structuredContent.metrics.invalidatedTokens > 0);
  } finally {
    await client.close();
  }
});
