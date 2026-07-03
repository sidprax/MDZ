import { profileContext } from "./context-profiler.js";

const EVIDENCE_PATTERNS = [
  ["failure", /.*(?:FAIL|ERROR|Error|Exception|AssertionError|Traceback|timeout|unauthorized|denied|critical).*/g],
  ["file-path", /(?:[A-Za-z]:)?[\\/][\w .-]+|[\w.-]+\.(?:js|ts|tsx|jsx|py|go|rs|java|md|json|ya?ml|toml|lock)/g],
  ["command", /^(?:npm|node|python|git|rg|pytest|pnpm|yarn|curl|powershell|cmd)\b.*/gim],
  ["url", /https?:\/\/[^\s)]+/g],
  ["number", /\b\d+(?:\.\d+)?\b/g],
  ["decision", /.*(?:decision|decided|root cause|next step|todo|fix|recommend).*/gi]
];

export function extractEvidence(text, options = {}) {
  const content = String(text ?? "");
  const profile = options.profile ?? profileContext(content);
  const evidence = [];
  for (const segment of profile.segments) {
    for (const item of extractSegmentEvidence(segment)) {
      evidence.push(item);
    }
  }
  const deduped = dedupeEvidence(evidence);
  return {
    generatedAt: new Date().toISOString(),
    totalEvidence: deduped.length,
    byType: summarizeEvidence(deduped),
    evidence: deduped.slice(0, options.limit ?? 200),
    requiredMarkers: deduped
      .filter((item) => item.priority >= 0.7)
      .slice(0, options.markerLimit ?? 50)
      .map((item) => item.text.slice(0, 180))
  };
}

function extractSegmentEvidence(segment) {
  const items = [];
  for (const [type, pattern] of EVIDENCE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = segment.text.match(pattern) ?? [];
    for (const match of matches.slice(0, 20)) {
      const text = String(match).trim();
      if (!text) continue;
      items.push({
        type,
        text: text.slice(0, 300),
        segmentId: segment.id,
        startLine: segment.startLine,
        endLine: segment.endLine,
        priority: priorityFor(type, segment.importance)
      });
    }
  }
  if (segment.importance >= 0.7) {
    items.push({
      type: "important-segment",
      text: segment.preview,
      segmentId: segment.id,
      startLine: segment.startLine,
      endLine: segment.endLine,
      priority: segment.importance
    });
  }
  return items;
}

function priorityFor(type, segmentImportance) {
  const base = {
    failure: 0.95,
    "file-path": 0.75,
    command: 0.75,
    decision: 0.8,
    url: 0.55,
    number: 0.35,
    "important-segment": 0.7
  }[type] ?? 0.4;
  return Math.max(base, segmentImportance);
}

function dedupeEvidence(items) {
  const seen = new Set();
  const out = [];
  for (const item of items.sort((a, b) => b.priority - a.priority)) {
    const key = `${item.type}:${item.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function summarizeEvidence(items) {
  const byType = {};
  for (const item of items) {
    byType[item.type] ??= 0;
    byType[item.type] += 1;
  }
  return byType;
}
