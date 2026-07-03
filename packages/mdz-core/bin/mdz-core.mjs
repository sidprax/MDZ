#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import process from "node:process";
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
  createDashboard,
  createHandoffArtifact,
  createPolicy,
  createAdvisorReport,
  createAssistantOutputLedgerEvent,
  createCompressionPlan,
  createLedgerReport,
  createSessionReport,
  createSavingsDigest,
  createLearningReport,
  createRepoMemoryMap,
  createTaskContract,
  createAnswerLengthContract,
  createOutputContract,
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
  initializeGateway,
  inspectGateway,
  listSemanticCache,
  listBenchmarkScenarios,
  listCostModels,
  listResponseProfiles,
  readPolicy,
  recommendForSession,
  recommendPolicy,
  recommendResponseProfile,
  recommendOutputBudget,
  readLatestAdvice,
  profileContext,
  pruneCache,
  planContextBudget,
  planToolDeferral,
  putSemanticCache,
  readProjectPolicy,
  recordLedgerEvent,
  recordFeedback,
  renderCacheReport,
  renderCompareReport,
  renderDoctorReport,
  renderLedgerReport,
  renderLearningReport,
  renderReplayReport,
  renderSessionDiscovery,
  renderAdvisorReport,
  renderSessionReport,
  renderSavingsDigest,
  renderSessionScan,
  replaySession,
  redactText,
  recommendToolGuardrails,
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
  writeAdvisorReports,
  writeDashboard,
  writeLedgerReport,
  writePolicy,
  writeSavingsDigest,
  writeProjectPolicy
} from "../src/index.js";

const [, , command, ...args] = process.argv;

try {
  if (!command || command === "help" || command === "--help") {
    printHelp();
  } else if (command === "estimate") {
    await estimateCommand(args);
  } else if (command === "filter-output") {
    await filterOutputCommand(args);
  } else if (command === "store") {
    await storeCommand(args);
  } else if (command === "expand") {
    await expandCommand(args);
  } else if (command === "analyze-session") {
    await analyzeSessionCommand(args);
  } else if (command === "benchmarks") {
    await benchmarksCommand(args);
  } else if (command === "benchmark") {
    await benchmarkCommand(args);
  } else if (command === "recommend") {
    await recommendCommand(args);
  } else if (command === "advisor") {
    await advisorCommand(args);
  } else if (command === "latest-advice") {
    await latestAdviceCommand(args);
  } else if (command === "policy") {
    await policyCommand(args);
  } else if (command === "apply") {
    await applyCommand(args);
  } else if (command === "report-session") {
    await reportSessionCommand(args);
  } else if (command === "scan-session" || command === "scan-sessions") {
    await scanSessionCommand(args);
  } else if (command === "usage-report") {
    await usageReportCommand(args);
  } else if (command === "find-sessions") {
    await findSessionsCommand(args);
  } else if (command === "cache") {
    await cacheCommand(args);
  } else if (command === "cost") {
    await costCommand(args);
  } else if (command === "autopilot") {
    await autopilotCommand(args);
  } else if (command === "response-profile") {
    await responseProfileCommand(args);
  } else if (command === "output-contract") {
    await outputContractCommand(args);
  } else if (command === "answer-contract") {
    await answerContractCommand(args);
  } else if (command === "output-budget") {
    await outputBudgetCommand(args);
  } else if (command === "audit-response") {
    await auditResponseCommand(args);
  } else if (command === "compress-response") {
    await compressResponseCommand(args);
  } else if (command === "tool-schema") {
    await toolSchemaCommand(args);
  } else if (command === "compact-tool-schema") {
    await compactToolSchemaCommand(args);
  } else if (command === "tool-deferral") {
    await toolDeferralCommand(args);
  } else if (command === "tool-search") {
    await toolSearchCommand(args);
  } else if (command === "prefix-snapshot") {
    await prefixSnapshotCommand(args);
  } else if (command === "cache-stability") {
    await cacheStabilityCommand(args);
  } else if (command === "replay-session") {
    await replaySessionCommand(args);
  } else if (command === "dashboard") {
    await dashboardCommand(args);
  } else if (command === "digest") {
    await digestCommand(args);
  } else if (command === "feedback") {
    await feedbackCommand(args);
  } else if (command === "learning-report") {
    await learningReportCommand(args);
  } else if (command === "classify-task") {
    await classifyTaskCommand(args);
  } else if (command === "budget") {
    await budgetCommand(args);
  } else if (command === "contract") {
    await contractCommand(args);
  } else if (command === "secret-scan") {
    await secretScanCommand(args);
  } else if (command === "redact") {
    await redactCommand(args);
  } else if (command === "semantic-cache") {
    await semanticCacheCommand(args);
  } else if (command === "repo-map") {
    await repoMapCommand(args);
  } else if (command === "tool-guardrails") {
    await toolGuardrailsCommand(args);
  } else if (command === "compact-state") {
    await compactStateCommand(args);
  } else if (command === "handoff") {
    await handoffCommand(args);
  } else if (command === "diff-context") {
    await diffContextCommand(args);
  } else if (command === "attribute-savings") {
    await attributeSavingsCommand(args);
  } else if (command === "quality-check") {
    await qualityCheckCommand(args);
  } else if (command === "compression-experiment") {
    await compressionExperimentCommand(args);
  } else if (command === "project-policy") {
    await projectPolicyCommand(args);
  } else if (command === "setup") {
    await setupCommand(args);
  } else if (command === "compare") {
    await compareCommand(args);
  } else if (command === "profile") {
    await profileCommand(args);
  } else if (command === "evidence") {
    await evidenceCommand(args);
  } else if (command === "plan") {
    await planCommand(args);
  } else if (command === "sufficiency") {
    await sufficiencyCommand(args);
  } else if (command === "install") {
    await installCommand(args);
  } else if (command === "uninstall") {
    await uninstallCommand(args);
  } else if (command === "gateway") {
    await gatewayCommand(args);
  } else if (command === "doctor") {
    await doctorCommand(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`MDZ error: ${error.message}`);
  process.exitCode = 1;
}

async function latestAdviceCommand(args) {
  const { options } = parseArgs(args);
  const advice = await readLatestAdvice({ dir: options.dir });
  if (options.format === "json") {
    writeJson(advice);
  } else {
    console.log(advice.text ?? "No MDZ advisor report found yet.");
  }
}

async function advisorCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) {
    throw new Error("Usage: mdz-core advisor <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text]");
  }
  const text = await readFile(file, "utf8");
  const recommendation = {
    file,
    ...recommendForSession(text)
  };
  const report = createAdvisorReport(recommendation, {
    mode: options.mode ?? (await readPolicy()).mode
  });
  if (options.writeReports === "true") {
    report.reportFiles = await writeAdvisorReports(report, {
      dir: options.reportDir,
      baseName: options.name
    });
  }
  if (options.format === "text") {
    console.log(renderAdvisorReport(report));
  } else {
    writeJson(report);
  }
}

