import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isCodexJsonl, parseCodexSessionJsonl } from "./codex-session.js";
import { checkSufficiency } from "./sufficiency-checker.js";
import { filterLogOutput, filterOutput, filterTestOutput } from "./filters.js";
import { storeContext } from "./handles.js";
import { analyzeSession } from "./session-analyzer.js";
import { estimateTokens } from "./token-estimator.js";

const BUILTIN_SCENARIOS = {
  "verbose-test-failure": {
    id: "verbose-test-failure",
    name: "Verbose Test Failure",
    fixture: "benchmarks/fixtures/verbose-test-failure.txt",
    type: "test-output",
    defaultMode: "safe",
    successMarkers: ["FAIL auth validates expired token", "AssertionError", "Expected status 401"]
  },
  "large-log-root-cause": {
    id: "large-log-root-cause",
    name: "Large Log Root Cause",
    fixture: "benchmarks/fixtures/large-log-root-cause.txt",
    type: "log-output",
    defaultMode: "safe",
    successMarkers: ["database timeout", "connection pool exhausted", "login failed"]
  },
  "repo-exploration": {
    id: "repo-exploration",
    name: "Repo Exploration",
    fixture: "benchmarks/fixtures/repo-exploration-session.txt",
    type: "session",
    defaultMode: "observe",
    successMarkers: ["packages/mdz-core/src/token-estimator.js", "benchmark report"]
  }
};

export function listBenchmarkScenarios() {
  return Object.values(BUILTIN_SCENARIOS).map(({ id, name, type, fixture, defaultMode }) => ({
    id,
    name,
    type,
    fixture,
    defaultMode
  }));
}

export async function runBenchmarkScenario(idOrOptions, options = {}) {
  const scenario = resolveScenario(idOrOptions, options);
  const started = performance.now();
  const original = await loadScenarioInput(scenario);
  const baseline = createBaseline(original, scenario);
  const mdz = await applyMdz(original, scenario, options);
  const ended = performance.now();
  const report = createBenchmarkReport({
    scenario,
    baseline,
    mdz,
    elapsedMs: Math.max(1, Math.round(ended - started))
  });

  if (options.out) {
    await writeFile(options.out, JSON.stringify(report, null, 2), "utf8");
  }

  return report;
}

export async function runBenchmarkSuite(options = {}) {
  const scenarioIds = options.scenarios?.length ? options.scenarios : Object.keys(BUILTIN_SCENARIOS).slice(0, 3);
  const reports = [];
  for (const id of scenarioIds) {
    reports.push(await runBenchmarkScenario(id, options));
  }

  const totals = reports.reduce(
    (acc, report) => {
      acc.baselineTokens += report.baseline.estimatedTotalTokens;
      acc.mdzTokens += report.mdz.estimatedTotalTokens;
      acc.savedTokens += report.savings.estimatedTokensSaved;
      acc.addedLocalLatencyMs += report.downsides.addedLocalLatencyMs;
      acc.localDiskBytes += report.downsides.localDiskBytes;
      acc.extraMdzToolCalls += report.downsides.extraMdzToolCalls;
      acc.handleExpansions += report.downsides.handleExpansions;
      return acc;
    },
    {
      baselineTokens: 0,
      mdzTokens: 0,
      savedTokens: 0,
      addedLocalLatencyMs: 0,
      localDiskBytes: 0,
      extraMdzToolCalls: 0,
      handleExpansions: 0
    }
  );

  const suite = {
    generatedAt: new Date().toISOString(),
    scenarioCount: reports.length,
    totals: {
      ...totals,
      estimatedPercentSaved: totals.baselineTokens === 0 ? 0 : totals.savedTokens / totals.baselineTokens
    },
    reports
  };

  if (options.out) {
    await writeFile(options.out, JSON.stringify(suite, null, 2), "utf8");
  }

  return suite;
}

