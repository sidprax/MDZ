import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { decideAdvisorAction, getPolicyProfile } from "./policy.js";

export function createAdvisorReport(recommendation, options = {}) {
  const mode = options.mode ?? "suggest";
  const policy = getPolicyProfile(mode);
  const action = decideAdvisorAction(recommendation, mode);
  const topReasons = (recommendation.topOpportunities ?? []).slice(0, 5).map((item) => ({
    type: item.type,
    estimatedSavedTokens: item.estimatedSavedTokens,
    riskLevel: item.riskLevel,
    reason: item.reason
  }));

  return {
    generatedAt: new Date().toISOString(),
    mode,
    action,
    recommendation: recommendation.recommendation,
    headline: headlineFor(action, recommendation),
    reason: recommendation.reason,
    policy: {
      mode: policy.mode,
      description: policy.description,
      autoApply: policy.autoApply,
      askUser: policy.askUser,
      maxAutoRisk: policy.maxAutoRisk,
      minSavingsPercent: policy.minSavingsPercent
    },
    savings: {
      totalTokens: recommendation.totalTokens,
      estimatedSavedTokens: recommendation.estimatedSavedTokens,
      estimatedPercentSaved: recommendation.estimatedPercentSaved
    },
    downsides: recommendation.downsides,
    topReasons,
    suggestedChoices: choicesFor(action),
    rawRecommendation: recommendation
  };
}

export function renderAdvisorReport(report) {
  const percent = formatPercent(report.savings.estimatedPercentSaved);
  const lines = [
    `MDZ recommends: ${report.action}`,
    `Expected savings: ${percent} (${formatNumber(report.savings.estimatedSavedTokens)} tokens)`,
    `Risk: ${report.downsides.qualityRisk}`,
    `Mode: ${report.mode}`,
    `Why: ${report.reason}`,
    "",
    "Downsides:",
    `- Added local latency: ${report.downsides.addedLocalLatencyMs} ms`,
    `- Local CPU: ${report.downsides.localCpuWork}`,
    `- Local cache: ${formatBytes(report.downsides.localDiskBytes)}`,
    `- Privacy/cache: ${report.downsides.privacyCacheSensitivity}`,
    `- User prompts: ${report.downsides.userApprovalPrompts}`,
    "",
    "Top reasons:",
    ...renderTopReasons(report.topReasons),
    "",
    `Suggested choices: ${report.suggestedChoices.join(" | ")}`
  ];
  return lines.join("\n");
}

export async function writeAdvisorReports(report, options = {}) {
  const dir = options.dir ?? ".mdz/reports";
  const baseName = options.baseName ?? `advisor-${safeTimestamp(report.generatedAt)}`;
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${baseName}.json`);
  const mdPath = path.join(dir, `${baseName}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(mdPath, renderAdvisorReport(report), "utf8");
  return {
    jsonPath,
    mdPath
  };
}

function headlineFor(action, recommendation) {
  if (action === "apply") return "Apply MDZ automatically under the selected policy.";
  if (action === "ask") return "Ask the user before applying MDZ.";
  if (action === "observe") return "Observe only; no changes should be made.";
  if (action === "skip") return "Skip MDZ for now.";
  return recommendation.reason;
}

function choicesFor(action) {
  if (action === "ask") return ["Apply once", "Always for this repo", "Skip"];
  if (action === "apply") return ["Applied by policy", "Review report", "Disable auto-apply"];
  if (action === "observe") return ["Continue observing", "Switch to enabled", "Run benchmark"];
  return ["Skip", "Run observe mode", "Lower threshold"];
}

function renderTopReasons(reasons) {
  if (!reasons.length) return ["- No major optimization opportunities found."];
  return reasons.map((item) => {
    return `- ${item.type}: save ~${formatNumber(item.estimatedSavedTokens)} tokens, risk=${item.riskLevel}`;
  });
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

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, "-");
}