async function policyCommand(args) {
  const { options, positional } = parseArgs(args);
  const subcommand = positional[0] ?? "show";
  if (subcommand === "show") {
    writeJson(await readPolicy({ file: options.file }));
    return;
  }
  if (subcommand === "set") {
    const mode = options.mode ?? positional[1];
    if (!mode) {
      throw new Error("Usage: mdz-core policy set --mode enabled|observe|suggest|safe|balanced|aggressive");
    }
    const existing = await readPolicy({ file: options.file });
    const updates = {
      ...existing,
      mode,
      minSavingsPercent: options.minSavingsPercent ? Number(options.minSavingsPercent) : undefined,
      maxAutoRisk: options.maxAutoRisk,
      storeOriginals: options.storeOriginals ? options.storeOriginals !== "false" : undefined,
      explainEveryDecision: options.explainEveryDecision ? options.explainEveryDecision !== "false" : undefined,
      visibilityLevel: options.visibilityLevel,
      digestCadence: options.digestCadence,
      reportDir: options.reportDir,
      storeDir: options.storeDir
    };
    writeJson(await writePolicy(compactUndefined(createPolicy(updates)), { file: options.file }));
    return;
  }
  throw new Error("Usage: mdz-core policy [show|set --mode enabled|observe|suggest|safe|balanced|aggressive]");
}

async function applyCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) {
    throw new Error("Usage: mdz-core apply <file> [--type auto|test-output|log-output|session] [--mode enabled|observe|suggest|safe|balanced|aggressive] [--out file] [--write-reports]");
  }
  const text = await readFile(file, "utf8");
  const common = {
    type: options.type ?? "auto",
    mode: options.mode,
    out: options.out,
    storeDir: options.storeDir,
    reportDir: options.reportDir,
    reportName: options.name,
    ledgerFile: options.ledgerFile,
    source: { file },
    writeReports: options.writeReports === "true",
    recordLedger: options.recordLedger !== "false"
  };
  const result = common.type === "session"
    ? await applySessionOptimization(text, common)
    : await applyOptimization(text, common);
  writeJson({
    file,
    ...result,
    reduced: {
      ...result.reduced,
      text: options.includeText === "true" ? result.reduced.text : undefined
    }
  });
}

async function reportSessionCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) {
    throw new Error("Usage: mdz-core report-session <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text] [--write-reports]");
  }
  const maxDeepBytes = Number(options.maxDeepBytes ?? 5 * 1024 * 1024);
  const fileInfo = await stat(file);
  if (options.stream === "true" || fileInfo.size > maxDeepBytes) {
    const report = await scanSessionFile(file, {
      platform: options.platform,
      minLargeTokens: options.minLargeTokens ? Number(options.minLargeTokens) : undefined,
      topLimit: options.topLimit ? Number(options.topLimit) : undefined
    });
    report.note = `Used streaming scan because the session is ${fileInfo.size.toLocaleString("en-US")} bytes; deep report threshold is ${maxDeepBytes.toLocaleString("en-US")} bytes.`;
    if (options.format === "text") {
      console.log(renderSessionScan(report));
    } else {
      writeJson(report);
    }
    return;
  }
  const text = await readFile(file, "utf8");
  const policy = await readPolicy();
  const report = createSessionReport(text, {
    file,
    mode: options.mode ?? policy.mode
  });
  if (options.recordLedger === "true") {
    const applied = await applySessionOptimization(text, {
      mode: report.mode,
      source: { file },
      ledgerFile: options.ledgerFile,
      recordLedger: true
    });
    report.ledger = applied.ledger;
  }
  if (options.writeReports === "true") {
    const { writeSessionReport } = await import("../src/index.js");
    report.reportFiles = await writeSessionReport(report, {
      dir: options.reportDir ?? policy.reportDir,
      baseName: options.name
    });
  }
  if (options.format === "text") {
    console.log(renderSessionReport(report));
  } else {
    writeJson(report);
  }
}

