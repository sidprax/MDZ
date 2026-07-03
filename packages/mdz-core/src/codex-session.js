import { estimateTokens } from "./token-estimator.js";

const LARGE_TOOL_THRESHOLD = 800;
const LARGE_PROMPT_THRESHOLD = 1200;
const LARGE_INSTRUCTIONS_THRESHOLD = 3000;

export function isCodexJsonl(text) {
  const first = String(text ?? "").split(/\r?\n/, 1)[0];
  if (!first?.trim().startsWith("{")) return false;
  try {
    const parsed = JSON.parse(first);
    return Boolean(parsed.type && parsed.payload);
  } catch {
    return false;
  }
}

export function parseCodexSessionJsonl(text) {
  const events = [];
  const segments = [];
  const parseErrors = [];

  String(text ?? "").split(/\r?\n/).forEach((line, lineNumber) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      events.push(event);
      const eventSegments = segmentsFromEvent(event, lineNumber + 1);
      for (const segment of eventSegments) {
        segment.id = segments.length;
        segments.push(segment);
      }
    } catch (error) {
      parseErrors.push({
        line: lineNumber + 1,
        message: error.message
      });
    }
  });

  const totals = summarizeSegments(segments);
  return {
    format: "codex-jsonl",
    events: events.length,
    parseErrors,
    segments,
    totals,
    opportunities: findCodexOpportunities(segments, totals)
  };
}

export function recommendForSession(text, options = {}) {
  const parsed = isCodexJsonl(text) ? parseCodexSessionJsonl(text) : null;
  if (!parsed) {
    return recommendForPlainTextSession(text, options);
  }

  const savings = parsed.opportunities.reduce((sum, item) => sum + item.estimatedSavedTokens, 0);
  const total = parsed.totals.tokens;
  const percent = total === 0 ? 0 : savings / total;
  const recommendation = chooseRecommendation(percent, savings, parsed.opportunities);

  return {
    format: parsed.format,
    recommendation,
    totalTokens: total,
    estimatedSavedTokens: savings,
    estimatedPercentSaved: percent,
    reason: recommendationReason(recommendation, percent, savings),
    downsides: {
      addedLocalLatencyMs: Math.max(2, Math.round(parsed.totals.chars / 150000)),
      localCpuWork: parsed.totals.chars < 250000 ? "low" : parsed.totals.chars < 3000000 ? "medium" : "high",
      localDiskBytes: parsed.totals.chars,
      qualityRisk: highestRisk(parsed.opportunities),
      privacyCacheSensitivity: savings > 0 ? "stores-original-locally" : "none",
      userApprovalPrompts: recommendation === "ask" ? 1 : 0
    },
    topOpportunities: parsed.opportunities.slice(0, 10),
    segmentSummary: parsed.totals.byKind
  };
}

function segmentsFromEvent(event, lineNumber) {
  const segments = [];
  const payload = event.payload ?? {};

  if (event.type === "session_meta") {
    pushText(segments, {
      kind: "base_instructions",
      text: payload.base_instructions?.text,
      lineNumber,
      sourceType: event.type
    });
    pushText(segments, {
      kind: "environment_context",
      text: JSON.stringify(payload, null, 2),
      lineNumber,
      sourceType: event.type
    });
    return segments;
  }

  if (event.type === "turn_context") {
    pushText(segments, {
      kind: "turn_context",
      text: JSON.stringify(payload, null, 2),
      lineNumber,
      sourceType: event.type
    });
    return segments;
  }

  if (event.type === "event_msg") {
    pushText(segments, {
      kind: eventMsgKind(payload),
      text: extractEventMsgText(payload),
      lineNumber,
      sourceType: event.type
    });
    return segments;
  }

  if (event.type === "response_item") {
    const kind = responseItemKind(payload);
    pushText(segments, {
      kind,
      text: extractResponseItemText(payload),
      lineNumber,
      sourceType: event.type
    });
  }

  return segments;
}

function eventMsgKind(payload) {
  if (payload.type === "user_message") return "user_prompt";
  if (payload.type === "agent_message") return "assistant_message";
  if (payload.type === "token_count") return "token_count_event";
  if (payload.type?.includes("web_search")) return "web_search_event";
  return "event";
}

function responseItemKind(payload) {
  if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") return "tool_output";
  if (payload.type === "function_call" || payload.type === "custom_tool_call") return "tool_call";
  if (payload.type === "reasoning") return "reasoning";
  if (payload.type === "message" && payload.role === "user") return "user_prompt";
  if (payload.type === "message" && payload.role === "assistant") return "assistant_message";
  if (payload.type === "web_search_call") return "web_search_call";
  return "response_item";
}

function extractEventMsgText(payload) {
  return payload.message ?? payload.text ?? payload.content ?? JSON.stringify(payload);
}

function extractResponseItemText(payload) {
  if (typeof payload.output === "string") return payload.output;
  if (typeof payload.call_id === "string" && payload.output) return String(payload.output);
  if (Array.isArray(payload.content)) {
    return payload.content.map((item) => item.text ?? item.input_text?.text ?? item.output_text?.text ?? JSON.stringify(item)).join("\n");
  }
  if (payload.arguments) return payload.arguments;
  if (payload.name) return JSON.stringify({ name: payload.name, arguments: payload.arguments ?? payload.input });
  return JSON.stringify(payload);
}

