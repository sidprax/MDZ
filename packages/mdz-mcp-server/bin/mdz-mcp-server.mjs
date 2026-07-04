#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  analyzeToolSchema,
  analyzePromptCacheStability,
  analyzeDiffContext,
  analyzeSession,
  attributeSavings,
  auditResponse,
  applyOptimization,
  applySessionOptimization,
  classifyTask,
  compressResponse,
  compactToolSchemas,
  compareContext,
  checkSufficiency,
  createCompactionArtifact,
  createPromptPrefixSnapshot,
  createPolicy,
  createAdvisorReport,
  createCompressionPlan,
  createLedgerReport,
  createDashboard,
  createHandoffArtifact,
  createLearningReport,
  createAnswerLengthContract,
  createAssistantOutputLedgerEvent,
  createOutputContract,
  createRepoMemoryMap,
  createSessionReport,
  createSavingsDigest,
  createTaskContract,
  createUsageReport,
  discoverSessions,
  estimateCost,
  estimateTokens,
  expandContext,
  extractEvidence,
  filterOutput,
  getSemanticCache,
  inspectCache,
  installMdz,
  uninstallMdz,
  listSemanticCache,
  listBenchmarkScenarios,
  listCostModels,
  listResponseProfiles,
  readPolicy,
  profileContext,
  pruneCache,
  planContextBudget,
  planToolDeferral,
  putSemanticCache,
  readProjectPolicy,
  renderPromptTrimReport,
  recommendForSession,
  recommendPolicy,
  recommendOutputBudget,
  recommendResponseProfile,
  recommendToolGuardrails,
  recordLedgerEvent,
  recordFeedback,
  readLatestAdvice,
  renderCacheReport,
  renderCompareReport,
  renderDoctorReport,
  renderLearningReport,
  renderLedgerReport,
  renderSessionDiscovery,
  renderAdvisorReport,
  renderReplayReport,
  renderSessionReport,
  renderSavingsDigest,
  renderSessionScan,
  replaySession,
  redactText,
  runCompressionExperiment,
  runDoctor,
  runBenchmarkScenario,
  runBenchmarkSuite,
  runQualityHarness,
  runSetupWizard,
  scanSecrets,
  scanSessionFile,
  scanSessionText,
  searchToolCatalog,
  storeContext,
  trimPrompt,
  writeAdvisorReports,
  writeDashboard,
  writeLedgerReport,
  writePolicy,
  writeSavingsDigest,
  writeProjectPolicy
} from "../../mdz-core/src/index.js";

const MDZ_MODES = ["enabled", "observe", "suggest", "safe", "balanced", "aggressive"];

const server = new McpServer({
  name: "mdz",
  version: "0.1.0"
});

server.registerTool(
  "profile_context",
  {
    title: "Profile Context",
    description: "Classify context into segments, token contributors, repeated content, and importance levels.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional()
    }
  },
  async ({ text, file }) => {
    const content = await resolveText({ text, file });
    return jsonResult({
      source: sourceMeta({ text, file }),
      ...compactProfile(profileContext(content))
    });
  }
);

server.registerTool(
  "extract_evidence",
  {
    title: "Extract Evidence",
    description: "Extract errors, file paths, commands, decisions, and other high-value spans that should survive compression.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      limit: z.number().int().positive().optional()
    }
  },
  async ({ text, file, limit }) => {
    const content = await resolveText({ text, file });
    return jsonResult({
      source: sourceMeta({ text, file }),
      ...extractEvidence(content, { limit })
    });
  }
);

server.registerTool(
  "plan_compression",
  {
    title: "Plan Compression",
    description: "Create a policy-aware plan to keep, trim, collapse, summarize, or handle context segments.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      mode: z.enum(MDZ_MODES).optional()
    }
  },
  async ({ text, file, mode }) => {
    const content = await resolveText({ text, file });
    const policy = await readPolicy();
    return jsonResult({
      source: sourceMeta({ text, file }),
      ...compactPlan(createCompressionPlan(content, { mode: mode ?? policy.mode }))
    });
  }
);

server.registerTool(
  "check_sufficiency",
  {
    title: "Check Sufficiency",
    description: "Check whether a reduced artifact preserves enough evidence to proceed without expansion.",
    inputSchema: {
      originalText: z.string().optional(),
      reducedText: z.string().optional(),
      originalFile: z.string().optional(),
      reducedFile: z.string().optional(),
      minCoverage: z.number().min(0).max(1).optional()
    }
  },
  async ({ originalText, reducedText, originalFile, reducedFile, minCoverage }) => {
    const original = await resolveText({ text: originalText, file: originalFile });
    const reduced = await resolveText({ text: reducedText, file: reducedFile });
    return jsonResult(checkSufficiency(original, reduced, { minCoverage }));
  }
);

server.registerTool(
  "show_policy",
  {
    title: "Show MDZ Mode",
    description: "Show whether MDZ is observing, suggesting, or allowed to apply safe reductions.",
    inputSchema: {
      file: z.string().optional().describe("Optional policy file path.")
    }
  },
  async ({ file }) => {
    return jsonResult(await readPolicy({ file }));
  }
);

server.registerTool(
  "set_policy",
  {
    title: "Set MDZ Mode",
    description: "Change MDZ mode. Enabled is the standard default; use observe for measurement-only audits, then safe after savings are trusted.",
    inputSchema: {
      mode: z.enum(MDZ_MODES),
      file: z.string().optional().describe("Optional policy file path."),
      minSavingsPercent: z.number().min(0).max(1).optional(),
      maxAutoRisk: z.enum(["none", "low", "medium", "high"]).optional(),
      visibilityLevel: z.enum(["visible", "digest", "quiet"]).optional(),
      digestCadence: z.enum(["turn", "hourly", "daily", "manual"]).optional()
    }
  },
  async ({ mode, file, minSavingsPercent, maxAutoRisk, visibilityLevel, digestCadence }) => {
    const existing = await readPolicy({ file });
    const result = await writePolicy(createPolicy({
      ...existing,
      mode,
      minSavingsPercent,
      maxAutoRisk,
      visibilityLevel,
      digestCadence
    }), { file });
    return jsonResult(result);
  }
);