async function scanSessionCommand(args) {
  const { options, positional } = parseArgs(args);
  const files = positional.length ? positional : splitList(options.files);
  const text = options.text;
  if (!files.length && typeof text !== "string") {
    throw new Error("Usage: mdz-core scan-session <session-file...> [--platform codex|antigravity|claude|generic] [--format json|text]");
  }
  const reports = files.length
    ? await Promise.all(files.map((file) => scanSessionFile(file, {
      platform: options.platform,
      minLargeTokens: options.minLargeTokens ? Number(options.minLargeTokens) : undefined,
      topLimit: options.topLimit ? Number(options.topLimit) : undefined,
      repeatLimit: options.repeatLimit ? Number(options.repeatLimit) : undefined
    })))
    : [scanSessionText(text, {
      file: options.file,
      platform: options.platform,
      minLargeTokens: options.minLargeTokens ? Number(options.minLargeTokens) : undefined,
      topLimit: options.topLimit ? Number(options.topLimit) : undefined,
      repeatLimit: options.repeatLimit ? Number(options.repeatLimit) : undefined
    })];
  if (options.format === "text") {
    console.log(reports.map(renderSessionScan).join("\n\n---\n\n"));
  } else {
    writeJson(reports.length === 1 ? reports[0] : { generatedAt: new Date().toISOString(), reports });
  }
}

async function usageReportCommand(args) {
  const { options } = parseArgs(args);
  const report = await createLedgerReport({
    file: options.ledgerFile,
    since: options.since,
    until: options.until,
    mode: options.mode,
    action: options.action,
    type: options.type,
    exampleLimit: options.exampleLimit ? Number(options.exampleLimit) : undefined
  });
  if (options.writeReports === "true") {
    report.reportFiles = await writeLedgerReport(report, {
      dir: options.reportDir,
      baseName: options.name
    });
  }
  if (options.format === "text") {
    console.log(renderLedgerReport(report));
  } else {
    writeJson(report);
  }
}

async function findSessionsCommand(args) {
  const { options } = parseArgs(args);
  const report = await discoverSessions({
    root: options.root,
    home: options.home,
    platform: options.platform ?? "all",
    limit: options.limit ? Number(options.limit) : undefined,
    maxDepth: options.maxDepth ? Number(options.maxDepth) : undefined
  });
  if (options.format === "text") {
    console.log(renderSessionDiscovery(report));
  } else {
    writeJson(report);
  }
}

async function cacheCommand(args) {
  const { options, positional } = parseArgs(args);
  const subcommand = positional[0] ?? "inspect";
  const report = subcommand === "prune"
    ? await pruneCache({
      storeDir: options.storeDir,
      maxAgeDays: options.maxAgeDays,
      maxBytes: options.maxBytes,
      dryRun: options.dryRun !== "false"
    })
    : await inspectCache({ storeDir: options.storeDir, limit: options.limit });
  if (options.format === "text") console.log(renderCacheReport(report));
  else writeJson(report);
}

async function costCommand(args) {
  const { options, positional } = parseArgs(args);
  if ((positional[0] ?? "estimate") === "models") {
    writeJson(listCostModels());
    return;
  }
  writeJson(estimateCost({
    inputTokens: Number(options.inputTokens ?? options.input ?? 0),
    outputTokens: Number(options.outputTokens ?? options.output ?? 0),
    savedInputTokens: Number(options.savedInputTokens ?? options.saved ?? 0),
    savedOutputTokens: Number(options.savedOutputTokens ?? 0)
  }, {
    provider: options.provider,
    model: options.model,
    priceKey: options.priceKey,
    inputPerMillion: options.inputPerMillion,
    outputPerMillion: options.outputPerMillion
  }));
}

async function autopilotCommand(args) {
  const { options } = parseArgs(args);
  const report = await createLedgerReport({ file: options.ledgerFile });
  writeJson(recommendPolicy(report, { targetReduction: options.targetReduction }));
}

async function responseProfileCommand(args) {
  const { options, positional } = parseArgs(args);
  if ((positional[0] ?? "recommend") === "list") {
    writeJson(listResponseProfiles());
    return;
  }
  writeJson(recommendResponseProfile({
    outputTokens: Number(options.outputTokens ?? options.tokens ?? 0)
  }, {
    targetReduction: options.targetReduction
  }));
}

async function outputContractCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text ?? "");
  writeJson(createOutputContract({ prompt: text }, {
    taskType: options.taskType,
    profile: options.profile,
    maxTokens: options.maxTokens,
    maxLines: options.maxLines
  }));
}

async function answerContractCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text ?? "");
  writeJson(createAnswerLengthContract({ prompt: text }, {
    taskType: options.taskType,
    profile: options.profile,
    outputTokens: options.outputTokens,
    maxTokens: options.maxTokens
  }));
}

async function outputBudgetCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text ?? "");
  writeJson(recommendOutputBudget({ prompt: text }, {
    taskType: options.taskType,
    profile: options.profile,
    targetReduction: options.targetReduction
  }));
}

