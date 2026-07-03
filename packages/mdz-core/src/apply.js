import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareContext } from "./compare.js";
import { createCompressionPlan } from "./compression-planner.js";
import { filterLogOutput, filterOutput, filterTestOutput } from "./filters.js";
import { storeContext } from "./handles.js";
import { estimateTokens } from "./token-estimator.js";
import { writeAdvisorReports, createAdvisorReport } from "./advisor.js";
import { recommendForSession } from "./codex-session.js";
import { recordLedgerEvent } from "./ledger.js";
import { readPolicy } from "./policy-store.js";
import { analyzeSession } from "./session-analyzer.js";
import { checkSufficiency } from "./sufficiency-checker.js";

export async function applyOptimization(text, options = {}) {
  const policy = options.policy ?? await readPolicy();
  const type = options.type ?? "auto";
  const mode = options.mode ?? policy.mode;
  const original = String(text ?? "");
  const stored = policy.storeOriginals === false
    ? null
    : await storeContext(original, { storeDir: options.storeDir ?? policy.storeDir });
  const filtered = filterByType(original, type);
  const recommendation = {
    format: type,
    recommendation: filtered.metrics.savedTokens > 0 ? "use" : "skip",
    totalTokens: filtered.metrics.originalTokens,
    estimatedSavedTokens: filtered.metrics.savedTokens,
    estimatedPercentSaved: filtered.metrics.percentSaved,
    reason: filtered.metrics.savedTokens > 0
      ? `MDZ can reduce this ${type} input using deterministic filtering.`
      : "MDZ did not find a useful reduction for this input.",
    downsides: {
      addedLocalLatencyMs: filtered.metrics.estimatedLatencyMs,
      localCpuWork: filtered.metrics.estimatedCpuWork,
      localDiskBytes: stored?.bytes ?? 0,
      qualityRisk: filtered.riskLevel,
      privacyCacheSensitivity: stored ? "stores-original-locally" : "none",
      userApprovalPrompts: mode === "suggest" ? 1 : 0
    },
    topOpportunities: [{
      type: `${filtered.kind}-filter`,
      estimatedSavedTokens: filtered.metrics.savedTokens,
      riskLevel: filtered.riskLevel,
      reason: filtered.notes.join(" ")
    }]
  };
  const advisor = createAdvisorReport(recommendation, { mode });
  const result = {
    generatedAt: new Date().toISOString(),
    mode,
    type,
    action: advisor.action,
    handle: stored?.handle,
    original: {
      tokens: filtered.metrics.originalTokens,
      chars: filtered.metrics.originalChars
    },
    reduced: {
      text: filtered.reduced,
      tokens: estimateTokens(filtered.reduced).tokens,
      chars: filtered.reduced.length
    },
    savings: {
      estimatedSavedTokens: filtered.metrics.savedTokens,
      estimatedPercentSaved: filtered.metrics.percentSaved
    },
    downsides: advisor.downsides,
    advisor
  };

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, filtered.reduced, "utf8");
    result.outputFile = options.out;
  }

  if (options.writeReports) {
    result.reportFiles = await writeAdvisorReports(advisor, {
      dir: options.reportDir ?? policy.reportDir,
      baseName: options.reportName
    });
  }

  if (options.recordLedger !== false) {
    result.ledger = await recordLedgerEvent({
      source: options.source,
      type,
      mode,
      action: advisor.action,
      original: result.original,
      reduced: result.reduced,
      savings: result.savings,
      downsides: advisor.downsides,
      handle: result.handle,
      example: {
        technique: `${filtered.kind}-output-filtering`,
        summary: filtered.notes[0],
        before: `${filtered.metrics.originalLines} lines / ${filtered.metrics.originalTokens} estimated tokens`,
        after: `${filtered.metrics.reducedLines} lines / ${filtered.metrics.reducedTokens} estimated tokens`
      },
      notes: filtered.notes
    }, { file: options.ledgerFile ?? policy.ledgerFile });
  }

  return result;
}