server.registerTool(
  "doctor",
  {
    title: "Check MDZ Setup",
    description: "Run a local MDZ preflight check before using Codex, Antigravity, or another MCP client.",
    inputSchema: {
      platform: z.enum(["all", "codex", "claude", "antigravity", "generic"]).optional(),
      root: z.string().optional(),
      sourceRoot: z.string().optional(),
      target: z.string().optional(),
      quickBenchmark: z.boolean().optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ platform = "all", root, sourceRoot, target, quickBenchmark = false, format = "json" }) => {
    const report = await runDoctor({ platform, root, sourceRoot, target, quickBenchmark });
    return format === "text"
      ? textResult(renderDoctorReport(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "compare_context",
  {
    title: "Compare MDZ Context",
    description: "Check whether reduced context preserved important markers and estimate quality risk.",
    inputSchema: {
      originalText: z.string().optional().describe("Original context text."),
      reducedText: z.string().optional().describe("Reduced context text."),
      originalFile: z.string().optional().describe("Original file path."),
      reducedFile: z.string().optional().describe("Reduced file path."),
      markers: z.array(z.string()).optional().describe("Required markers that must remain in the reduced context."),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ originalText, reducedText, originalFile, reducedFile, markers, format = "json" }) => {
    const original = await resolveText({ text: originalText, file: originalFile });
    const reduced = await resolveText({ text: reducedText, file: reducedFile });
    const report = compareContext(original, reduced, { markers });
    return format === "text"
      ? textResult(renderCompareReport(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "estimate_tokens",
  {
    title: "Estimate Tokens",
    description: "Check how many tokens a prompt, file, or output is likely to use.",
    inputSchema: {
      text: z.string().optional().describe("Text to estimate."),
      file: z.string().optional().describe("Local file path to read and estimate.")
    }
  },
  async ({ text, file }) => {
    const content = await resolveText({ text, file });
    return jsonResult({
      estimate: estimateTokens(content),
      source: sourceMeta({ text, file })
    });
  }
);

server.registerTool(
  "store_context",
  {
    title: "Save Original Context",
    description: "Store large original content locally so the agent can use a short handle and expand details later.",
    inputSchema: {
      text: z.string().optional().describe("Text to store."),
      file: z.string().optional().describe("Local file path to store."),
      storeDir: z.string().optional().describe("Optional MDZ store directory.")
    }
  },
  async ({ text, file, storeDir }) => {
    const content = await resolveText({ text, file });
    const stored = await storeContext(content, { storeDir });
    return jsonResult({
      ...stored,
      source: sourceMeta({ text, file }),
      estimate: estimateTokens(content),
      downside: {
        localDiskBytes: stored.bytes,
        localCpuWork: "low",
        qualityRisk: "low"
      }
    });
  }
);

server.registerTool(
  "expand_context",
  {
    title: "Open Saved Context",
    description: "Open a saved MDZ handle and optionally return only selected lines.",
    inputSchema: {
      handle: z.string().describe("MDZ handle, for example mdz://context/<id>."),
      storeDir: z.string().optional().describe("Optional MDZ store directory."),
      startLine: z.number().int().positive().optional().describe("1-based start line."),
      endLine: z.number().int().positive().optional().describe("1-based end line.")
    }
  },
  async ({ handle, storeDir, startLine, endLine }) => {
    const text = await expandContext(handle, { storeDir, startLine, endLine });
    return jsonResult({
      handle,
      text,
      estimate: estimateTokens(text),
      downside: {
        addedLocalLatencyMs: 1,
        localCpuWork: "low",
        qualityRisk: "low"
      }
    });
  }
);

server.registerTool(
  "filter_output",
  {
    title: "Review Tool Output",
    description: "Check verbose test, log, or tool output and return a smaller version with savings and downsides.",
    inputSchema: {
      text: z.string().optional().describe("Output text to filter."),
      file: z.string().optional().describe("Local output file to read and filter."),
      kind: z.enum(["auto", "test", "log"]).optional().describe("Output type."),
      maxLines: z.number().int().positive().optional().describe("Maximum lines to return."),
      windowSize: z.number().int().positive().optional().describe("Context lines around important lines.")
    }
  },
  async ({ text, file, kind = "auto", maxLines, windowSize }) => {
    const content = await resolveText({ text, file });
    const result = filterOutput(content, { kind, maxLines, windowSize });
    return jsonResult({
      ...result,
      source: sourceMeta({ text, file })
    });
  }
);

server.registerTool(
  "trim_prompt",
  {
    title: "Trim Prompt",
    description: "Remove low-signal conversational wording from task prompts while preserving constraints, paths, code, and quoted/config spans.",
    inputSchema: {
      text: z.string().optional().describe("Prompt text to trim."),
      file: z.string().optional().describe("Local prompt file to read and trim."),
      minSavingsPercent: z.number().min(0).max(1).optional(),
      mode: z.enum(MDZ_MODES).optional(),
      includeText: z.boolean().optional().describe("Include reduced prompt text in the response."),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ text, file, minSavingsPercent, mode, includeText = false, format = "json" }) => {
    const result = trimPrompt(await resolveText({ text, file }), { minSavingsPercent, mode });
    const payload = {
      ...result,
      source: sourceMeta({ text, file }),
      original: undefined,
      reduced: includeText ? result.reduced : undefined
    };
    return format === "text" ? textResult(renderPromptTrimReport(result), payload) : jsonResult(payload);
  }
);

server.registerTool(
  "apply_once",
  {
    title: "Apply MDZ Once",
    description: "Apply a one-time deterministic MDZ reduction to a file or text, with original content stored behind a handle.",
    inputSchema: {
      text: z.string().optional().describe("Text to optimize."),
      file: z.string().optional().describe("Local file to optimize."),
      type: z.enum(["auto", "test-output", "log-output", "session"]).optional(),
      mode: z.enum(MDZ_MODES).optional(),
      out: z.string().optional().describe("Optional file path for reduced output."),
      writeReports: z.boolean().optional()
    }
  },
  async ({ text, file, type = "auto", mode, out, writeReports }) => {
    const content = await resolveText({ text, file });
    const result = type === "session"
      ? await applySessionOptimization(content, { type, mode, out, writeReports, source: sourceMeta({ text, file }) })
      : await applyOptimization(content, { type, mode, out, writeReports, source: sourceMeta({ text, file }) });
    return jsonResult({
      source: sourceMeta({ text, file }),
      ...result,
      reduced: {
        ...result.reduced,
        text: undefined
      }
    });
  }
);

server.registerTool(
  "analyze_session",
  {
    title: "Analyze Session Savings",
    description: "Review an existing session or transcript and estimate where MDZ could save tokens.",
    inputSchema: {
      text: z.string().optional().describe("Session transcript text."),
      file: z.string().optional().describe("Local session transcript file."),
      mode: z.enum(MDZ_MODES).optional()
    }
  },
  async ({ text, file, mode = "enabled" }) => {
    const content = await resolveText({ text, file });
    const analysis = analyzeSession(content);
    const report = createUsageReport(
      {
        expected: {
          totalTokens: analysis.totalTokens,
          savedTokens: analysis.expected.savedTokens,
          addedLatencyMs: analysis.expected.addedLatencyMs,
          localDiskBytes: analysis.expected.localDiskBytes,
          localCpuWork: analysis.expected.localCpuWork
        },
        riskLevel: highestRisk(analysis.opportunities),
        analysis
      },
      { mode }
    );
    return jsonResult(report);
  }
);

server.registerTool(
  "find_sessions",
  {
    title: "Find Agent Sessions",
    description: "Find likely Codex, Claude, Antigravity, generic, or workspace session transcripts that MDZ can analyze.",
    inputSchema: {
      platform: z.enum(["all", "codex", "claude", "antigravity", "generic"]).optional(),
      root: z.string().optional(),
      home: z.string().optional(),
      limit: z.number().int().positive().optional(),
      maxDepth: z.number().int().positive().optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ platform = "all", root, home, limit, maxDepth, format = "json" }) => {
    const report = await discoverSessions({ platform, root, home, limit, maxDepth });
    return format === "text"
      ? textResult(renderSessionDiscovery(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "manage_cache",
  {
    title: "Manage MDZ Cache",
    description: "Inspect or prune local MDZ handle storage.",
    inputSchema: {
      action: z.enum(["inspect", "prune"]).optional(),
      storeDir: z.string().optional(),
      maxAgeDays: z.number().optional(),
      maxBytes: z.number().optional(),
      dryRun: z.boolean().optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ action = "inspect", storeDir, maxAgeDays, maxBytes, dryRun = true, format = "json" }) => {
    const report = action === "prune"
      ? await pruneCache({ storeDir, maxAgeDays, maxBytes, dryRun })
      : await inspectCache({ storeDir });
    return format === "text" ? textResult(renderCacheReport(report), report) : jsonResult(report);
  }
);

server.registerTool(
  "estimate_cost",
  {
    title: "Estimate Token Cost",
    description: "Estimate baseline and optimized token cost using configurable provider/model prices.",
    inputSchema: {
      inputTokens: z.number().nonnegative().optional(),
      outputTokens: z.number().nonnegative().optional(),
      savedInputTokens: z.number().nonnegative().optional(),
      savedOutputTokens: z.number().nonnegative().optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
      priceKey: z.string().optional(),
      inputPerMillion: z.number().nonnegative().optional(),
      outputPerMillion: z.number().nonnegative().optional(),
      listModels: z.boolean().optional()
    }
  },
  async (input) => {
    if (input.listModels) return jsonResult(listCostModels());
    return jsonResult(estimateCost(input, input));
  }
);

server.registerTool(
  "policy_autopilot",
  {
    title: "Recommend MDZ Policy",
    description: "Recommend enabled/observe/suggest/safe/balanced based on usage history, savings target, risk, and interruptions.",
    inputSchema: {
      ledgerFile: z.string().optional(),
      targetReduction: z.number().min(0).max(1).optional()
    }
  },
  async ({ ledgerFile, targetReduction }) => {
    const report = await createLedgerReport({ file: ledgerFile });
    return jsonResult(recommendPolicy(report, { targetReduction }));
  }
);

server.registerTool(
  "response_profile",
  {
    title: "Recommend Response Profile",
    description: "Recommend a concise response profile to reduce output tokens without changing task intent.",
    inputSchema: {
      outputTokens: z.number().nonnegative().optional(),
      targetReduction: z.number().min(0).max(1).optional(),
      listProfiles: z.boolean().optional()
    }
  },
  async ({ outputTokens = 0, targetReduction, listProfiles }) => {
    if (listProfiles) return jsonResult(listResponseProfiles());
    return jsonResult(recommendResponseProfile({ outputTokens }, { targetReduction }));
  }
);

server.registerTool(
  "output_contract",
  {
    title: "Create Output Contract",
    description: "Create a compact response contract with profile, max output tokens, sections, and instruction.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      taskType: z.string().optional(),
      profile: z.enum(["terse", "standard", "detailed"]).optional(),
      maxTokens: z.number().positive().optional(),
      maxLines: z.number().positive().optional()
    }
  },
  async ({ text, file, taskType, profile, maxTokens, maxLines }) => {
    const content = text || file ? await resolveText({ text, file }) : "";
    return jsonResult(createOutputContract({ prompt: content }, { taskType, profile, maxTokens, maxLines }));
  }
);

server.registerTool(
  "answer_contract",
  {
    title: "Create Answer-Length Contract",
    description: "Create an explicit answer length contract for final responses.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      taskType: z.string().optional(),
      profile: z.enum(["terse", "standard", "detailed"]).optional(),
      maxTokens: z.number().positive().optional()
    }
  },
  async ({ text, file, taskType, profile, maxTokens }) => {
    const content = text || file ? await resolveText({ text, file }) : "";
    return jsonResult(createAnswerLengthContract({ prompt: content }, { taskType, profile, maxTokens }));
  }
);

server.registerTool(
  "output_budget",
  {
    title: "Recommend Output Budget",
    description: "Recommend task-aware output budget and response profile.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      taskType: z.string().optional(),
      targetReduction: z.number().min(0).max(1).optional()
    }
  },
  async ({ text, file, taskType, targetReduction }) => {
    const content = text || file ? await resolveText({ text, file }) : "";
    return jsonResult(recommendOutputBudget({ prompt: content }, { taskType, targetReduction }));
  }
);

server.registerTool(
  "audit_response",
  {
    title: "Audit Response",
    description: "Estimate output tokens and determine whether a response should be compressed before sending.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      taskType: z.string().optional(),
      profile: z.enum(["terse", "standard", "detailed"]).optional(),
      maxTokens: z.number().positive().optional(),
      recordLedger: z.boolean().optional(),
      ledgerFile: z.string().optional()
    }
  },
  async ({ text, file, taskType, profile, maxTokens, recordLedger = true, ledgerFile }) => {
    const policy = await readPolicy();
    const result = auditResponse(await resolveText({ text, file }), { taskType, profile, maxTokens });
    if (recordLedger) {
      result.ledger = await recordLedgerEvent(createAssistantOutputLedgerEvent(result, {
        mode: policy.mode,
        action: "observe",
        source: { tool: "audit_response", ...sourceMeta({ text, file }) }
      }), { file: ledgerFile });
    }
    return jsonResult(result);
  }
);

server.registerTool(
  "compress_response",
  {
    title: "Compress Response",
    description: "Compress a verbose response into a task-aware output contract without changing core meaning.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      taskType: z.string().optional(),
      profile: z.enum(["terse", "standard", "detailed"]).optional(),
      maxTokens: z.number().positive().optional(),
      maxLines: z.number().positive().optional(),
      includeText: z.boolean().optional(),
      recordLedger: z.boolean().optional(),
      ledgerFile: z.string().optional(),
      action: z.enum(["apply", "ask", "observe"]).optional()
    }
  },
  async ({ text, file, taskType, profile, maxTokens, maxLines, includeText, recordLedger = true, ledgerFile, action = "apply" }) => {
    const policy = await readPolicy();
    const result = compressResponse(await resolveText({ text, file }), { taskType, profile, maxTokens, maxLines });
    if (recordLedger) {
      result.ledger = await recordLedgerEvent(createAssistantOutputLedgerEvent(result, {
        mode: policy.mode,
        action,
        source: { tool: "compress_response", ...sourceMeta({ text, file }) }
      }), { file: ledgerFile });
    }
    return jsonResult({ ...result, compressed: includeText ? result.compressed : undefined });
  }
);

server.registerTool(
  "analyze_tool_schema",
  {
    title: "Analyze Tool Schema",
    description: "Estimate token overhead from MCP/tool schemas and recommend compact variants.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      limit: z.number().int().positive().optional()
    }
  },
  async ({ text, file, limit }) => {
    const content = await resolveText({ text, file });
    return jsonResult(analyzeToolSchema(content, { limit }));
  }
);

server.registerTool(
  "compact_tool_schemas",
  {
    title: "Compact Tool Schemas",
    description: "Remove documentation-only schema payload and shorten prose while proving validation contracts are unchanged.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      maxToolDescriptionChars: z.number().int().positive().optional(),
      maxFieldDescriptionChars: z.number().int().positive().optional(),
      removeExamples: z.boolean().optional(),
      includeCompacted: z.boolean().optional(),
      applied: z.boolean().optional(),
      recordLedger: z.boolean().optional(),
      ledgerFile: z.string().optional()
    }
  },
  async ({ text, file, maxToolDescriptionChars, maxFieldDescriptionChars, removeExamples = true, includeCompacted = false, applied = false, recordLedger = true, ledgerFile }) => {
    const result = compactToolSchemas(await resolveText({ text, file }), {
      maxToolDescriptionChars,
      maxFieldDescriptionChars,
      removeExamples
    });
    if (recordLedger && result.metrics) {
      const policy = await readPolicy();
      result.ledger = await recordLedgerEvent({
        source: { tool: "compact_tool_schemas", ...sourceMeta({ text, file }) },
        type: "tool-schema",
        mode: policy.mode,
        action: applied ? "apply" : "observe",
        tokens: { original: result.metrics.originalTokens, reduced: result.metrics.reducedTokens },
        savings: { estimatedSavedTokens: result.metrics.estimatedSavedTokens, estimatedPercentSaved: result.metrics.estimatedPercentSaved },
        downsides: { addedLocalLatencyMs: 1, localCpuWork: "low", localDiskBytes: 0, qualityRisk: "low", privacyCacheSensitivity: "none" },
        example: {
          technique: "tool-schema-compaction",
          summary: `Shortened documentation-only schema text while preserving validation contracts for ${result.metrics.tools} tools.`,
          before: `${result.metrics.originalTokens} estimated schema tokens`,
          after: applied ? `${result.metrics.reducedTokens} estimated schema tokens` : "Generated compact catalog; host usage not yet confirmed"
        }
      }, { file: ledgerFile });
    }
    return jsonResult({ ...result, compacted: includeCompacted ? result.compacted : undefined });
  }
);

server.registerTool(
  "plan_tool_deferral",
  {
    title: "Plan Tool Deferral",
    description: "Choose a small core toolset and estimate per-turn savings from deferring other full schemas behind tool search.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      maxCoreTools: z.number().int().positive().optional(),
      coreTools: z.array(z.string()).optional(),
      routerOverheadTokens: z.number().int().nonnegative().optional(),
      recordLedger: z.boolean().optional(),
      ledgerFile: z.string().optional()
    }
  },
  async ({ text, file, maxCoreTools, coreTools, routerOverheadTokens, recordLedger = true, ledgerFile }) => {
    const result = planToolDeferral(await resolveText({ text, file }), {
      maxCoreTools,
      coreTools,
      routerOverheadTokens
    });
    if (recordLedger) {
      const policy = await readPolicy();
      result.ledger = await recordLedgerEvent({
        source: { tool: "plan_tool_deferral", ...sourceMeta({ text, file }) },
        type: "tool-deferral",
        mode: policy.mode,
        action: "observe",
        tokens: { original: result.metrics.fullSchemaTokens, reduced: result.metrics.fullSchemaTokens },
        savings: { estimatedSavedTokens: result.metrics.estimatedSavedTokensPerTurn, estimatedPercentSaved: result.metrics.estimatedPercentSavedPerTurn },
        downsides: { addedLocalLatencyMs: 1, localCpuWork: "low", localDiskBytes: 0, qualityRisk: "low", privacyCacheSensitivity: "none", extraMdzToolCalls: result.downsides.extraSearchCallWhenDeferredToolNeeded },
        example: {
          technique: "tool-schema-deferral",
          summary: `Planned ${result.metrics.coreTools} core tools and ${result.metrics.deferredTools} deferred tools.`,
          before: `${result.metrics.fullSchemaTokens} estimated schema tokens per turn`,
          after: `${result.metrics.estimatedUpfrontTokens} estimated upfront tokens if a gateway applies the plan`
        },
        notes: [result.downsides.warning]
      }, { file: ledgerFile });
    }
    return jsonResult(result);
  }
);

server.registerTool(
  "search_tool_catalog",
  {
    title: "Search Deferred Tools",
    description: "Search a deferred tool catalog locally using deterministic intent matching and return schemas only for the best matches.",
    inputSchema: {
      query: z.string(),
      text: z.string().optional(),
      file: z.string().optional(),
      limit: z.number().int().positive().optional(),
      minScore: z.number().nonnegative().optional(),
      loadedTools: z.array(z.string()).optional()
    }
  },
  async ({ query, text, file, limit, minScore, loadedTools }) => {
    return jsonResult(searchToolCatalog(await resolveText({ text, file }), query, { limit, minScore, loadedTools }));
  }
);

server.registerTool(
  "create_prefix_snapshot",
  {
    title: "Create Prompt Prefix Snapshot",
    description: "Fingerprint stable prompt-prefix components for later cache-stability comparison without storing their raw text in the snapshot.",
    inputSchema: {
      systemPrompt: z.string().optional(),
      toolDefinitions: z.string().optional(),
      projectInstructions: z.string().optional(),
      conversationPrefix: z.string().optional(),
      model: z.string().optional(),
      reasoningEffort: z.string().optional()
    }
  },
  async (input) => {
    return jsonResult(createPromptPrefixSnapshot(input, { model: input.model, reasoningEffort: input.reasoningEffort }));
  }
);

server.registerTool(
  "analyze_cache_stability",
  {
    title: "Analyze Prompt Cache Stability",
    description: "Estimate probable prompt-prefix cache reuse, invalidation, and cold-start risk. Results are not provider-confirmed billing data.",
    inputSchema: {
      currentText: z.string(),
      previousText: z.string().optional(),
      retentionMinutes: z.number().positive().optional(),
      previousRequestAt: z.string().optional(),
      now: z.string().optional()
    }
  },
  async ({ currentText, previousText, retentionMinutes, previousRequestAt, now }) => {
    const current = JSON.parse(currentText);
    const previous = previousText ? JSON.parse(previousText) : undefined;
    return jsonResult(analyzePromptCacheStability(current, previous, { retentionMinutes, previousRequestAt, now }));
  }
);

server.registerTool(
  "replay_session",
  {
    title: "Replay Session Savings",
    description: "Estimate turn-by-turn where MDZ would have intervened in a session transcript.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      mode: z.enum(MDZ_MODES).optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ text, file, mode, format = "json" }) => {
    const content = await resolveText({ text, file });
    const policy = await readPolicy();
    const report = replaySession(content, { mode: mode ?? policy.mode });
    return format === "text" ? textResult(renderReplayReport(report), report) : jsonResult(report);
  }
);

server.registerTool(
  "dashboard",
  {
    title: "Create MDZ Dashboard",
    description: "Create a local MDZ dashboard summary from usage, cache, and policy autopilot signals.",
    inputSchema: {
      ledgerFile: z.string().optional(),
      storeDir: z.string().optional(),
      targetReduction: z.number().min(0).max(1).optional(),
      writeReports: z.boolean().optional(),
      reportDir: z.string().optional()
    }
  },
  async ({ ledgerFile, storeDir, targetReduction, writeReports, reportDir }) => {
    const dashboard = await createDashboard({ ledgerFile, storeDir, targetReduction });
    if (writeReports) {
      dashboard.reportFiles = await writeDashboard(dashboard, { dir: reportDir });
    }
    return jsonResult(dashboard);
  }
);

server.registerTool(
  "record_feedback",
  {
    title: "Record MDZ Feedback",
    description: "Record local outcome feedback so MDZ can tune future recommendations.",
    inputSchema: {
      event: z.string(),
      mode: z.string().optional(),
      taskType: z.string().optional(),
      action: z.string().optional(),
      savingsPercent: z.number().optional(),
      riskLevel: z.string().optional(),
      handle: z.string().optional(),
      session: z.string().optional(),
      note: z.string().optional()
    }
  },
  async (input) => jsonResult(await recordFeedback(input))
);

server.registerTool(
  "learning_report",
  {
    title: "Show MDZ Learning Report",
    description: "Summarize local feedback events, preferred mode, risk tolerance, and handle expansion rate.",
    inputSchema: {
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ format = "json" }) => {
    const report = await createLearningReport();
    return format === "text" ? textResult(renderLearningReport(report), report) : jsonResult(report);
  }
);

server.registerTool(
  "classify_task",
  {
    title: "Classify Task",
    description: "Classify a prompt/session into a task type with recommended MDZ mode.",
    inputSchema: { text: z.string().optional(), file: z.string().optional() }
  },
  async ({ text, file }) => jsonResult(classifyTask(await resolveText({ text, file })))
);

server.registerTool(
  "plan_budget",
  {
    title: "Plan Context Budget",
    description: "Estimate a task-specific context budget and recommended MDZ mode.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      targetReduction: z.number().optional()
    }
  },
  async ({ text, file, targetReduction }) => jsonResult(planContextBudget(await resolveText({ text, file }), { targetReduction }))
);