async function auditResponseCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const policy = await readPolicy();
  const audit = auditResponse(text, {
    prompt: options.prompt,
    taskType: options.taskType,
    profile: options.profile,
    maxTokens: options.maxTokens
  });
  if (options.recordLedger !== "false") {
    audit.ledger = await recordLedgerEvent(createAssistantOutputLedgerEvent(audit, {
      mode: options.mode ?? policy.mode,
      action: "observe",
      source: { command: "audit-response", file: positional[0] ?? options.file }
    }), { file: options.ledgerFile });
  }
  writeJson(audit);
}

async function compressResponseCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const policy = await readPolicy();
  const result = compressResponse(text, {
    prompt: options.prompt,
    taskType: options.taskType,
    profile: options.profile,
    maxTokens: options.maxTokens,
    maxLines: options.maxLines
  });
  if (options.recordLedger !== "false") {
    result.ledger = await recordLedgerEvent(createAssistantOutputLedgerEvent(result, {
      mode: options.mode ?? policy.mode,
      action: options.action ?? "apply",
      source: { command: "compress-response", file: positional[0] ?? options.file }
    }), { file: options.ledgerFile });
  }
  if (options.out) await writeFile(options.out, result.compressed, "utf8");
  writeJson({ ...result, compressed: options.includeText === "true" ? result.compressed : undefined, outputFile: options.out });
}

async function toolSchemaCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core tool-schema <schema-file>");
  writeJson(analyzeToolSchema(await readFile(file, "utf8"), {
    limit: options.limit ? Number(options.limit) : undefined
  }));
}

async function compactToolSchemaCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core compact-tool-schema <schema-file> [--out file]");
  const result = compactToolSchemas(await readFile(file, "utf8"), {
    maxToolDescriptionChars: options.maxToolDescriptionChars,
    maxFieldDescriptionChars: options.maxFieldDescriptionChars,
    removeExamples: options.removeExamples !== "false"
  });
  if (options.out && result.compacted) {
    await writeFile(options.out, JSON.stringify(result.compacted, null, 2), "utf8");
  }
  if (options.recordLedger !== "false" && result.metrics) {
    const policy = await readPolicy();
    const action = options.applied === "true" ? "apply" : "observe";
    result.ledger = await recordLedgerEvent({
      source: { command: "compact-tool-schema", file },
      type: "tool-schema",
      mode: policy.mode,
      action,
      tokens: { original: result.metrics.originalTokens, reduced: result.metrics.reducedTokens },
      savings: {
        estimatedSavedTokens: result.metrics.estimatedSavedTokens,
        estimatedPercentSaved: result.metrics.estimatedPercentSaved
      },
      downsides: { addedLocalLatencyMs: 1, localCpuWork: "low", localDiskBytes: 0, qualityRisk: "low", privacyCacheSensitivity: "none" },
      example: {
        technique: "tool-schema-compaction",
        summary: `Shortened documentation-only schema text while preserving validation contracts for ${result.metrics.tools} tools.`,
        before: `${result.metrics.originalTokens} estimated schema tokens`,
        after: action === "apply" ? `${result.metrics.reducedTokens} estimated schema tokens` : "Generated compact catalog; host usage not yet confirmed"
      },
      notes: [result.compatible ? "Tool validation contracts were preserved." : "Compatibility check failed."]
    }, { file: options.ledgerFile });
  }
  writeJson({ ...result, compacted: options.includeCatalog === "true" ? result.compacted : undefined, outputFile: options.out });
}

async function toolDeferralCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core tool-deferral <schema-file> [--max-core-tools n]");
  const result = planToolDeferral(await readFile(file, "utf8"), {
    maxCoreTools: options.maxCoreTools,
    coreTools: splitList(options.coreTools),
    routerOverheadTokens: options.routerOverheadTokens,
    includeCatalog: options.includeCatalog === "true"
  });
  if (options.recordLedger !== "false") {
    const policy = await readPolicy();
    result.ledger = await recordLedgerEvent({
      source: { command: "tool-deferral", file },
      type: "tool-deferral",
      mode: policy.mode,
      action: "observe",
      tokens: { original: result.metrics.fullSchemaTokens, reduced: result.metrics.fullSchemaTokens },
      savings: {
        estimatedSavedTokens: result.metrics.estimatedSavedTokensPerTurn,
        estimatedPercentSaved: result.metrics.estimatedPercentSavedPerTurn
      },
      downsides: { addedLocalLatencyMs: 1, localCpuWork: "low", localDiskBytes: 0, qualityRisk: "low", privacyCacheSensitivity: "none", extraMdzToolCalls: result.downsides.extraSearchCallWhenDeferredToolNeeded },
      example: {
        technique: "tool-schema-deferral",
        summary: `Planned ${result.metrics.coreTools} core tools and ${result.metrics.deferredTools} deferred tools.`,
        before: `${result.metrics.fullSchemaTokens} estimated schema tokens per turn`,
        after: `${result.metrics.estimatedUpfrontTokens} estimated upfront tokens if a gateway applies the plan`
      },
      notes: [result.downsides.warning]
    }, { file: options.ledgerFile });
  }
  writeJson(result);
}

async function toolSearchCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  const query = options.query ?? positional.slice(1).join(" ");
  if (!file || !query) throw new Error("Usage: mdz-core tool-search <schema-file> --query text");
  writeJson(searchToolCatalog(await readFile(file, "utf8"), query, {
    limit: options.limit,
    minScore: options.minScore,
    loadedTools: splitList(options.loadedTools)
  }));
}

