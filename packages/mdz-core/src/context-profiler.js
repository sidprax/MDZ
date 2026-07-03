import { estimateTokens } from "./token-estimator.js";

const KIND_RULES = [
  ["user_intent", /^(user|human)\s*:/i],
  ["assistant_response", /^(assistant|agent)\s*:/i],
  ["tool_output", /^(tool output|stdout|stderr|command output)\s*:/i],
  ["error_evidence", /(fail|error|exception|assertion|traceback|timeout|unauthorized|denied|critical)/i],
  ["code_reference", /([A-Za-z]:)?[\\/][\w .-]+|[\w.-]+\.(js|ts|tsx|jsx|py|go|rs|java|md|json|ya?ml|toml|lock)/i],
  ["command", /^(npm|node|python|git|rg|grep|pytest|pnpm|yarn|curl|powershell|cmd)\b/i],
  ["decision", /(decision|decided|recommend|next step|todo|action item|root cause|fix)/i]
];

export function profileContext(text, options = {}) {
  const content = String(text ?? "");
  const segments = splitSegments(content).map((segment, index) => enrichSegment(segment, index));
  const totals = summarizeProfile(segments);
  return {
    generatedAt: new Date().toISOString(),
    format: options.format ?? "text",
    totals,
    segments,
    topSegments: [...segments].sort((a, b) => b.tokens - a.tokens).slice(0, 20),
    repeated: findRepeatedSegments(segments),
    importance: summarizeImportance(segments)
  };
}

function splitSegments(text) {
  const lines = text.split(/\r?\n/);
  const segments = [];
  let current = [];
  let startLine = 1;

  lines.forEach((line, index) => {
    const startsTurn = /^(user|assistant|system|developer|tool|stdout|stderr|command|error)\s*:/i.test(line.trim());
    if (startsTurn && current.length) {
      segments.push({ text: current.join("\n"), startLine, endLine: index });
      current = [];
      startLine = index + 1;
    }
    current.push(line);
  });

  if (current.length) {
    segments.push({ text: current.join("\n"), startLine, endLine: lines.length });
  }
  return segments.filter((segment) => segment.text.trim().length > 0);
}

function enrichSegment(segment, index) {
  const estimate = estimateTokens(segment.text);
  const kind = classifySegment(segment.text);
  const evidenceSignals = extractSignals(segment.text);
  const importance = scoreImportance({ kind, tokens: estimate.tokens, evidenceSignals });
  return {
    id: index,
    kind,
    startLine: segment.startLine,
    endLine: segment.endLine,
    tokens: estimate.tokens,
    chars: estimate.chars,
    importance,
    evidenceSignals,
    preview: segment.text.slice(0, 220).replace(/\s+/g, " "),
    text: segment.text
  };
}

function classifySegment(text) {
  for (const [kind, pattern] of KIND_RULES) {
    if (pattern.test(text.trim())) return kind;
  }
  if (text.length > 5000) return "large_context";
  return "context";
}

function extractSignals(text) {
  const signals = [];
  if (/fail|error|exception|assertion|traceback|timeout/i.test(text)) signals.push("failure");
  if (/[\w.-]+\.(js|ts|tsx|jsx|py|go|rs|java|md|json|ya?ml|toml|lock)/i.test(text)) signals.push("file-path");
  if (/\b\d+(\.\d+)?\b/.test(text)) signals.push("number");
  if (/https?:\/\//i.test(text)) signals.push("url");
  if (/^(npm|node|python|git|rg|pytest|pnpm|yarn|curl)\b/im.test(text)) signals.push("command");
  if (/(todo|decision|root cause|next step|fix)/i.test(text)) signals.push("decision");
  return [...new Set(signals)];
}

function scoreImportance({ kind, tokens, evidenceSignals }) {
  let score = 0.2;
  if (["user_intent", "error_evidence", "decision"].includes(kind)) score += 0.4;
  if (["tool_output", "large_context"].includes(kind)) score += 0.1;
  score += Math.min(0.25, evidenceSignals.length * 0.07);
  if (tokens > 2000 && evidenceSignals.length === 0) score -= 0.15;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function summarizeProfile(segments) {
  const totals = {
    segmentCount: segments.length,
    tokens: 0,
    chars: 0,
    byKind: {}
  };
  for (const segment of segments) {
    totals.tokens += segment.tokens;
    totals.chars += segment.chars;
    totals.byKind[segment.kind] ??= { count: 0, tokens: 0, chars: 0 };
    totals.byKind[segment.kind].count += 1;
    totals.byKind[segment.kind].tokens += segment.tokens;
    totals.byKind[segment.kind].chars += segment.chars;
  }
  return totals;
}

function summarizeImportance(segments) {
  return {
    high: segments.filter((segment) => segment.importance >= 0.7).length,
    medium: segments.filter((segment) => segment.importance >= 0.4 && segment.importance < 0.7).length,
    low: segments.filter((segment) => segment.importance < 0.4).length
  };
}

function findRepeatedSegments(segments) {
  const counts = new Map();
  for (const segment of segments) {
    const key = segment.text.trim();
    if (key.length < 80) continue;
    const value = counts.get(key) ?? { count: 0, segment };
    value.count += 1;
    counts.set(key, value);
  }
  return [...counts.values()]
    .filter((value) => value.count > 1)
    .map((value) => ({
      count: value.count,
      tokens: value.segment.tokens,
      estimatedDuplicateTokens: value.segment.tokens * (value.count - 1),
      preview: value.segment.preview
    }))
    .sort((a, b) => b.estimatedDuplicateTokens - a.estimatedDuplicateTokens);
}
