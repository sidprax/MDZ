import { estimateTokens } from "./token-estimator.js";
import { isCodexJsonl, parseCodexSessionJsonl } from "./codex-session.js";

const TOOL_OUTPUT_MARKERS = [
  /^tool(?:\s|-)?output:/i,
  /^command output:/i,
  /^stdout:/i,
  /^stderr:/i,
  /^```/i
];

export function analyzeSession(text, options = {}) {
  const content = String(text ?? "");
  if (options.format === "codex-jsonl" || isCodexJsonl(content)) {
    return analyzeCodexJsonl(content);
  }
  const turns = splitTurns(content);
  const total = estimateTokens(content);
  const contributors = findLargestBlocks(turns);
  const repeated = findRepeatedLines(content);
  const opportunities = findOpportunities(content, contributors, repeated, options);
  const expectedSavingsTokens = opportunities.reduce((sum, item) => sum + item.estimatedSavedTokens, 0);

  return {
    totalTokens: total.tokens,
    totalChars: total.chars,
    turns: turns.length,
    largestContributors: contributors.slice(0, 10),
    repeatedLines: repeated.slice(0, 10),
    opportunities,
    expected: {
      savedTokens: expectedSavingsTokens,
      percentSaved: total.tokens === 0 ? 0 : expectedSavingsTokens / total.tokens,
      addedLatencyMs: estimateAnalysisLatency(content.length),
      localCpuWork: estimateAnalysisCpu(content.length),
      localDiskBytes: Buffer.byteLength(content, "utf8")
    }
  };
}

function analyzeCodexJsonl(content) {
  const parsed = parseCodexSessionJsonl(content);
  const expectedSavingsTokens = parsed.opportunities.reduce((sum, item) => sum + item.estimatedSavedTokens, 0);
  return {
    format: "codex-jsonl",
    totalTokens: parsed.totals.tokens,
    totalChars: parsed.totals.chars,
    turns: parsed.events,
    segmentSummary: parsed.totals.byKind,
    largestContributors: parsed.segments
      .map((segment) => ({
        index: segment.id,
        kind: segment.kind,
        tokens: segment.tokens,
        chars: segment.chars,
        preview: segment.preview
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10),
    repeatedLines: [],
    opportunities: parsed.opportunities,
    expected: {
      savedTokens: expectedSavingsTokens,
      percentSaved: parsed.totals.tokens === 0 ? 0 : expectedSavingsTokens / parsed.totals.tokens,
      addedLatencyMs: estimateAnalysisLatency(parsed.totals.chars),
      localCpuWork: estimateAnalysisCpu(parsed.totals.chars),
      localDiskBytes: Buffer.byteLength(content, "utf8")
    }
  };
}

function splitTurns(content) {
  const parts = content
    .split(/\n(?=(user|assistant|system|tool|developer|command|stdout|stderr)\s*:)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [content];
}

function findLargestBlocks(blocks) {
  return blocks
    .map((block, index) => {
      const estimate = estimateTokens(block);
      return {
        index,
        tokens: estimate.tokens,
        chars: estimate.chars,
        preview: block.slice(0, 160).replace(/\s+/g, " ")
      };
    })
    .sort((a, b) => b.tokens - a.tokens);
}

function findRepeatedLines(content) {
  const counts = new Map();
  for (const line of content.split(/\r?\n/)) {
    const normalized = line.trim();
    if (normalized.length < 24) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 2)
    .map(([line, count]) => ({
      count,
      estimatedTokens: estimateTokens(line).tokens * (count - 1),
      line: line.slice(0, 180)
    }))
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

function findOpportunities(content, contributors, repeated) {
  const opportunities = [];
  const total = estimateTokens(content);

  for (const block of contributors.slice(0, 5)) {
    if (block.tokens < 500) continue;
    const isToolLike = TOOL_OUTPUT_MARKERS.some((pattern) => pattern.test(block.preview));
    opportunities.push({
      type: isToolLike ? "tool-output-handle" : "large-block-handle",
      riskLevel: isToolLike ? "low" : "medium",
      estimatedSavedTokens: Math.round(block.tokens * (isToolLike ? 0.75 : 0.45)),
      reason: isToolLike
        ? "Large tool output can be stored behind a handle and expanded on demand."
        : "Large context block can be summarized with an original-content handle.",
      source: {
        blockIndex: block.index,
        tokens: block.tokens,
        preview: block.preview
      }
    });
  }

  const repeatedSavings = repeated.reduce((sum, item) => sum + item.estimatedTokens, 0);
  if (repeatedSavings > Math.max(200, total.tokens * 0.03)) {
    opportunities.push({
      type: "repeated-context-collapse",
      riskLevel: "low",
      estimatedSavedTokens: Math.round(repeatedSavings * 0.8),
      reason: "Repeated long lines can be collapsed after first occurrence.",
      source: {
        repeatedLineCount: repeated.length
      }
    });
  }

  if (total.tokens > 4000) {
    opportunities.push({
      type: "response-profile",
      riskLevel: "low",
      estimatedSavedTokens: Math.round(total.tokens * 0.05),
      reason: "A terse or standard response profile can reduce output tokens for future turns.",
      source: {
        sessionTokens: total.tokens
      }
    });
  }

  return opportunities.sort((a, b) => b.estimatedSavedTokens - a.estimatedSavedTokens);
}

function estimateAnalysisLatency(chars) {
  return Math.max(2, Math.round(chars / 150000));
}

function estimateAnalysisCpu(chars) {
  if (chars < 250000) return "low";
  if (chars < 3000000) return "medium";
  return "high";
}