async function prefixSnapshotCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core prefix-snapshot <components-json> [--out file]");
  const input = JSON.parse(await readFile(file, "utf8"));
  const snapshot = createPromptPrefixSnapshot(input, {
    model: options.model,
    reasoningEffort: options.reasoningEffort
  });
  if (options.out) await writeFile(options.out, JSON.stringify(snapshot, null, 2), "utf8");
  writeJson({ ...snapshot, outputFile: options.out });
}

async function cacheStabilityCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core cache-stability <current-json> [--previous previous-json]");
  const current = JSON.parse(await readFile(file, "utf8"));
  const previous = options.previous ? JSON.parse(await readFile(options.previous, "utf8")) : undefined;
  writeJson(analyzePromptCacheStability(current, previous, {
    retentionMinutes: options.retentionMinutes,
    previousRequestAt: options.previousRequestAt,
    now: options.now,
    model: options.model,
    reasoningEffort: options.reasoningEffort
  }));
}

async function replaySessionCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core replay-session <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text]");
  const report = replaySession(await readFile(file, "utf8"), {
    mode: options.mode ?? (await readPolicy()).mode
  });
  if (options.format === "text") console.log(renderReplayReport(report));
  else writeJson(report);
}

async function dashboardCommand(args) {
  const { options } = parseArgs(args);
  const dashboard = await createDashboard({
    ledgerFile: options.ledgerFile,
    storeDir: options.storeDir,
    targetReduction: options.targetReduction
  });
  if (options.writeReports === "true") {
    dashboard.reportFiles = await writeDashboard(dashboard, {
      dir: options.reportDir,
      baseName: options.name
    });
  }
  writeJson(dashboard);
}

async function digestCommand(args) {
  const { options } = parseArgs(args);
  const policy = await readPolicy();
  const digest = await createSavingsDigest({
    ledgerFile: options.ledgerFile,
    since: options.since,
    until: options.until,
    markSent: options.markSent === "true",
    visibilityLevel: options.visibilityLevel ?? policy.visibilityLevel,
    cadence: options.cadence ?? policy.digestCadence,
    minSavedTokens: options.minSavedTokens,
    minPotentialTokens: options.minPotentialTokens
  });
  if (options.writeReports === "true") {
    digest.reportFiles = await writeSavingsDigest(digest, {
      dir: options.reportDir,
      baseName: options.name
    });
  }
  if (options.format === "text") console.log(renderSavingsDigest(digest));
  else writeJson(digest);
}

async function feedbackCommand(args) {
  const { options, positional } = parseArgs(args);
  const event = positional[0] ?? options.event;
  if (!event) throw new Error("Usage: mdz-core feedback <event> [--mode mode] [--task-type type] [--savings-percent n]");
  writeJson(await recordFeedback({
    event,
    mode: options.mode,
    taskType: options.taskType,
    action: options.action,
    savingsPercent: options.savingsPercent ? Number(options.savingsPercent) : undefined,
    riskLevel: options.riskLevel,
    handle: options.handle,
    session: options.session,
    note: options.note
  }, { file: options.file, profileFile: options.profileFile }));
}

async function learningReportCommand(args) {
  const { options } = parseArgs(args);
  const report = await createLearningReport({ file: options.file });
  if (options.format === "text") console.log(renderLearningReport(report));
  else writeJson(report);
}

async function classifyTaskCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  writeJson(classifyTask(text));
}

async function budgetCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  writeJson(planContextBudget(text, { targetReduction: options.targetReduction, inputBudget: options.inputBudget, outputBudget: options.outputBudget }));
}

async function contractCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const result = await createTaskContract(text, { storeDir: options.storeDir, storeOriginal: options.storeOriginal !== "false" });
  if (options.out) await writeFile(options.out, result.contract, "utf8");
  writeJson({ ...result, contract: options.includeText === "true" ? result.contract : undefined, outputFile: options.out });
}

async function secretScanCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  writeJson(scanSecrets(text));
}

async function redactCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const result = redactText(text);
  if (options.out) await writeFile(options.out, result.redacted, "utf8");
  writeJson({ ...result, redacted: options.includeText === "true" ? result.redacted : undefined, outputFile: options.out });
}

async function semanticCacheCommand(args) {
  const { options, positional } = parseArgs(args);
  const subcommand = positional[0] ?? "list";
  if (subcommand === "list") {
    writeJson(await listSemanticCache({ cacheDir: options.cacheDir, limit: options.limit }));
    return;
  }
  const file = positional[1] ?? options.file;
  const text = await readInputText(file, options.text);
  if (subcommand === "get") {
    writeJson(await getSemanticCache(text, { cacheDir: options.cacheDir }));
    return;
  }
  if (subcommand === "put") {
    writeJson(await putSemanticCache(text, options.summary ?? text.slice(0, 1000), { cacheDir: options.cacheDir, source: file, tags: options.tags ? options.tags.split(",") : [] }));
    return;
  }
  throw new Error("Usage: mdz-core semantic-cache [list|get|put] [file]");
}

async function repoMapCommand(args) {
  const { options } = parseArgs(args);
  writeJson(await createRepoMemoryMap({ root: options.root, maxFiles: options.maxFiles, maxDepth: options.maxDepth, out: options.out }));
}