function resolveScenario(idOrOptions, options) {
  if (typeof idOrOptions === "object" && idOrOptions !== null) {
    return {
      id: idOrOptions.id ?? "custom",
      name: idOrOptions.name ?? "Custom Benchmark",
      fixture: idOrOptions.fixture,
      type: idOrOptions.type ?? "session",
      defaultMode: idOrOptions.mode ?? options.mode ?? "observe",
      successMarkers: idOrOptions.successMarkers ?? []
    };
  }

  const scenario = BUILTIN_SCENARIOS[idOrOptions];
  if (!scenario) {
    throw new Error(`Unknown benchmark scenario: ${idOrOptions}`);
  }
  return {
    ...scenario,
    defaultMode: options.mode ?? scenario.defaultMode
  };
}

async function loadScenarioInput(scenario) {
  const fixture = await readFile(scenario.fixture, "utf8");
  if (scenario.id === "verbose-test-failure") {
    return expandTestFixture(fixture);
  }
  if (scenario.id === "large-log-root-cause") {
    return expandLogFixture(fixture);
  }
  if (scenario.id === "repo-exploration") {
    return expandSessionFixture(fixture);
  }
  return fixture;
}

function createBaseline(original, scenario) {
  const estimate = estimateTokens(original);
  return {
    mode: "baseline",
    type: scenario.type,
    estimatedInputTokens: estimate.tokens,
    estimatedOutputTokens: estimateOutputTokens(original, scenario.type, "baseline"),
    estimatedTotalTokens: estimate.tokens + estimateOutputTokens(original, scenario.type, "baseline"),
    chars: original.length,
    lines: countLines(original)
  };
}

async function applyMdz(original, scenario, options) {
  const mode = options.mode ?? scenario.defaultMode;
  if (mode === "observe") {
    const analysis = analyzeSession(original);
    return {
      mode,
      reducedText: original,
      estimatedInputTokens: estimateTokens(original).tokens,
      estimatedOutputTokens: estimateOutputTokens(original, scenario.type, mode),
      riskLevel: "unknown",
      notes: ["Observe mode does not alter context."],
      metrics: {
        savedTokens: 0,
        estimatedLatencyMs: analysis.expected.addedLatencyMs,
        estimatedDiskBytes: analysis.expected.localDiskBytes,
        estimatedCpuWork: analysis.expected.localCpuWork
      },
      handles: [],
      analysis,
      originalText: original
    };
  }

  const filtered = filterByScenario(original, scenario);
  const handles = [];
  if (["safe", "balanced", "aggressive", "suggest", "enabled"].includes(mode)) {
    const stored = await storeContext(original, {
      storeDir: options.storeDir ?? ".mdz/benchmark-store"
    });
    handles.push({
      handle: stored.handle,
      bytes: stored.bytes
    });
  }

  const estimatedInputTokens = estimateTokens(filtered.reduced).tokens;
  const estimatedOutputTokens = estimateOutputTokens(filtered.reduced, scenario.type, mode);
  return {
    mode,
    reducedText: filtered.reduced,
    estimatedInputTokens,
    estimatedOutputTokens,
    riskLevel: filtered.riskLevel,
    notes: filtered.notes,
    metrics: filtered.metrics,
    handles,
    originalText: original
  };
}

function filterByScenario(original, scenario) {
  if (scenario.type === "test-output") return filterTestOutput(original);
  if (scenario.type === "log-output") return filterLogOutput(original);
  if (scenario.type === "session") return reduceSessionContext(original);
  return filterOutput(original, { kind: "auto" });
}

function reduceSessionContext(original) {
  if (isCodexJsonl(original)) {
    return reduceCodexJsonlSession(original);
  }
  const lines = String(original ?? "").split(/\r?\n/);
  const counts = new Map();
  const reduced = [];
  let collapsed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const count = counts.get(trimmed) ?? 0;
    counts.set(trimmed, count + 1);
    if (trimmed.length > 40 && count > 0) {
      collapsed += 1;
      continue;
    }
    reduced.push(line);
  }

  const header = [
    "MDZ reduced session context",
    `Original lines: ${lines.length}`,
    `Repeated long lines collapsed: ${collapsed}`,
    ""
  ];
  const reducedText = [...header, ...reduced].join("\n");
  const originalEstimate = estimateTokens(original);
  const reducedEstimate = estimateTokens(reducedText);

  return {
    kind: "session",
    reduced: reducedText,
    riskLevel: "medium",
    notes: ["Collapsed repeated long session lines and retained original behind a handle."],
    metrics: {
      originalTokens: originalEstimate.tokens,
      reducedTokens: reducedEstimate.tokens,
      savedTokens: Math.max(0, originalEstimate.tokens - reducedEstimate.tokens),
      percentSaved: originalEstimate.tokens === 0 ? 0 : Math.max(0, originalEstimate.tokens - reducedEstimate.tokens) / originalEstimate.tokens,
      originalChars: original.length,
      reducedChars: reducedText.length,
      estimatedLatencyMs: Math.max(1, Math.round(original.length / 150000)),
      estimatedCpuWork: original.length > 1000000 ? "medium" : "low",
      estimatedDiskBytes: Buffer.byteLength(original, "utf8")
    }
  };
}

