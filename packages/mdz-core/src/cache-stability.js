import { createContentId } from "./handles.js";
import { estimateTokens } from "./token-estimator.js";

const DEFAULT_ORDER = ["systemPrompt", "toolDefinitions", "projectInstructions", "conversationPrefix"];

export function createPromptPrefixSnapshot(input = {}, options = {}) {
  const order = options.order ?? DEFAULT_ORDER;
  const components = order.map((name) => componentSnapshot(name, input[name]));
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    model: options.model ?? input.model,
    reasoningEffort: options.reasoningEffort ?? input.reasoningEffort,
    order,
    components,
    totals: {
      prefixTokens: components.reduce((sum, component) => sum + component.tokens, 0),
      prefixChars: components.reduce((sum, component) => sum + component.chars, 0)
    }
  };
}

export function analyzePromptCacheStability(currentInput = {}, previousInput, options = {}) {
  const current = isSnapshot(currentInput) ? currentInput : createPromptPrefixSnapshot(currentInput, options.current ?? options);
  const previous = previousInput
    ? (isSnapshot(previousInput) ? previousInput : createPromptPrefixSnapshot(previousInput, options.previous ?? options))
    : undefined;
  const retentionMinutes = Number(options.retentionMinutes ?? 10);
  const now = Date.parse(options.now ?? current.generatedAt);
  const previousTime = previous ? Date.parse(options.previousRequestAt ?? previous.generatedAt) : NaN;
  const idleMinutes = Number.isFinite(now) && Number.isFinite(previousTime) ? Math.max(0, (now - previousTime) / 60000) : undefined;
  const expiredByIdle = idleMinutes !== undefined && idleMinutes > retentionMinutes;
  const changes = compareComponents(current, previous);
  const firstChangedIndex = changes.findIndex((change) => change.changed);
  const reusablePrefixTokens = !previous || expiredByIdle
    ? 0
    : firstChangedIndex === -1
      ? Math.min(current.totals.prefixTokens, previous.totals.prefixTokens)
      : current.components.slice(0, firstChangedIndex).reduce((sum, component) => sum + component.tokens, 0);
  const invalidatedTokens = Math.max(0, current.totals.prefixTokens - reusablePrefixTokens);
  const metadataChanges = [
    current.model !== previous?.model ? "model" : undefined,
    current.reasoningEffort !== previous?.reasoningEffort ? "reasoning-effort" : undefined
  ].filter(Boolean);
  const status = cacheStatus({ previous, expiredByIdle, invalidatedTokens, total: current.totals.prefixTokens, metadataChanges });

  return {
    generatedAt: new Date().toISOString(),
    status,
    confirmedByProvider: false,
    current,
    previous: previous ? {
      generatedAt: previous.generatedAt,
      model: previous.model,
      reasoningEffort: previous.reasoningEffort,
      totals: previous.totals
    } : undefined,
    metrics: {
      retentionMinutes,
      idleMinutes,
      currentPrefixTokens: current.totals.prefixTokens,
      reusablePrefixTokens,
      invalidatedTokens,
      estimatedReusablePercent: current.totals.prefixTokens === 0 ? 0 : reusablePrefixTokens / current.totals.prefixTokens
    },
    changes,
    metadataChanges,
    warnings: buildWarnings({ previous, expiredByIdle, idleMinutes, retentionMinutes, changes, metadataChanges }),
    recommendations: buildRecommendations({ previous, expiredByIdle, changes, metadataChanges })
  };
}

function componentSnapshot(name, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const estimate = estimateTokens(text);
  return {
    name,
    fingerprint: createContentId(text),
    tokens: estimate.tokens,
    chars: estimate.chars,
    empty: estimate.chars === 0 || text === '""'
  };
}

function compareComponents(current, previous) {
  return current.components.map((component, index) => {
    const prior = previous?.components?.find((item) => item.name === component.name) ?? previous?.components?.[index];
    return {
      name: component.name,
      changed: !prior || prior.fingerprint !== component.fingerprint,
      previousTokens: prior?.tokens ?? 0,
      currentTokens: component.tokens,
      tokenDelta: component.tokens - Number(prior?.tokens ?? 0),
      effect: !prior
        ? "new-component"
        : prior.fingerprint === component.fingerprint
          ? "stable"
          : "invalidates-this-and-later-prefix-components"
    };
  });
}

function cacheStatus({ previous, expiredByIdle, invalidatedTokens, total, metadataChanges }) {
  if (!previous) return "cold-start";
  if (expiredByIdle) return "probable-expired";
  if (metadataChanges.length) return "probable-miss";
  if (invalidatedTokens === 0) return "probable-hit";
  if (invalidatedTokens < total) return "probable-partial-hit";
  return "probable-miss";
}

function buildWarnings({ previous, expiredByIdle, idleMinutes, retentionMinutes, changes, metadataChanges }) {
  const warnings = [];
  if (!previous) warnings.push("No previous prefix snapshot is available; treat this request as a cold start.");
  if (expiredByIdle) warnings.push(`Session was idle for about ${round(idleMinutes)} minutes, beyond the configured ${retentionMinutes}-minute retention estimate.`);
  if (metadataChanges.includes("model")) warnings.push("The model changed; provider cache compatibility may be lost.");
  if (metadataChanges.includes("reasoning-effort")) warnings.push("Reasoning effort changed; request state or cache compatibility may be lost.");
  const toolChange = changes.find((change) => change.name === "toolDefinitions" && change.changed);
  if (toolChange) warnings.push(`Tool definitions changed by ${toolChange.tokenDelta >= 0 ? "+" : ""}${toolChange.tokenDelta} estimated tokens.`);
  return warnings;
}

function buildRecommendations({ previous, expiredByIdle, changes, metadataChanges }) {
  const recommendations = [];
  if (!previous) recommendations.push("Save this prefix snapshot and compare it before the next request.");
  if (expiredByIdle) recommendations.push("Warn before resuming a large session, or use provider-supported extended cache retention when available.");
  const firstChanged = changes.find((change) => change.changed);
  if (firstChanged) recommendations.push(`Keep ${firstChanged.name} stable or move dynamic content after the reusable prefix where the host permits.`);
  if (changes.some((change) => change.name === "toolDefinitions" && change.changed)) {
    recommendations.push("Use MDZ tool deferral so infrequently used schemas do not rewrite or enlarge the prompt prefix.");
  }
  if (metadataChanges.length) recommendations.push("Avoid changing model or reasoning effort mid-session unless the expected benefit exceeds a probable cache cold start.");
  if (!recommendations.length) recommendations.push("Prefix appears stable; preserve component ordering and continue monitoring provider usage metadata.");
  return recommendations;
}

function isSnapshot(value) {
  return Array.isArray(value?.components) && value?.totals?.prefixTokens !== undefined;
}

function round(value) {
  return Math.round(Number(value ?? 0) * 10) / 10;
}