async function toolGuardrailsCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text ?? positional.join(" "));
  writeJson(recommendToolGuardrails({ text, tool: options.tool }));
}

async function compactStateCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const result = await createCompactionArtifact(text, { mode: options.mode, storeDir: options.storeDir, storeOriginal: options.storeOriginal !== "false" });
  if (options.out) await writeFile(options.out, result.artifact, "utf8");
  writeJson({ ...result, artifact: options.includeText === "true" ? result.artifact : undefined, outputFile: options.out });
}

async function handoffCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  const result = await createHandoffArtifact(text, { target: options.target, storeDir: options.storeDir });
  if (options.out) await writeFile(options.out, result.artifact, "utf8");
  writeJson({ ...result, artifact: options.includeText === "true" ? result.artifact : undefined, outputFile: options.out });
}

async function diffContextCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  writeJson(analyzeDiffContext(text));
}

async function attributeSavingsCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core attribute-savings <report-json>");
  writeJson(attributeSavings(JSON.parse(await readFile(file, "utf8"))));
}

async function qualityCheckCommand(args) {
  const { options, positional } = parseArgs(args);
  const originalFile = positional[0] ?? options.original;
  const reducedFile = positional[1] ?? options.reduced;
  if (!originalFile || !reducedFile) throw new Error("Usage: mdz-core quality-check <original-file> <reduced-file> [--marker text]");
  writeJson(runQualityHarness(
    await readFile(originalFile, "utf8"),
    await readFile(reducedFile, "utf8"),
    { markers: collectOptionValues(args, "--marker"), minCoverage: options.minCoverage }
  ));
}

async function compressionExperimentCommand(args) {
  const { options, positional } = parseArgs(args);
  const text = await readInputText(positional[0] ?? options.file, options.text);
  writeJson(runCompressionExperiment(text, { limit: options.limit }));
}

async function projectPolicyCommand(args) {
  const { options, positional } = parseArgs(args);
  const subcommand = positional[0] ?? "show";
  if (subcommand === "init" || subcommand === "set") {
    writeJson(await writeProjectPolicy({
      defaults: {
        mode: options.mode,
        targetReduction: options.targetReduction ? Number(options.targetReduction) : undefined,
        cacheRetentionDays: options.cacheRetentionDays ? Number(options.cacheRetentionDays) : undefined
      }
    }, { file: options.file }));
    return;
  }
  writeJson(await readProjectPolicy({ file: options.file }));
}

async function setupCommand(args) {
  const { options } = parseArgs(args);
  writeJson(await runSetupWizard({ root: options.root, platform: options.platform, skipDoctor: options.skipDoctor === "true" }));
}

async function compareCommand(args) {
  const { options, positional } = parseArgs(args);
  const originalFile = positional[0] ?? options.original;
  const reducedFile = positional[1] ?? options.reduced;
  if (!originalFile || !reducedFile) {
    throw new Error("Usage: mdz-core compare <original-file> <reduced-file> [--marker text] [--format json|text]");
  }
  const markers = collectOptionValues(args, "--marker");
  const report = compareContext(
    await readFile(originalFile, "utf8"),
    await readFile(reducedFile, "utf8"),
    {
      markers: markers.length ? markers : undefined,
      requireMarkers: options.requireMarkers !== "false"
    }
  );
  if (options.format === "text") {
    console.log(renderCompareReport(report));
  } else {
    writeJson(report);
  }
}

async function profileCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core profile <file> [--include-text true]");
  const profile = profileContext(await readFile(file, "utf8"), { format: options.formatName });
  writeJson(options.includeText === "true" ? profile : compactProfile(profile));
}

async function evidenceCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core evidence <file>");
  writeJson(extractEvidence(await readFile(file, "utf8"), {
    limit: options.limit ? Number(options.limit) : undefined
  }));
}

async function planCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) throw new Error("Usage: mdz-core plan <file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--include-text true]");
  const plan = createCompressionPlan(await readFile(file, "utf8"), {
    mode: options.mode ?? (await readPolicy()).mode
  });
  writeJson(options.includeText === "true" ? plan : compactPlan(plan));
}

async function sufficiencyCommand(args) {
  const { options, positional } = parseArgs(args);
  const originalFile = positional[0] ?? options.original;
  const reducedFile = positional[1] ?? options.reduced;
  if (!originalFile || !reducedFile) {
    throw new Error("Usage: mdz-core sufficiency <original-file> <reduced-file>");
  }
  writeJson(checkSufficiency(
    await readFile(originalFile, "utf8"),
    await readFile(reducedFile, "utf8")
  ));
}

async function installCommand(args) {
  const { options, positional } = parseArgs(args);
  const platform = positional[0] ?? options.platform ?? "codex";
  const result = await installMdz({
    platform,
    scope: options.scope ?? "project",
    mode: options.mode ?? "enabled",
    root: options.root,
    sourceRoot: options.sourceRoot,
    target: options.target
  });
  writeJson(result);
}

async function uninstallCommand(args) {
  const { options, positional } = parseArgs(args);
  writeJson(await uninstallMdz({
    platform: positional[0] ?? options.platform ?? "codex",
    scope: options.scope ?? "project",
    root: options.root,
    sourceRoot: options.sourceRoot,
    target: options.target,
    purgeData: options.purgeData === "true"
  }));
}

