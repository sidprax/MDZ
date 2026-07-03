import { extractEvidence } from "./evidence-extractor.js";
import { profileContext } from "./context-profiler.js";

const RISK_ORDER = { low: 1, medium: 2, high: 3 };

export function createCompressionPlan(text, options = {}) {
  const mode = options.mode ?? "enabled";
  const profile = options.profile ?? profileContext(text);
  const evidence = options.evidence ?? extractEvidence(text, { profile });
  const actions = profile.segments.map((segment) => planSegment(segment, { mode, evidence }));
  const estimatedSavedTokens = actions.reduce((sum, action) => sum + action.estimatedSavedTokens, 0);
  const highestRisk = actions.reduce((risk, action) => {
    return RISK_ORDER[action.riskLevel] > RISK_ORDER[risk] ? action.riskLevel : risk;
  }, "low");

  return {
    generatedAt: new Date().toISOString(),
    mode,
    profile,
    evidence,
    actions,
    summary: {
      originalTokens: profile.totals.tokens,
      estimatedSavedTokens,
      estimatedPercentSaved: profile.totals.tokens === 0 ? 0 : estimatedSavedTokens / profile.totals.tokens,
      highestRisk,
      actionCounts: countActions(actions)
    },
    recommendation: recommendPlan({ mode, estimatedSavedTokens, totalTokens: profile.totals.tokens, highestRisk })
  };
}

function planSegment(segment, { mode, evidence }) {
  const segmentEvidence = evidence.evidence.filter((item) => item.segmentId === segment.id);
  const hasHighEvidence = segmentEvidence.some((item) => item.priority >= 0.7);
  const duplicateEligible = segment.tokens > 80 && segment.importance < 0.5;
  const large = segment.tokens > 700;

  if (mode === "observe") {
    return action(segment, "observe", 0, "low", "Observe mode records only.");
  }
  if (hasHighEvidence && segment.tokens < 1000) {
    return action(segment, "keep", 0, "low", "Keep compact high-value evidence verbatim.");
  }
  if (segment.kind === "error_evidence" || segment.kind === "user_intent" || segment.kind === "decision") {
    return action(segment, "keep", 0, "low", "Preserve task intent, decisions, and failure evidence.");
  }
  if (duplicateEligible) {
    return action(segment, "collapse", Math.round(segment.tokens * 0.65), "low", "Collapse repeated or low-signal context.");
  }
  if (large && ["safe", "suggest"].includes(mode)) {
    return action(segment, "handle", Math.round(segment.tokens * 0.7), hasHighEvidence ? "medium" : "low", "Store large content behind a handle and retain evidence.");
  }
  if (large && ["balanced", "aggressive"].includes(mode)) {
    return action(segment, "summarize-with-evidence", Math.round(segment.tokens * 0.8), hasHighEvidence ? "medium" : "low", "Summarize large content while retaining evidence spans.");
  }
  if (segment.importance < 0.35 && segment.tokens > 120) {
    return action(segment, "trim", Math.round(segment.tokens * 0.4), "low", "Trim low-importance context.");
  }
  return action(segment, "keep", 0, "low", "Keep context; savings do not justify risk.");
}

function action(segment, strategy, estimatedSavedTokens, riskLevel, reason) {
  return {
    segmentId: segment.id,
    kind: segment.kind,
    strategy,
    estimatedSavedTokens,
    riskLevel,
    reason,
    startLine: segment.startLine,
    endLine: segment.endLine,
    tokens: segment.tokens,
    importance: segment.importance,
    preview: segment.preview
  };
}

function recommendPlan({ mode, estimatedSavedTokens, totalTokens, highestRisk }) {
  const pct = totalTokens === 0 ? 0 : estimatedSavedTokens / totalTokens;
  if (mode === "observe") return "observe";
  if (estimatedSavedTokens < 300 || pct < 0.05) return "skip";
  if (mode === "safe" && highestRisk === "low") return "apply";
  if (mode === "suggest" || highestRisk !== "low") return "ask";
  return "apply";
}

function countActions(actions) {
  const counts = {};
  for (const item of actions) {
    counts[item.strategy] = (counts[item.strategy] ?? 0) + 1;
  }
  return counts;
}