server.registerTool(
  "create_task_contract",
  {
    title: "Create Task Contract",
    description: "Create a compact task contract while storing the original behind an MDZ handle.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      includeText: z.boolean().optional()
    }
  },
  async ({ text, file, includeText }) => {
    const result = await createTaskContract(await resolveText({ text, file }));
    return jsonResult({ ...result, contract: includeText ? result.contract : undefined });
  }
);

server.registerTool(
  "scan_secrets",
  {
    title: "Scan Secrets",
    description: "Detect likely secrets before caching or reporting context.",
    inputSchema: { text: z.string().optional(), file: z.string().optional() }
  },
  async ({ text, file }) => jsonResult(scanSecrets(await resolveText({ text, file })))
);

server.registerTool(
  "redact_text",
  {
    title: "Redact Text",
    description: "Redact likely secrets from text before reporting or storing it.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      includeText: z.boolean().optional()
    }
  },
  async ({ text, file, includeText }) => {
    const result = redactText(await resolveText({ text, file }));
    return jsonResult({ ...result, redacted: includeText ? result.redacted : undefined });
  }
);

server.registerTool(
  "semantic_cache",
  {
    title: "Use Semantic Cache",
    description: "Store, fetch, or list reusable local summaries by content hash.",
    inputSchema: {
      action: z.enum(["list", "get", "put"]).optional(),
      text: z.string().optional(),
      file: z.string().optional(),
      summary: z.string().optional()
    }
  },
  async ({ action = "list", text, file, summary }) => {
    if (action === "list") return jsonResult(await listSemanticCache());
    const content = await resolveText({ text, file });
    if (action === "get") return jsonResult(await getSemanticCache(content));
    return jsonResult(await putSemanticCache(content, summary ?? content.slice(0, 1000), { source: file }));
  }
);

