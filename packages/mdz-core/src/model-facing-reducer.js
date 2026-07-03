import { filterOutput } from "./filters.js";
import { storeContext } from "./handles.js";
import { recordLedgerEvent } from "./ledger.js";
import { getPolicyProfile } from "./policy.js";
import { estimateSavings } from "./token-estimator.js";

const RISK_ORDER = { none: 0, unknown: 1, low: 2, medium: 3, high: 4 };

export async function prepareModelFacingReduction(text, options = {}) {
  const original = String(text ?? "");
  const policy = options.policy ?? {};
  const profile = getPolicyProfile(policy.mode);
  const filtered = filterOutput(original, {
    kind: options.kind ?? "auto",
    maxLines: options.maxLines,
    windowSize: options.windowSize
  });
  const riskAllowed = (RISK_ORDER[filtered.riskLevel] ?? RISK_ORDER.unknown)
    <= (RISK_ORDER[policy.maxAutoRisk ?? profile.maxAutoRisk] ?? RISK_ORDER.unknown);
  const canApply = profile.autoApply && riskAllowed && policy.storeOriginals !== false;

  if (!canApply || filtered.metrics.savedTokens <= 0) {
    return skipped(original, filtered, profile.autoApply ? "risk-or-storage-policy" : `mode-${profile.mode}`, { mode: profile.mode });
  }

  const stored = await storeContext(original, { storeDir: options.storeDir ?? policy.storeDir });
  const replacement = buildReplacement(filtered, stored.handle, options);
  const net = estimateSavings(original, replacement);
  const threshold = Number(policy.minSavingsPercent ?? profile.minSavingsPercent);
  if (net.savedTokens <= 0 || net.percentSaved < threshold) {
    return skipped(original, filtered, "below-net-savings-threshold", { stored, replacement, net, mode: profile.mode });
  }

  return {
    applied: true,
    reason: "low-risk-net-positive-reduction",
    original,
    replacement,
    handle: stored.handle,
    stored,
    filter: filtered,
    metrics: net,
    mode: profile.mode,
    downsides: downsides(filtered, stored, profile.mode)
  };
}

export async function recordModelFacingDelivery(result, options = {}) {
  if (!result?.applied) return null;
  return recordLedgerEvent({
    source: options.source,
    type: options.type ?? "tool-output",
    mode: result.mode,
    action: "apply",
    delivered: true,
    tokens: {
      original: result.metrics.originalTokens,
      reduced: result.metrics.reducedTokens
    },
    savings: {
      estimatedSavedTokens: result.metrics.savedTokens,
      estimatedPercentSaved: result.metrics.percentSaved
    },
    downsides: result.downsides,
    handle: result.handle,
    example: {
      technique: `${result.filter.kind}-output-filtering`,
      summary: result.filter.notes[0],
      before: `${result.filter.metrics.originalLines} lines / ${result.metrics.originalTokens} estimated tokens`,
      after: `${result.filter.metrics.reducedLines} filtered lines plus handle / ${result.metrics.reducedTokens} estimated tokens`
    },
    notes: [...result.filter.notes, "Compact payload was delivered to the model-facing boundary."]
  }, { file: options.ledgerFile });
}

export async function recordModelFacingObservation(result, options = {}) {
  const metrics = result.filter.metrics;
  return recordLedgerEvent({
    source: options.source,
    type: options.type ?? "tool-output",
    mode: result.mode,
    action: result.mode === "observe" ? "observe" : "skip",
    tokens: { original: metrics.originalTokens, reduced: metrics.originalTokens },
    savings: {
      estimatedSavedTokens: metrics.savedTokens,
      estimatedPercentSaved: metrics.percentSaved
    },
    downsides: downsides(result.filter, null, result.mode),
    example: {
      technique: `${result.filter.kind}-output-filtering`,
      summary: result.filter.notes[0],
      before: `${metrics.originalLines} lines / ${metrics.originalTokens} estimated tokens`,
      after: "Original payload delivered unchanged"
    },
    notes: [...result.filter.notes, `No model-facing reduction: ${result.reason}.`]
  }, { file: options.ledgerFile });
}

function buildReplacement(filtered, handle, options) {
  const source = options.sourceLabel ? `Source: ${options.sourceLabel}\n` : "";
  return [
    `MDZ reduced ${filtered.kind} output.`,
    source.trimEnd(),
    filtered.reduced,
    "",
    `Original: ${handle}`,
    "Use MDZ expand_context with this handle if omitted detail is needed."
  ].filter((line) => line !== "").join("\n");
}

function skipped(original, filter, reason, extra = {}) {
  return {
    applied: false,
    reason,
    original,
    replacement: original,
    filter,
    metrics: estimateSavings(original, original),
    mode: extra.mode ?? "observe",
    ...extra
  };
}

function downsides(filtered, stored, mode) {
  return {
    addedLocalLatencyMs: filtered.metrics.estimatedLatencyMs,
    localCpuWork: filtered.metrics.estimatedCpuWork,
    localDiskBytes: stored?.bytes ?? 0,
    qualityRisk: filtered.riskLevel,
    privacyCacheSensitivity: stored ? "stores-original-locally" : "none",
    userApprovalPrompts: mode === "suggest" ? 1 : 0,
    extraMdzToolCalls: 0,
    handleExpansions: 0
  };
}