function pushText(segments, { kind, text, lineNumber, sourceType }) {
  if (typeof text !== "string" || text.length === 0) return;
  const estimate = estimateTokens(text);
  segments.push({
    id: -1,
    kind,
    sourceType,
    lineNumber,
    tokens: estimate.tokens,
    chars: estimate.chars,
    text,
    preview: text.slice(0, 180).replace(/\s+/g, " ")
  });
}

function summarizeSegments(segments) {
  const byKind = {};
  let tokens = 0;
  let chars = 0;
  for (const segment of segments) {
    tokens += segment.tokens;
    chars += segment.chars;
    byKind[segment.kind] ??= {
      count: 0,
      tokens: 0,
      chars: 0
    };
    byKind[segment.kind].count += 1;
    byKind[segment.kind].tokens += segment.tokens;
    byKind[segment.kind].chars += segment.chars;
  }
  return {
    tokens,
    chars,
    segmentCount: segments.length,
    byKind
  };
}

function findCodexOpportunities(segments, totals) {
  const opportunities = [];
  for (const segment of segments) {
    if (segment.kind === "tool_output" && segment.tokens >= LARGE_TOOL_THRESHOLD) {
      opportunities.push(opportunity(segment, "tool-output-handle", "low", 0.78, "Large tool output can be stored behind a handle and summarized."));
    } else if (segment.kind === "base_instructions" && segment.tokens >= LARGE_INSTRUCTIONS_THRESHOLD) {
      opportunities.push(opportunity(segment, "stable-instructions-cache", "low", 0.6, "Stable instructions can be represented as a reusable context profile or handle."));
    } else if (segment.kind === "user_prompt" && segment.tokens >= LARGE_PROMPT_THRESHOLD) {
      opportunities.push(opportunity(segment, "prompt-contract", "medium", 0.35, "Long user prompts can be converted to compact task contracts with the original retained."));
    } else if (segment.kind === "assistant_message" && segment.tokens >= 800) {
      opportunities.push(opportunity(segment, "response-profile", "low", 0.3, "Verbose assistant output can use a terser response profile."));
    }
  }

  const repeated = repeatedSegmentSavings(segments);
  if (repeated.estimatedSavedTokens > Math.max(500, totals.tokens * 0.03)) {
    opportunities.push({
      type: "repeated-segment-collapse",
      riskLevel: "low",
      estimatedSavedTokens: repeated.estimatedSavedTokens,
      reason: "Repeated event content can be collapsed after first occurrence.",
      source: repeated.source
    });
  }

  return opportunities.sort((a, b) => b.estimatedSavedTokens - a.estimatedSavedTokens);
}

function opportunity(segment, type, riskLevel, ratio, reason) {
  return {
    type,
    riskLevel,
    estimatedSavedTokens: Math.round(segment.tokens * ratio),
    reason,
    source: {
      segmentId: segment.id,
      kind: segment.kind,
      lineNumber: segment.lineNumber,
      tokens: segment.tokens,
      chars: segment.chars,
      preview: segment.preview
    }
  };
}

function repeatedSegmentSavings(segments) {
  const counts = new Map();
  for (const segment of segments) {
    if (segment.tokens < 80) continue;
    const key = `${segment.kind}:${segment.text}`;
    const current = counts.get(key) ?? { count: 0, segment };
    current.count += 1;
    counts.set(key, current);
  }
  let estimatedSavedTokens = 0;
  let repeatedGroups = 0;
  for (const item of counts.values()) {
    if (item.count <= 1) continue;
    repeatedGroups += 1;
    estimatedSavedTokens += Math.round(item.segment.tokens * (item.count - 1) * 0.9);
  }
  return {
    estimatedSavedTokens,
    source: { repeatedGroups }
  };
}

function recommendForPlainTextSession(text) {
  const estimate = estimateTokens(text);
  const recommendation = estimate.tokens > 5000 ? "ask" : "skip";
  return {
    format: "plain-text",
    recommendation,
    totalTokens: estimate.tokens,
    estimatedSavedTokens: recommendation === "ask" ? Math.round(estimate.tokens * 0.25) : 0,
    estimatedPercentSaved: recommendation === "ask" ? 0.25 : 0,
    reason: recommendation === "ask" ? "Large plain-text session may benefit from MDZ summarization." : "Session is too small to justify MDZ overhead.",
    downsides: {
      addedLocalLatencyMs: Math.max(1, Math.round(estimate.chars / 150000)),
      localCpuWork: "low",
      localDiskBytes: estimate.chars,
      qualityRisk: recommendation === "ask" ? "medium" : "unknown",
      privacyCacheSensitivity: recommendation === "ask" ? "stores-original-locally" : "none",
      userApprovalPrompts: recommendation === "ask" ? 1 : 0
    },
    topOpportunities: [],
    segmentSummary: {}
  };
}

function chooseRecommendation(percent, savings, opportunities) {
  if (savings < 300 || percent < 0.05) return "skip";
  if (percent >= 0.25 && highestRisk(opportunities) !== "high") return "use";
  return "ask";
}

function recommendationReason(recommendation, percent, savings) {
  const pct = `${Math.round(percent * 1000) / 10}%`;
  if (recommendation === "use") return `Use MDZ: estimated savings are ${pct} (${savings} tokens) with acceptable risk.`;
  if (recommendation === "ask") return `Ask first: estimated savings are ${pct} (${savings} tokens), but risk or benefit needs user confirmation.`;
  return `Skip MDZ: estimated savings are only ${pct} (${savings} tokens).`;
}

function highestRisk(items) {
  const risks = items.map((item) => item.riskLevel);
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  if (risks.includes("low")) return "low";
  return "unknown";
}