server.registerTool(
  "repo_memory_map",
  {
    title: "Create Repo Memory Map",
    description: "Create a compact local repo map to avoid repeated broad exploration.",
    inputSchema: {
      root: z.string().optional(),
      maxFiles: z.number().int().positive().optional(),
      maxDepth: z.number().int().positive().optional()
    }
  },
  async ({ root, maxFiles, maxDepth }) => jsonResult(await createRepoMemoryMap({ root, maxFiles, maxDepth }))
);

server.registerTool(
  "tool_guardrails",
  {
    title: "Recommend Tool Guardrails",
    description: "Recommend cheaper tool-call strategies before large reads, logs, tests, or repo exploration.",
    inputSchema: {
      text: z.string().optional(),
      tool: z.string().optional()
    }
  },
  async ({ text, tool }) => jsonResult(recommendToolGuardrails({ text, tool }))
);

server.registerTool(
  "compact_state",
  {
    title: "Create Compaction State",
    description: "Create a high-fidelity compaction artifact with evidence, next steps, and expansion handle.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      includeText: z.boolean().optional()
    }
  },
  async ({ text, file, includeText }) => {
    const result = await createCompactionArtifact(await resolveText({ text, file }));
    return jsonResult({ ...result, artifact: includeText ? result.artifact : undefined });
  }
);