export async function applySessionOptimization(text, options = {}) {
  const policy = options.policy ?? await readPolicy();
  const mode = options.mode ?? policy.mode;
  const original = String(text ?? "");
  const stored = policy.storeOriginals === false
    ? null
    : await storeContext(original, { storeDir: options.storeDir ?? policy.storeDir });
  const recommendation = recommendForSession(original);
  const advisor = createAdvisorReport(recommendation, { mode });
  const analysis = analyzeSession(original);
  const plan = createCompressionPlan(original, { mode });
  const summary = renderSessionArtifact({
    recommendation,
    advisor,
    analysis,
    plan,
    handle: stored?.handle,
    source: options.source
  });
  const comparison = compareContext(original, summary, {
    markers: collectSessionMarkers(recommendation, analysis),
    requireMarkers: false
  });
  const sufficiency = checkSufficiency(original, summary, {
    evidence: plan.evidence,
    minCoverage: mode === "aggressive" ? 0.5 : mode === "balanced" ? 0.6 : 0.65
  });
  const artifactTokens = estimateTokens(summary).tokens;
  const effectiveReducedTokens = advisor.action === "skip"
    ? recommendation.totalTokens
    : artifactTokens;
  const result = {
    generatedAt: new Date().toISOString(),
    mode,
    type: "session",
    action: advisor.action,
    handle: stored?.handle,
    analysis: {
      format: analysis.format ?? recommendation.format,
      totalTokens: analysis.totalTokens,
      totalChars: analysis.totalChars,
      opportunityCount: analysis.opportunities?.length ?? 0,
      segmentSummary: analysis.segmentSummary,
      largestContributors: analysis.largestContributors?.slice(0, 10)
    },
    plan: {
      recommendation: plan.recommendation,
      summary: plan.summary,
      actions: plan.actions.slice(0, 20)
    },
    reduced: {
      text: summary,
      tokens: effectiveReducedTokens,
      chars: advisor.action === "skip" ? original.length : summary.length,
      artifactTokens,
      artifactChars: summary.length
    },
    savings: advisor.savings,
    downsides: advisor.downsides,
    comparison,
    sufficiency,
    advisor
  };

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, summary, "utf8");
    result.outputFile = options.out;
  }

  if (options.writeReports) {
    result.reportFiles = await writeAdvisorReports(advisor, {
      dir: options.reportDir ?? policy.reportDir,
      baseName: options.reportName
    });
  }

  if (options.recordLedger !== false) {
    result.ledger = await recordLedgerEvent({
      source: options.source,
      type: "session",
      mode,
      action: advisor.action,
      tokens: {
        original: recommendation.totalTokens,
        reduced: result.reduced.tokens
      },
      savings: advisor.savings,
      downsides: advisor.downsides,
      handle: result.handle,
      example: {
        technique: "session-compaction",
        summary: "Collapsed repeated or low-value session context while retaining evidence and an original-content handle.",
        before: `${recommendation.totalTokens} estimated session tokens`,
        after: `${result.reduced.tokens} estimated session tokens`
      },
      notes: [
        ...(recommendation.topOpportunities?.map((item) => item.reason) ?? []),
        `comparison=${comparison.passed ? "passed" : "needs-review"} risk=${comparison.riskLevel}`,
        `sufficiency=${sufficiency.sufficient ? "sufficient" : "expand-first"} coverage=${Math.round(sufficiency.coverage * 100)}%`
      ]
    }, { file: options.ledgerFile ?? policy.ledgerFile });
  }

  return result;
}

function filterByType(text, type) {
  if (type === "test-output") return filterTestOutput(text);
  if (type === "log-output") return filterLogOutput(text);
  return filterOutput(text, { kind: "auto" });
}

