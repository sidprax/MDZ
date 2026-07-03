import { analyzeSession } from "./session-analyzer.js";
import { createCompressionPlan } from "./compression-planner.js";
import { estimateTokens } from "./token-estimator.js";

export function replaySession(text, options = {}) {
  const content = String(text ?? "");
  const mode = options.mode ?? "enabled";
  const turns = splitReplayTurns(content);
  let cumulativeOriginal = 0;
  let cumulativeSaved = 0;
  const replay = turns.map((turn, index) => {
    const estimate = estimateTokens(turn.text);
    const plan = createCompressionPlan(turn.text, { mode });
    const savedTokens = plan.summary.estimatedSavedTokens;
    cumulativeOriginal += estimate.tokens;
    cumulativeSaved += savedTokens;
    return {
      index,
      role: turn.role,
      tokens: estimate.tokens,
      chars: estimate.chars,
      recommendation: plan.recommendation,
      estimatedSavedTokens: savedTokens,
      estimatedPercentSaved: estimate.tokens === 0 ? 0 : savedTokens / estimate.tokens,
      highestRisk: plan.summary.highestRisk,
      preview: turn.text.replace(/\s+/g, " ").slice(0, 180)
    };
  });
  const analysis = analyzeSession(content);
  return {
    generatedAt: new Date().toISOString(),
    mode,
    totals: {
      turns: replay.length,
      originalTokens: cumulativeOriginal,
      estimatedSavedTokens: cumulativeSaved,
      estimatedPercentSaved: cumulativeOriginal === 0 ? 0 : cumulativeSaved / cumulativeOriginal
    },
    session: {
      totalTokens: analysis.totalTokens,
      opportunityCount: analysis.opportunities.length
    },
    turns: replay
  };
}

export function renderReplayReport(report) {
  return [
    "# MDZ Session Replay",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    "",
    `- Turns: ${report.totals.turns}`,
    `- Original tokens: ${formatNumber(report.totals.originalTokens)}`,
    `- Estimated saved tokens: ${formatNumber(report.totals.estimatedSavedTokens)}`,
    `- Estimated percent saved: ${formatPercent(report.totals.estimatedPercentSaved)}`,
    "",
    "## Turn Timeline",
    "",
    ...report.turns.map((turn) => `- ${turn.index}. ${turn.role}: ${formatNumber(turn.tokens)} tokens, save ~${formatNumber(turn.estimatedSavedTokens)}, ${turn.recommendation}, risk=${turn.highestRisk}`)
  ].join("\n");
}

function splitReplayTurns(content) {
  const parts = content
    .split(/\n(?=(user|assistant|system|tool|developer|command|stdout|stderr)\s*:)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const turns = parts.length ? parts : [content];
  return turns.map((text) => ({
    role: detectRole(text),
    text
  }));
}

function detectRole(text) {
  const match = text.match(/^(user|assistant|system|tool|developer|command|stdout|stderr)\s*:/i);
  return match ? match[1].toLowerCase() : "context";
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}