server.registerTool(
  "create_handoff",
  {
    title: "Create Cross-Agent Handoff",
    description: "Create a portable handoff artifact for Codex, Claude, Antigravity, Gemini, or generic agents.",
    inputSchema: {
      text: z.string().optional(),
      file: z.string().optional(),
      target: z.string().optional(),
      includeText: z.boolean().optional()
    }
  },
  async ({ text, file, target, includeText }) => {
    const result = await createHandoffArtifact(await resolveText({ text, file }), { target });
    return jsonResult({ ...result, artifact: includeText ? result.artifact : undefined });
  }
);

server.registerTool(
  "diff_context",
  {
    title: "Analyze Diff Context",
    description: "Analyze a diff and recommend diff-aware context instead of full changed files.",
    inputSchema: { text: z.string().optional(), file: z.string().optional() }
  },
  async ({ text, file }) => jsonResult(analyzeDiffContext(await resolveText({ text, file })))
);

server.registerTool(
  "quality_check",
  {
    title: "Run Quality Harness",
    description: "Check marker retention and evidence sufficiency for a reduced artifact.",
    inputSchema: {
      originalText: z.string().optional(),
      reducedText: z.string().optional(),
      originalFile: z.string().optional(),
      reducedFile: z.string().optional(),
      markers: z.array(z.string()).optional()
    }
  },
  async ({ originalText, reducedText, originalFile, reducedFile, markers }) => {
    const original = await resolveText({ text: originalText, file: originalFile });
    const reduced = await resolveText({ text: reducedText, file: reducedFile });
    return jsonResult(runQualityHarness(original, reduced, { markers }));
  }
);