function reduceCodexJsonlSession(original) {
  const parsed = parseCodexSessionJsonl(original);
  const keepKinds = new Set(["user_prompt", "assistant_message"]);
  const reducedLines = [
    "MDZ reduced Codex JSONL session",
    `Events: ${parsed.events}`,
    `Segments: ${parsed.totals.segmentCount}`,
    "",
    "Segment summary:",
    ...Object.entries(parsed.totals.byKind).map(([kind, value]) => `- ${kind}: ${value.count} segments, ${value.tokens} tokens`),
    "",
    "Top opportunities:",
    ...parsed.opportunities.slice(0, 12).map((item) => `- ${item.type}: save ~${item.estimatedSavedTokens} tokens, risk=${item.riskLevel}, line=${item.source?.lineNumber ?? "n/a"}`),
    "",
    "Retained conversation excerpts:"
  ];

  for (const segment of parsed.segments) {
    if (!keepKinds.has(segment.kind)) continue;
    if (segment.tokens > 600) {
      reducedLines.push(`[${segment.kind} line ${segment.lineNumber}] ${segment.preview}`);
    } else {
      reducedLines.push(`[${segment.kind} line ${segment.lineNumber}] ${segment.text}`);
    }
  }

  const reducedText = reducedLines.join("\n");
  const originalEstimate = estimateTokens(original);
  const reducedEstimate = estimateTokens(reducedText);

  return {
    kind: "codex-jsonl-session",
    reduced: reducedText,
    riskLevel: "medium",
    notes: ["Parsed Codex JSONL by event type, retained conversation excerpts, summarized tool outputs and stable instructions behind a handle."],
    metrics: {
      originalTokens: originalEstimate.tokens,
      reducedTokens: reducedEstimate.tokens,
      savedTokens: Math.max(0, originalEstimate.tokens - reducedEstimate.tokens),
      percentSaved: originalEstimate.tokens === 0 ? 0 : Math.max(0, originalEstimate.tokens - reducedEstimate.tokens) / originalEstimate.tokens,
      originalChars: original.length,
      reducedChars: reducedText.length,
      estimatedLatencyMs: Math.max(2, Math.round(original.length / 150000)),
      estimatedCpuWork: original.length > 3000000 ? "high" : original.length > 250000 ? "medium" : "low",
      estimatedDiskBytes: Buffer.byteLength(original, "utf8")
    }
  };
}

