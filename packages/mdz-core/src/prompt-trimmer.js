import { estimateSavings, estimateTokens } from "./token-estimator.js";

const LEADING_FILLER = [
  /^(?:hi|hello|hey)(?:\s+there)?[,!.]?\s+/i,
  /^(?:could|can|would)\s+you\s+(?:please\s+)?/i,
  /^(?:please\s+)/i,
  /^(?:i\s+was\s+wondering\s+if\s+you\s+could\s+)/i,
  /^(?:i\s+would\s+like\s+you\s+to\s+)/i,
  /^(?:i\s+need\s+you\s+to\s+)/i,
  /^(?:help\s+me\s+)/i
];

const PHRASE_REPLACEMENTS = [
  [/\b(?:kindly|please)\b/gi, ""],
  [/\b(?:go ahead and)\b/gi, ""],
  [/\b(?:take a look at|have a look at)\b/gi, "inspect"],
  [/\b(?:if possible|when you get a chance|at your earliest convenience)\b/gi, ""],
  [/\b(?:I think|I believe|I guess|maybe|perhaps)\b/gi, ""],
  [/\b(?:in order to)\b/gi, "to"],
  [/\b(?:due to the fact that)\b/gi, "because"],
  [/\b(?:at this point in time)\b/gi, "now"]
];

const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /^\s{0,4}[-+*]?\s*(?:\{|\[|<\?xml|[A-Za-z0-9_-]+:\s*["'{[])/gm,
  /\b(?:must|must not|should|should not|shall|shall not|never|always|only|unless|except|without|do not|don't|cannot|can't)\b/gi,
  /\b[A-Za-z]:[\\/][^\s"'`<>]+/g,
  /(?:^|[\s"'`])(?:\.{1,2}[\\/]|[A-Za-z0-9_.-]+[\\/])[A-Za-z0-9_.\\/-]+/g,
  /\b[A-Za-z0-9_.-]+\.(?:js|jsx|ts|tsx|mjs|cjs|json|jsonl|yaml|yml|toml|md|py|go|rs|java|cs|cpp|h|hpp|sh|ps1|sql|html|css)\b/g,
  /\b(?:https?:\/\/|mdz:\/\/)[^\s"'`<>]+/g
];

export function trimPrompt(text, options = {}) {
  const original = String(text ?? "");
  const protectedSpans = findProtectedSpans(original);
  const protectedRatio = original.length ? protectedSpans.reduce((sum, span) => sum + span.end - span.start, 0) / original.length : 0;
  const units = splitUnits(original);
  const trimmedUnits = units.map((unit) => trimUnit(unit, protectedSpans));
  const reduced = normalizeDocument(trimmedUnits.join("\n"));
  const metrics = estimateSavings(original, reduced);
  const warnings = [];
  const changedUnits = trimmedUnits.filter((unit, index) => unit !== units[index]).length;

  if (protectedRatio > 0.45) warnings.push("Large protected span ratio; treat as code/config-sensitive text.");
  if (containsStrongModal(original)) warnings.push("Constraints or negations detected and preserved.");
  if (metrics.savedTokens <= 0) warnings.push("No net token reduction from safe prompt trimming.");

  const minSavingsPercent = Number(options.minSavingsPercent ?? 0.03);
  const riskLevel = protectedRatio > 0.45 ? "medium" : containsStrongModal(original) ? "low" : "low";
  const shouldApply = metrics.percentSaved >= minSavingsPercent && riskLevel === "low";

  return {
    kind: "prompt-trim",
    original,
    reduced,
    applied: shouldApply,
    riskLevel,
    metrics: {
      ...metrics,
      originalChars: original.length,
      reducedChars: reduced.length,
      originalLines: countLines(original),
      reducedLines: countLines(reduced),
      changedUnits,
      protectedSpans: protectedSpans.length,
      protectedRatio,
      estimatedLatencyMs: Math.max(1, Math.round(original.length / 100000)),
      estimatedCpuWork: original.length > 500000 ? "medium" : "low"
    },
    downsides: {
      addedLocalLatencyMs: Math.max(1, Math.round(original.length / 100000)),
      localCpuWork: original.length > 500000 ? "medium" : "low",
      localDiskBytes: 0,
      qualityRisk: riskLevel,
      privacyCacheSensitivity: "none",
      userApprovalPrompts: options.mode === "suggest" ? 1 : 0
    },
    notes: [
      "Removed low-signal conversational phrasing while preserving protected spans.",
      ...warnings
    ],
    examples: buildExamples(units, trimmedUnits)
  };
}

export function renderPromptTrimReport(result) {
  return [
    "MDZ Prompt Trim",
    `- Action: ${result.applied ? "apply" : "suggest-or-skip"}`,
    `- Risk: ${result.riskLevel}`,
    `- Estimated tokens: ${result.metrics.originalTokens} -> ${result.metrics.reducedTokens}`,
    `- Estimated saved: ${result.metrics.savedTokens} (${Math.round(result.metrics.percentSaved * 1000) / 10}%)`,
    `- Protected spans: ${result.metrics.protectedSpans}`,
    `- Notes: ${result.notes.join(" ")}`
  ].join("\n");
}

function trimUnit(unit, protectedSpans) {
  if (!unit.text.trim()) return "";
  if (overlapsProtected(unit.start, unit.end, protectedSpans)) return unit.text.trim();
  let value = unit.text.trim();
  for (const pattern of LEADING_FILLER) value = value.replace(pattern, "");
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) value = value.replace(pattern, replacement);
  value = value
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+\?/g, "?")
    .replace(/\s{2,}/g, " ")
    .replace(/\b(?:really|basically|actually|just)\s+(?=\w)/gi, "")
    .trim();
  return value || unit.text.trim();
}

function splitUnits(text) {
  const units = [];
  let cursor = 0;
  for (const part of String(text ?? "").split(/\r?\n/)) {
    const start = cursor;
    const end = start + part.length;
    units.push({ text: part, start, end });
    cursor = end + 1;
  }
  return units;
}

function normalizeDocument(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() || (index > 0 && index < lines.length - 1 && lines[index - 1].trim() && lines[index + 1].trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findProtectedSpans(text) {
  const spans = [];
  for (const pattern of PROTECTED_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      const leading = value.match(/^\s/) ? 1 : 0;
      spans.push({ start: match.index + leading, end: match.index + value.length });
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }
  return mergeSpans(spans);
}

function mergeSpans(spans) {
  const sorted = spans.filter((span) => span.end > span.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

function overlapsProtected(start, end, spans) {
  return spans.some((span) => start < span.end && end > span.start);
}

function containsStrongModal(text) {
  return /\b(?:must|must not|should|should not|never|always|only|unless|except|without|do not|don't|cannot|can't)\b/i.test(text);
}

function buildExamples(originalUnits, trimmedUnits) {
  return originalUnits
    .map((unit, index) => ({ before: unit.text.trim(), after: trimmedUnits[index].trim() }))
    .filter((item) => item.before && item.after && item.before !== item.after)
    .slice(0, 5);
}

function countLines(text) {
  return String(text ?? "").split(/\r?\n/).length;
}