server.registerTool(
  "attribute_savings",
  {
    title: "Attribute MDZ Savings",
    description: "Break savings down by source such as filtering, handles, response profile, or schema reduction.",
    inputSchema: {
      reportText: z.string().optional(),
      reportFile: z.string().optional()
    }
  },
  async ({ reportText, reportFile }) => {
    const content = await resolveText({ text: reportText, file: reportFile });
    return jsonResult(attributeSavings(JSON.parse(content)));
  }
);

server.registerTool(
  "compression_experiment",
  {
    title: "Run Compression Experiment",
    description: "Test prompt-level dictionary encoding and report whether it would actually save tokens.",
    inputSchema: { text: z.string().optional(), file: z.string().optional(), limit: z.number().optional() }
  },
  async ({ text, file, limit }) => jsonResult(runCompressionExperiment(await resolveText({ text, file }), { limit }))
);

server.registerTool(
  "project_policy",
  {
    title: "Show Or Write Project Policy",
    description: "Read or initialize the local .mdz project policy.",
    inputSchema: {
      action: z.enum(["show", "init"]).optional(),
      mode: z.string().optional(),
      targetReduction: z.number().optional()
    }
  },
  async ({ action = "show", mode, targetReduction }) => {
    if (action === "init") return jsonResult(await writeProjectPolicy({ defaults: { mode, targetReduction } }));
    return jsonResult(await readProjectPolicy());
  }
);