async function gatewayCommand(args) {
  const { options, positional } = parseArgs(args);
  const subcommand = positional[0] ?? "status";
  if (subcommand === "init") {
    writeJson(await initializeGateway({
      root: options.root,
      source: options.from ?? options.source,
      out: options.out,
      rewriteHost: options.rewriteHost === "true"
    }));
    return;
  }
  if (subcommand === "status" || subcommand === "doctor") {
    writeJson(await inspectGateway({ root: options.root, file: options.file }));
    return;
  }
  throw new Error("Usage: mdz-core gateway init|status [--from mcp-config.json] [--rewrite-host]");
}

async function doctorCommand(args) {
  const { options, positional } = parseArgs(args);
  const report = await runDoctor({
    platform: positional[0] ?? options.platform ?? "all",
    root: options.root,
    sourceRoot: options.sourceRoot,
    target: options.target,
    quickBenchmark: options.quickBenchmark === "true"
  });
  if (options.format === "text") {
    console.log(renderDoctorReport(report));
  } else {
    writeJson(report);
  }
}

async function recommendCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = positional[0] ?? options.file;
  if (!file) {
    throw new Error("Usage: mdz-core recommend <session-file>");
  }
  const text = await readFile(file, "utf8");
  writeJson({
    file,
    ...recommendForSession(text)
  });
}

async function benchmarksCommand() {
  writeJson({
    scenarios: listBenchmarkScenarios()
  });
}

async function benchmarkCommand(args) {
  const { options, positional } = parseArgs(args);
  const scenario = positional[0] ?? "suite";
  const benchmarkOptions = {
    mode: options.mode,
    out: options.out,
    storeDir: options.storeDir
  };

  if (scenario === "suite") {
    writeJson(await runBenchmarkSuite(benchmarkOptions));
  } else if (scenario === "custom") {
    if (!options.file) {
      throw new Error("Usage: mdz-core benchmark custom --file <path> [--type session|test-output|log-output]");
    }
    writeJson(await runBenchmarkScenario({
      id: "custom",
      name: options.name ?? "Custom Benchmark",
      fixture: options.file,
      type: options.type ?? "session",
      mode: options.mode,
      successMarkers: options.marker ? [options.marker] : []
    }, benchmarkOptions));
  } else {
    writeJson(await runBenchmarkScenario(scenario, benchmarkOptions));
  }
}

async function estimateCommand(args) {
  const file = requiredPositional(args, "estimate <file>");
  const text = await readFile(file, "utf8");
  writeJson({
    file,
    estimate: estimateTokens(text)
  });
}

async function filterOutputCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = requiredPositional(positional, "filter-output [--kind test|log|auto] <file>");
  const text = await readFile(file, "utf8");
  const result = filterOutput(text, {
    kind: options.kind ?? "auto",
    maxLines: options.maxLines ? Number(options.maxLines) : undefined,
    windowSize: options.windowSize ? Number(options.windowSize) : undefined
  });

  if (options.out) {
    await writeFile(options.out, result.reduced, "utf8");
  }

  writeJson({
    file,
    outputFile: options.out,
    ...result,
    reduced: options.includeText === "true" ? result.reduced : undefined
  });
}

async function storeCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = requiredPositional(positional, "store [--store-dir .mdz/store] <file>");
  const text = await readFile(file, "utf8");
  const stored = await storeContext(text, {
    storeDir: options.storeDir
  });
  writeJson({
    file,
    ...stored
  });
}

async function expandCommand(args) {
  const { options, positional } = parseArgs(args);
  const handle = requiredPositional(positional, "expand [--store-dir .mdz/store] <handle>");
  const text = await expandContext(handle, {
    storeDir: options.storeDir,
    startLine: options.startLine,
    endLine: options.endLine
  });

  if (options.out) {
    await writeFile(options.out, text, "utf8");
    writeJson({ handle, outputFile: options.out, chars: text.length });
  } else {
    process.stdout.write(text);
  }
}

async function analyzeSessionCommand(args) {
  const { options, positional } = parseArgs(args);
  const file = requiredPositional(positional, "analyze-session <file>");
  const text = await readFile(file, "utf8");
  const analysis = analyzeSession(text);
  const report = createUsageReport(
    {
      expected: {
        totalTokens: analysis.totalTokens,
        savedTokens: analysis.expected.savedTokens,
        addedLatencyMs: analysis.expected.addedLatencyMs,
        localDiskBytes: analysis.expected.localDiskBytes,
        localCpuWork: analysis.expected.localCpuWork
      },
      riskLevel: highestOpportunityRisk(analysis.opportunities),
      analysis
    },
    { mode: options.mode ?? "enabled" }
  );
  writeJson(report);
}