function createBenchmarkReport({ scenario, baseline, mdz, elapsedMs }) {
  const mdzTotal = mdz.estimatedInputTokens + mdz.estimatedOutputTokens;
  const savedTokens = Math.max(0, baseline.estimatedTotalTokens - mdzTotal);
  const quality = assessQuality(mdz.reducedText, scenario.successMarkers);
  const sufficiency = checkSufficiency(mdz.originalText ?? "", mdz.reducedText, {
    markers: scenario.successMarkers,
    minCoverage: 0.65
  });

  return {
    generatedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      name: scenario.name,
      type: scenario.type,
      fixture: path.normalize(scenario.fixture)
    },
    baseline,
    mdz: {
      mode: mdz.mode,
      estimatedInputTokens: mdz.estimatedInputTokens,
      estimatedOutputTokens: mdz.estimatedOutputTokens,
      estimatedTotalTokens: mdzTotal,
      riskLevel: mdz.riskLevel,
      notes: mdz.notes,
      handlesCreated: mdz.handles.length,
      handleBytesStored: mdz.handles.reduce((sum, item) => sum + item.bytes, 0)
    },
    savings: {
      estimatedInputTokens: baseline.estimatedInputTokens,
      estimatedOutputTokens: baseline.estimatedOutputTokens,
      estimatedTotalTokens: baseline.estimatedTotalTokens,
      estimatedTokensSaved: savedTokens,
      estimatedPercentSaved: baseline.estimatedTotalTokens === 0 ? 0 : savedTokens / baseline.estimatedTotalTokens
    },
    downsides: {
      addedLocalLatencyMs: mdz.metrics.estimatedLatencyMs ?? elapsedMs,
      addedWallClockLatencyMs: elapsedMs,
      localCpuWork: mdz.metrics.estimatedCpuWork ?? "low",
      localMemoryBytes: estimateMemoryBytes(baseline.chars),
      localDiskBytes: mdz.handles.reduce((sum, item) => sum + item.bytes, 0),
      extraMdzToolCalls: estimateMdzToolCalls(mdz.mode, mdz.handles.length),
      userApprovalPrompts: ["suggest", "enabled"].includes(mdz.mode) ? 1 : 0,
      handleExpansions: 0,
      qualityRisk: mdz.riskLevel,
      privacyCacheSensitivity: mdz.handles.length ? "stores-original-locally" : "none"
    },
    quality,
    sufficiency: {
      sufficient: sufficiency.sufficient,
      coverage: sufficiency.coverage,
      riskLevel: sufficiency.riskLevel,
      missingMarkers: sufficiency.missingMarkers
    },
    workflowBreakage: quality.passed ? "none-detected" : "possible"
  };
}

function assessQuality(reducedText, markers) {
  const missing = markers.filter((marker) => !reducedText.includes(marker));
  return {
    passed: missing.length === 0,
    markersChecked: markers.length,
    missingMarkers: missing
  };
}

function estimateOutputTokens(text, type, mode) {
  const input = estimateTokens(text).tokens;
  const baselineRatio = type === "session" ? 0.2 : 0.12;
  const modeDiscount = mode === "aggressive" ? 0.35 : mode === "balanced" ? 0.2 : mode === "safe" ? 0.1 : 0;
  return Math.max(20, Math.round(input * Math.max(0.04, baselineRatio - modeDiscount)));
}

function estimateMemoryBytes(chars) {
  return chars * 2;
}

function estimateMdzToolCalls(mode, handles) {
  if (mode === "observe") return 1;
  return 1 + handles;
}

function countLines(text) {
  return String(text ?? "").split(/\r?\n/).length;
}

function expandTestFixture(fixture) {
  const passing = Array.from({ length: 350 }, (_, index) => `PASS generated regression case ${index + 1}`);
  const noisySetup = Array.from({ length: 80 }, (_, index) => {
    return `debug auth-fixture seed=${index} tenant=tenant_${index % 9} elapsed_ms=${10 + (index % 7)}`;
  });
  return [...passing.slice(0, 175), ...noisySetup, fixture, ...passing.slice(175)].join("\n");
}

function expandLogFixture(fixture) {
  const info = Array.from({ length: 500 }, (_, index) => {
    const second = String(index % 60).padStart(2, "0");
    return `2026-06-16T09:${String(index % 58).padStart(2, "0")}:${second}.000Z INFO request complete method=GET path=/health status=200 duration_ms=${4 + (index % 12)} request_id=req_noise_${index}`;
  });
  const repeatedWarning = Array.from({ length: 120 }, (_, index) => {
    return `2026-06-16T10:01:${String(index % 60).padStart(2, "0")}.000Z WARN database pool usage high active=48 idle=2 max=50 request_id=req_pool_${index}`;
  });
  return [...info.slice(0, 250), fixture, ...repeatedWarning, ...info.slice(250)].join("\n");
}

function expandSessionFixture(fixture) {
  const repeatedReads = Array.from({ length: 24 }, () => {
    return [
      "tool output:",
      "export function estimateTokens(input) {",
      "  const text = String(input ?? \"\");",
      "  const matches = text.match(/[A-Za-z0-9_]+|[^\\sA-Za-z0-9_]/g) ?? [];",
      "  const charEstimate = Math.ceil(text.length / 4);",
      "  return Math.max(matches.length, charEstimate);",
      "}"
    ].join("\n");
  });
  return [fixture, ...repeatedReads].join("\n");
}