server.registerTool(
  "setup_wizard",
  {
    title: "Run MDZ Setup Wizard",
    description: "Detect project setup, recommend install command, and optionally run doctor.",
    inputSchema: {
      root: z.string().optional(),
      platform: z.enum(["all", "codex", "claude", "antigravity", "generic"]).optional(),
      skipDoctor: z.boolean().optional()
    }
  },
  async ({ root, platform, skipDoctor }) => jsonResult(await runSetupWizard({ root, platform, skipDoctor }))
);

server.registerTool(
  "report_session",
  {
    title: "Report Session Savings",
    description: "Create a readable session savings report with expected savings, risks, and downsides.",
    inputSchema: {
      text: z.string().optional().describe("Session transcript text."),
      file: z.string().optional().describe("Local session transcript file."),
      mode: z.enum(MDZ_MODES).optional(),
      format: z.enum(["json", "text"]).optional(),
      writeReports: z.boolean().optional()
    }
  },
  async ({ text, file, mode, format = "json", writeReports }) => {
    const content = await resolveText({ text, file });
    const policy = await readPolicy();
    const report = createSessionReport(content, {
      file,
      mode: mode ?? policy.mode
    });
    if (writeReports) {
      const { writeSessionReport } = await import("../../mdz-core/src/index.js");
      report.reportFiles = await writeSessionReport(report, { dir: policy.reportDir });
    }
    return format === "text"
      ? textResult(renderSessionReport(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "scan_session",
  {
    title: "Scan Large Session Transcript",
    description: "Stream a Codex, Claude, Antigravity, or generic transcript and report token savings categories, top examples, repeated blocks, and downsides without loading the full session into context.",
    inputSchema: {
      text: z.string().optional().describe("Session transcript text. Prefer file for large transcripts."),
      file: z.string().optional().describe("Local session transcript file."),
      platform: z.enum(["codex", "claude", "antigravity", "generic"]).optional(),
      minLargeTokens: z.number().int().positive().optional(),
      topLimit: z.number().int().positive().optional(),
      repeatLimit: z.number().int().positive().optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ text, file, platform, minLargeTokens, topLimit, repeatLimit, format = "json" }) => {
    if (!file && typeof text !== "string") {
      throw new Error("scan_session requires file or text.");
    }
    const report = file
      ? await scanSessionFile(file, { platform, minLargeTokens, topLimit, repeatLimit })
      : scanSessionText(text, { platform, minLargeTokens, topLimit, repeatLimit });
    return format === "text"
      ? textResult(renderSessionScan(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "savings_digest",
  {
    title: "Show MDZ Savings Digest",
    description: "Show a periodic digest of what MDZ saved or observed, with downsides.",
    inputSchema: {
      ledgerFile: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      markSent: z.boolean().optional(),
      visibilityLevel: z.enum(["visible", "digest", "quiet"]).optional(),
      cadence: z.enum(["turn", "hourly", "daily", "manual"]).optional(),
      format: z.enum(["json", "text"]).optional(),
      writeReports: z.boolean().optional()
    }
  },
  async ({ ledgerFile, since, until, markSent, visibilityLevel, cadence, format = "json", writeReports }) => {
    const policy = await readPolicy();
    const digest = await createSavingsDigest({
      ledgerFile,
      since,
      until,
      markSent,
      visibilityLevel: visibilityLevel ?? policy.visibilityLevel,
      cadence: cadence ?? policy.digestCadence
    });
    if (writeReports) {
      digest.reportFiles = await writeSavingsDigest(digest, { dir: policy.reportDir });
    }
    return format === "text" ? textResult(renderSavingsDigest(digest), digest) : jsonResult(digest);
  }
);

server.registerTool(
  "usage_report",
  {
    title: "Show MDZ Usage Report",
    description: "Summarize recorded MDZ usage, savings, actions, and downsides from the local ledger.",
    inputSchema: {
      ledgerFile: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      mode: z.string().optional(),
      action: z.string().optional(),
      type: z.string().optional(),
      exampleLimit: z.number().int().nonnegative().optional(),
      format: z.enum(["json", "text"]).optional(),
      writeReports: z.boolean().optional()
    }
  },
  async ({ ledgerFile, since, until, mode, action, type, exampleLimit, format = "json", writeReports }) => {
    const report = await createLedgerReport({ file: ledgerFile, since, until, mode, action, type, exampleLimit });
    if (writeReports) {
      report.reportFiles = await writeLedgerReport(report);
    }
    return format === "text"
      ? textResult(renderLedgerReport(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "list_benchmarks",
  {
    title: "Show MDZ Benchmarks",
    description: "Show the built-in benchmark scenarios users can run to evaluate MDZ.",
    inputSchema: {}
  },
  async () => {
    return jsonResult({
      scenarios: listBenchmarkScenarios()
    });
  }
);

server.registerTool(
  "run_benchmark",
  {
    title: "Run Savings Benchmark",
    description: "Run a local MDZ benchmark and show token savings, risk, latency, and cache impact.",
    inputSchema: {
      scenario: z.string().optional().describe("Scenario id, or 'suite'. Defaults to 'suite'."),
      mode: z.enum(MDZ_MODES).optional(),
      storeDir: z.string().optional().describe("Optional MDZ benchmark store directory."),
      file: z.string().optional().describe("Custom benchmark input file. Use with scenario='custom'."),
      type: z.enum(["session", "test-output", "log-output"]).optional().describe("Custom benchmark input type."),
      marker: z.string().optional().describe("Optional marker that should remain after reduction.")
    }
  },
  async ({ scenario = "suite", mode, storeDir, file, type, marker }) => {
    const options = { mode, storeDir };
    let result;
    if (scenario === "suite") {
      result = await runBenchmarkSuite(options);
    } else if (scenario === "custom") {
      if (!file) {
        throw new Error("Custom benchmark requires file.");
      }
      result = await runBenchmarkScenario({
        id: "custom",
        name: "Custom Benchmark",
        fixture: file,
        type: type ?? "session",
        mode,
        successMarkers: marker ? [marker] : []
      }, options);
    } else {
      result = await runBenchmarkScenario(scenario, options);
    }
    return jsonResult(result);
  }
);

server.registerTool(
  "recommend_mdz",
  {
    title: "Should MDZ Help?",
    description: "Decide whether MDZ should be used, ask first, or skipped for a prompt/session.",
    inputSchema: {
      text: z.string().optional().describe("Session or transcript text."),
      file: z.string().optional().describe("Local session or transcript file.")
    }
  },
  async ({ text, file }) => {
    const content = await resolveText({ text, file });
    return jsonResult({
      source: sourceMeta({ text, file }),
      ...recommendForSession(content)
    });
  }
);

server.registerTool(
  "advisor",
  {
    title: "MDZ Token Advisor",
    description: "Show a user-friendly apply, ask, observe, or skip recommendation with expected savings and downsides.",
    inputSchema: {
      text: z.string().optional().describe("Session or transcript text."),
      file: z.string().optional().describe("Local session or transcript file."),
      mode: z.enum(MDZ_MODES).optional(),
      format: z.enum(["json", "text"]).optional()
    }
  },
  async ({ text, file, mode = "suggest", format = "json" }) => {
    const content = await resolveText({ text, file });
    const recommendation = {
      source: sourceMeta({ text, file }),
      ...recommendForSession(content)
    };
    const report = createAdvisorReport(recommendation, { mode });
    return format === "text"
      ? textResult(renderAdvisorReport(report), report)
      : jsonResult(report);
  }
);

server.registerTool(
  "latest_advice",
  {
    title: "Show Latest MDZ Advice",
    description: "Show the most recent MDZ Token Advisor result written by the local hooks.",
    inputSchema: {
      dir: z.string().optional().describe("Optional hooks report directory.")
    }
  },
  async ({ dir }) => {
    const advice = await readLatestAdvice({ dir });
    return textResult(advice.text ?? "No MDZ advisor report found yet.", advice);
  }
);

server.registerTool(
  "install_mdz",
  {
    title: "Install MDZ",
    description: "Install MDZ for Codex, Claude, Antigravity, or a generic MCP client, starting in enabled mode by default.",
    inputSchema: {
      platform: z.enum(["codex", "claude", "antigravity", "generic"]).optional(),
      scope: z.enum(["project", "user"]).optional(),
      mode: z.enum(MDZ_MODES).optional(),
      root: z.string().optional().describe("Legacy shared source/target root."),
      sourceRoot: z.string().optional().describe("MDZ checkout root."),
      target: z.string().optional().describe("Project to configure.")
    }
  },
  async ({ platform = "codex", scope = "project", mode = "enabled", root, sourceRoot, target }) => {
    return jsonResult(await installMdz({ platform, scope, mode, root, sourceRoot, target }));
  }
);

server.registerTool(
  "uninstall_mdz",
  {
    title: "Uninstall MDZ",
    description: "Remove MDZ-owned platform configuration while preserving local MDZ data unless purgeData is explicitly true.",
    inputSchema: {
      platform: z.enum(["codex", "claude", "antigravity", "generic"]).optional(),
      scope: z.enum(["project", "user"]).optional(),
      root: z.string().optional(),
      sourceRoot: z.string().optional(),
      target: z.string().optional(),
      purgeData: z.boolean().optional()
    }
  },
  async ({ platform = "codex", scope = "project", root, sourceRoot, target, purgeData = false }) => {
    return jsonResult(await uninstallMdz({ platform, scope, root, sourceRoot, target, purgeData }));
  }
);

server.registerTool(
  "report_usage",
  {
    title: "Create Savings Report",
    description: "Create a concise MDZ report from token usage and savings metrics.",
    inputSchema: {
      mode: z.enum(MDZ_MODES).optional(),
      originalTokens: z.number().nonnegative(),
      reducedTokens: z.number().nonnegative().optional(),
      savedTokens: z.number().nonnegative(),
      addedLatencyMs: z.number().nonnegative().optional(),
      localDiskBytes: z.number().nonnegative().optional(),
      localCpuWork: z.enum(["low", "medium", "high"]).optional(),
      riskLevel: z.enum(["low", "medium", "high"]).optional()
    }
  },
  async (input) => {
    const report = createUsageReport(
      {
        metrics: {
          originalTokens: input.originalTokens,
          reducedTokens: input.reducedTokens ?? Math.max(0, input.originalTokens - input.savedTokens),
          savedTokens: input.savedTokens,
          estimatedLatencyMs: input.addedLatencyMs ?? 0,
          estimatedDiskBytes: input.localDiskBytes ?? 0,
          estimatedCpuWork: input.localCpuWork ?? "low"
        },
        riskLevel: input.riskLevel ?? "low"
      },
      { mode: input.mode ?? "enabled" }
    );
    return jsonResult(report);
  }
);

async function resolveText({ text, file }) {
  if (typeof text === "string") return text;
  if (file) return readFile(file, "utf8");
  throw new Error("Provide either text or file.");
}

function sourceMeta({ text, file }) {
  return {
    type: file ? "file" : "text",
    file,
    providedTextChars: typeof text === "string" ? text.length : undefined
  };
}

function compactPlan(plan) {
  return {
    ...plan,
    profile: compactProfile(plan.profile)
  };
}

function compactProfile(profile) {
  return {
    ...profile,
    segments: profile.segments?.map(compactSegment),
    topSegments: profile.topSegments?.map(compactSegment)
  };
}

function compactSegment(segment) {
  const { text, ...rest } = segment;
  return {
    ...rest,
    preview: previewText(text)
  };
}

function previewText(value) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}

function textResult(text, structuredContent) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    structuredContent
  };
}

function highestRisk(opportunities) {
  const risks = opportunities.map((item) => item.riskLevel);
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  if (risks.includes("low")) return "low";
  return "unknown";
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MDZ MCP server running on stdio");
}

main().catch((error) => {
  console.error("MDZ MCP server error:", error);
  process.exit(1);
});