function parseArgs(args) {
  const options = {};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      const key = toCamelCase(arg.slice(2));
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        options[key] = "true";
      } else {
        options[key] = next;
        index += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

function requiredPositional(args, usage) {
  const value = Array.isArray(args) ? args[0] : args;
  if (!value) {
    throw new Error(`Usage: mdz-core ${usage}`);
  }
  return value;
}

function highestOpportunityRisk(opportunities) {
  const risks = opportunities.map((item) => item.riskLevel);
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  if (risks.includes("low")) return "low";
  return "unknown";
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function splitList(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function writeJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function readInputText(file, text) {
  if (typeof text === "string") return text;
  if (file) return readFile(file, "utf8");
  throw new Error("Provide a file path or --text.");
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

function compactUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function collectOptionValues(args, optionName) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === optionName && args[index + 1] && !args[index + 1].startsWith("--")) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function printHelp() {
  console.log(`MDZ core CLI

Usage:
  mdz-core estimate <file>
  mdz-core filter-output [--kind test|log|auto] [--out file] <file>
  mdz-core store [--store-dir dir] <file>
  mdz-core expand [--store-dir dir] [--start-line n] [--end-line n] [--out file] <handle>
  mdz-core analyze-session <file>
  mdz-core benchmarks
  mdz-core benchmark [suite|scenario-id] [--mode enabled|observe|suggest|safe|balanced|aggressive] [--out file]
  mdz-core benchmark custom --file <path> [--type session|test-output|log-output] [--marker text]
  mdz-core recommend <session-file>
  mdz-core advisor <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text] [--write-reports]
  mdz-core latest-advice [--format json]
  mdz-core policy [show|set --mode enabled|observe|suggest|safe|balanced|aggressive --visibility-level visible|digest|quiet]
  mdz-core apply <file> [--type auto|test-output|log-output|session] [--mode enabled|observe|suggest|safe|balanced|aggressive] [--out file] [--write-reports]
  mdz-core report-session <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text] [--write-reports] [--record-ledger] [--stream true]
  mdz-core scan-session <session-file...> [--platform codex|antigravity|claude|generic] [--format json|text]
  mdz-core usage-report [--format json|text] [--write-reports] [--since date] [--mode mode] [--action action] [--example-limit 5]
  mdz-core find-sessions [--platform all|codex|claude|antigravity|generic] [--root dir] [--limit n] [--format json|text]
  mdz-core cache [inspect|prune] [--store-dir dir] [--max-age-days n] [--max-bytes n] [--dry-run false] [--format json|text]
  mdz-core cost [models|estimate] [--provider name --model name] [--input-tokens n] [--output-tokens n] [--saved-input-tokens n]
  mdz-core autopilot [--target-reduction 0.3] [--ledger-file file]
  mdz-core response-profile [list|recommend] [--output-tokens n] [--target-reduction 0.3]
  mdz-core output-contract [file|--text text] [--task-type type] [--profile terse|standard|detailed]
  mdz-core answer-contract [file|--text text] [--max-tokens n]
  mdz-core output-budget [file|--text text] [--target-reduction 0.3]
  mdz-core audit-response <response-file> [--max-tokens n]
  mdz-core compress-response <response-file> [--out file] [--include-text true]
  mdz-core tool-schema <schema-file>
  mdz-core compact-tool-schema <schema-file> [--out file] [--include-catalog true]
  mdz-core tool-deferral <schema-file> [--max-core-tools n] [--core-tools name,name]
  mdz-core tool-search <schema-file> --query text [--loaded-tools name,name]
  mdz-core prefix-snapshot <components-json> [--out file]
  mdz-core cache-stability <current-json> [--previous previous-json] [--retention-minutes n]
  mdz-core replay-session <session-file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--format json|text]
  mdz-core dashboard [--write-reports] [--target-reduction 0.3]
  mdz-core digest [--format json|text] [--write-reports] [--mark-sent true]
  mdz-core feedback <event> [--mode mode] [--task-type type] [--savings-percent n]
  mdz-core learning-report [--format json|text]
  mdz-core classify-task <file>
  mdz-core budget <file> [--target-reduction 0.3]
  mdz-core contract <file> [--out file]
  mdz-core secret-scan <file>
  mdz-core redact <file> [--out file]
  mdz-core semantic-cache [list|get|put] [file]
  mdz-core repo-map [--root dir] [--out file]
  mdz-core tool-guardrails [file|--text text]
  mdz-core compact-state <session-file> [--out file]
  mdz-core handoff <session-file> [--target codex|claude|antigravity|generic] [--out file]
  mdz-core diff-context <diff-file>
  mdz-core attribute-savings <report-json>
  mdz-core quality-check <original-file> <reduced-file> [--marker text]
  mdz-core compression-experiment <file>
  mdz-core project-policy [show|init|set]
  mdz-core setup [--platform all|codex|claude|antigravity|generic]
  mdz-core compare <original-file> <reduced-file> [--marker text] [--format json|text]
  mdz-core profile <file> [--include-text true]
  mdz-core evidence <file>
  mdz-core plan <file> [--mode enabled|observe|suggest|safe|balanced|aggressive] [--include-text true]
  mdz-core sufficiency <original-file> <reduced-file>
  mdz-core install codex|claude|antigravity|generic [--scope project|user] [--mode enabled|observe|suggest|safe|balanced|aggressive] [--target project-dir]
  mdz-core uninstall codex|claude|antigravity|generic [--scope project|user] [--target project-dir] [--purge-data]
  mdz-core gateway init [--from mcp-config.json] [--out .mdz/gateway.json] [--rewrite-host]
  mdz-core gateway status [--file .mdz/gateway.json]
  mdz-core doctor codex|claude|antigravity|generic|all [--target project-dir] [--quick-benchmark]
  mdz-core doctor [all|codex|claude|antigravity|generic] [--format json|text] [--quick-benchmark]
`);
}