function renderSessionArtifact({ recommendation, advisor, analysis, plan, handle, source }) {
  const opportunities = recommendation.topOpportunities?.length
    ? recommendation.topOpportunities
    : analysis.opportunities ?? [];
  const contributors = analysis.largestContributors ?? [];
  const segmentSummary = analysis.segmentSummary ?? recommendation.segmentSummary ?? {};
  return [
    "# MDZ Reduced Session Artifact v2",
    "",
    "## Source",
    "",
    `- Source: ${source?.file ?? source?.type ?? "provided text"}`,
    `- Original handle: ${handle ?? "not stored"}`,
    `- Original estimated tokens: ${formatNumber(recommendation.totalTokens ?? analysis.totalTokens)}`,
    `- Original chars: ${formatNumber(analysis.totalChars)}`,
    "",
    "## Decision",
    "",
    `- Mode: ${advisor.mode}`,
    `- Action: ${advisor.action}`,
    `- Recommendation: ${recommendation.recommendation}`,
    `- Reason: ${recommendation.reason}`,
    `- Estimated savings: ${formatPercent(recommendation.estimatedPercentSaved)} (${formatNumber(recommendation.estimatedSavedTokens)} tokens)`,
    "",
    "## Downsides",
    "",
    `- Added local latency: ${advisor.downsides.addedLocalLatencyMs} ms`,
    `- Local CPU: ${advisor.downsides.localCpuWork}`,
    `- Local cache: ${formatBytes(advisor.downsides.localDiskBytes)}`,
    `- Quality risk: ${advisor.downsides.qualityRisk}`,
    `- Privacy/cache: ${advisor.downsides.privacyCacheSensitivity}`,
    `- User prompts: ${advisor.downsides.userApprovalPrompts}`,
    "",
    "Top opportunities:",
    ...renderOpportunities(opportunities),
    "",
    "## Compression Plan",
    "",
    `- Plan recommendation: ${plan.recommendation}`,
    `- Planned saved tokens: ${formatNumber(plan.summary.estimatedSavedTokens)} (${formatPercent(plan.summary.estimatedPercentSaved)})`,
    `- Highest planned risk: ${plan.summary.highestRisk}`,
    `- Action counts: ${formatActionCounts(plan.summary.actionCounts)}`,
    "",
    ...renderPlanActions(plan.actions),
    "",
    "## Evidence Pack",
    "",
    `- Evidence items: ${formatNumber(plan.evidence.totalEvidence)}`,
    `- Required markers: ${formatNumber(plan.evidence.requiredMarkers.length)}`,
    `- Evidence by type: ${formatActionCounts(plan.evidence.byType)}`,
    "",
    ...renderEvidence(plan.evidence.evidence),
    "",
    "## Segment Summary",
    "",
    ...renderSegmentSummary(segmentSummary),
    "",
    "## Largest Contributors",
    "",
    ...renderContributors(contributors),
    "",
    "## Retained Excerpts",
    "",
    ...renderRetainedExcerpts(contributors),
    "",
    "## Expansion Instructions",
    "",
    "- Use `expand_context` with the original handle when more detail is needed.",
    "- Prefer targeted line or segment expansion instead of reloading the full transcript.",
    "- If a marker, stack trace, user request, or tool result is missing, expand the original before acting.",
    "- Treat this artifact as a navigation map, not a complete replacement for the original session."
  ].join("\n");
}

function collectSessionMarkers(recommendation, analysis) {
  const markers = [];
  for (const opportunity of recommendation.topOpportunities ?? []) {
    if (opportunity.source?.preview) markers.push(opportunity.source.preview.slice(0, 120));
  }
  for (const contributor of analysis.largestContributors ?? []) {
    if (contributor.preview) markers.push(contributor.preview.slice(0, 120));
  }
  return [...new Set(markers.filter(Boolean))].slice(0, 12);
}

function renderOpportunities(opportunities) {
  if (!opportunities.length) return ["- No major optimization opportunities found."];
  return opportunities.slice(0, 12).map((item, index) => {
    const source = item.source?.lineNumber
      ? ` line=${item.source.lineNumber}`
      : item.source?.blockIndex !== undefined
        ? ` block=${item.source.blockIndex}`
        : "";
    return `- ${index + 1}. ${item.type}: save ~${formatNumber(item.estimatedSavedTokens)} tokens, risk=${item.riskLevel}${source}. ${item.reason}`;
  });
}

function renderSegmentSummary(summary) {
  const entries = Object.entries(summary ?? {});
  if (!entries.length) return ["- No segment summary available."];
  return entries
    .sort(([, a], [, b]) => (b.tokens ?? 0) - (a.tokens ?? 0))
    .map(([kind, value]) => `- ${kind}: ${formatNumber(value.count)} segments, ${formatNumber(value.tokens)} tokens, ${formatNumber(value.chars)} chars`);
}

function renderContributors(contributors) {
  if (!contributors.length) return ["- No contributors available."];
  return contributors.slice(0, 10).map((item, index) => {
    const label = item.kind ?? `block-${item.index}`;
    return `- ${index + 1}. ${label}: ${formatNumber(item.tokens)} tokens, ${formatNumber(item.chars)} chars. Preview: ${item.preview}`;
  });
}

function renderRetainedExcerpts(contributors) {
  const excerpts = contributors
    .slice(0, 8)
    .map((item, index) => `- Excerpt ${index + 1} (${item.kind ?? `block-${item.index}`}): ${item.preview}`);
  return excerpts.length ? excerpts : ["- No excerpts available."];
}

function renderPlanActions(actions) {
  if (!actions.length) return ["- No plan actions."];
  return actions.slice(0, 15).map((item) => {
    return `- ${item.strategy} ${item.kind} lines ${item.startLine}-${item.endLine}: save ~${formatNumber(item.estimatedSavedTokens)} tokens, risk=${item.riskLevel}. ${item.reason}`;
  });
}

function renderEvidence(evidence) {
  if (!evidence.length) return ["- No evidence extracted."];
  return evidence.slice(0, 20).map((item) => {
    return `- ${item.type} lines ${item.startLine}-${item.endLine}: ${item.text}`;
  });
}

function formatActionCounts(counts) {
  const entries = Object.entries(counts ?? {});
  if (!entries.length) return "none";
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
