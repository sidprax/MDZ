import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import readline from "node:readline";
import { estimateTokens } from "./token-estimator.js";

const DEFAULT_MIN_LARGE_TOKENS = 500;
const DEFAULT_TOP_LIMIT = 8;
const DEFAULT_REPEAT_MIN_TOKENS = 200;
const DEFAULT_REPEAT_LIMIT = 5;

const CATEGORY_RULES = {
  "media-inline": { rate: 0.9, riskLevel: "low", reason: "Replace inline base64/media payloads with reversible media handles and metadata." },
  "tool-output": { rate: 0.75, riskLevel: "low", reason: "Keep command status, key matches, errors, and a handle to the full output." },
  "dependency-noise": { rate: 0.8, riskLevel: "low", reason: "Collapse dependency lockfiles or package listings behind handles." },
  "conversation-history": { rate: 0.7, riskLevel: "low", reason: "Use compact prior-conversation summaries with handles to the original transcript." },
  "static-instructions": { rate: 0.55, riskLevel: "medium", reason: "Prefer prompt-cache stability and repeated-prefix diagnostics; do not rewrite host instructions directly." },
  diff: { rate: 0.35, riskLevel: "medium", reason: "Summarize file-level changes and keep the exact diff behind a handle." },
  "error-log": { rate: 0.45, riskLevel: "medium", reason: "Extract the first failure, stack traces, and counts while retaining the full log." },
  "user-input": { rate: 0.25, riskLevel: "medium", reason: "Create a task contract only when the user approves or policy allows it." },
  "assistant-output": { rate: 0.2, riskLevel: "low", reason: "Apply an output budget or terse response profile for future turns." },
  other: { rate: 0.2, riskLevel: "medium", reason: "Unknown large text should be reduced only with provenance and a retained original." }
};

export async function scanSessionFile(file, options = {}) {
  const info = await stat(file);
  const scan = createEmptyScan({
    file,
    bytes: info.size,
    platform: options.platform ?? inferPlatform(file),
    minLargeTokens: options.minLargeTokens,
    topLimit: options.topLimit,
    repeatMinTokens: options.repeatMinTokens,
    repeatLimit: options.repeatLimit
  });

  const stream = createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    scanLine(scan, line);
  }
  return finalizeScan(scan);
}

export function scanSessionText(text, options = {}) {
  const sourceText = String(text ?? "");
  const scan = createEmptyScan({
    file: options.file,
    bytes: Buffer.byteLength(sourceText, "utf8"),
    platform: options.platform ?? inferPlatform(options.file),
    minLargeTokens: options.minLargeTokens,
    topLimit: options.topLimit,
    repeatMinTokens: options.repeatMinTokens,
    repeatLimit: options.repeatLimit
  });
  for (const line of sourceText.split(/\r?\n/)) {
    scanLine(scan, line);
  }
  return finalizeScan(scan);
}

export function renderSessionScan(report) {
  return [
    "# MDZ Streaming Session Scan",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.file ?? "provided text"}`,
    `Platform: ${report.source.platform}`,
    "",
    "## Summary",
    "",
    `- File size: ${formatBytes(report.source.bytes)}`,
    `- Lines scanned: ${formatNumber(report.source.lines)}`,
    `- Parse errors: ${formatNumber(report.source.parseErrors)}`,
    `- Estimated total tokens: ${formatNumber(report.totals.estimatedTokens)}`,
    `- Estimated reducible tokens: ${formatNumber(report.totals.estimatedReducibleTokens)}`,
    `- Estimated reduction: ${formatPercent(report.totals.estimatedReductionPercent)}`,
    `- Largest risk: ${report.downsides.qualityRisk}`,
    `- Added local latency: ${report.downsides.addedLocalLatencyMs} ms`,
    `- Local CPU: ${report.downsides.localCpuWork}`,
    `- Privacy/cache impact: ${report.downsides.privacyCacheSensitivity}`,
    "",
    "## Category Breakdown",
    "",
    ...renderCategories(report.categories),
    "",
    "## Top Savings Examples",
    "",
    ...renderExamples(report.topExamples),
    "",
    "## Repeated Blocks",
    "",
    ...renderRepeated(report.repeatedBlocks),
    "",
    "## Recommendations",
    "",
    ...report.recommendations.map((item) => `- ${item}`)
  ].join("\n");
}

function createEmptyScan(options) {
  return {
    generatedAt: new Date().toISOString(),
    source: {
      file: options.file,
      platform: options.platform ?? "generic",
      bytes: options.bytes ?? 0,
      lines: 0,
      parseErrors: 0
    },
    options: {
      minLargeTokens: Number(options.minLargeTokens ?? DEFAULT_MIN_LARGE_TOKENS),
      topLimit: Number(options.topLimit ?? DEFAULT_TOP_LIMIT),
      repeatMinTokens: Number(options.repeatMinTokens ?? DEFAULT_REPEAT_MIN_TOKENS),
      repeatLimit: Number(options.repeatLimit ?? DEFAULT_REPEAT_LIMIT)
    },
    totals: {
      estimatedTokens: 0,
      longStringTokens: 0,
      estimatedReducibleTokens: 0,
      estimatedReductionPercent: 0
    },
    categories: {},
    topExamples: [],
    repeatedBlocks: [],
    _repeated: new Map()
  };
}

function scanLine(scan, line) {
  scan.source.lines += 1;
  if (!line.trim()) return;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    scan.source.parseErrors += 1;
    record = { raw: line };
  }
  for (const [path, value] of walkStrings(record)) {
    addString(scan, record, path, value);
  }
}

function addString(scan, record, path, value) {
  const tokenInfo = estimateTokens(value);
  const tokens = tokenInfo.tokens;
  const category = classifyString(path, value, record, scan.source.platform);
  const rule = CATEGORY_RULES[category] ?? CATEGORY_RULES.other;
  const estimatedReducibleTokens = tokens >= scan.options.minLargeTokens
    ? Math.floor(tokens * rule.rate)
    : 0;

  scan.totals.estimatedTokens += tokens;
  if (!scan.categories[category]) {
    scan.categories[category] = {
      category,
      estimatedTokens: 0,
      estimatedReducibleTokens: 0,
      examples: 0,
      riskLevel: rule.riskLevel,
      reason: rule.reason
    };
  }
  scan.categories[category].estimatedTokens += tokens;
  scan.categories[category].estimatedReducibleTokens += estimatedReducibleTokens;
  if (estimatedReducibleTokens > 0) {
    scan.categories[category].examples += 1;
    scan.totals.longStringTokens += tokens;
    scan.totals.estimatedReducibleTokens += estimatedReducibleTokens;
    pushTopExample(scan, {
      category,
      path,
      estimatedTokens: tokens,
      estimatedReducibleTokens,
      riskLevel: rule.riskLevel,
      reason: rule.reason,
      preview: previewText(value, 180)
    });
  }

  if (tokens >= scan.options.repeatMinTokens) {
    const hash = contentHash(value);
    const repeated = scan._repeated.get(hash) ?? {
      occurrences: 0,
      estimatedTokensEach: tokens,
      category,
      preview: previewText(value, 100)
    };
    repeated.occurrences += 1;
    scan._repeated.set(hash, repeated);
  }
}

function finalizeScan(scan) {
  scan.totals.estimatedReductionPercent = scan.totals.estimatedTokens === 0
    ? 0
    : scan.totals.estimatedReducibleTokens / scan.totals.estimatedTokens;
  scan.categories = Object.values(scan.categories)
    .sort((a, b) => b.estimatedReducibleTokens - a.estimatedReducibleTokens);
  scan.repeatedBlocks = [...scan._repeated.values()]
    .filter((item) => item.occurrences > 1)
    .map((item) => ({
      ...item,
      estimatedRepeatWasteTokens: (item.occurrences - 1) * item.estimatedTokensEach
    }))
    .sort((a, b) => b.estimatedRepeatWasteTokens - a.estimatedRepeatWasteTokens)
    .slice(0, scan.options.repeatLimit);
  delete scan._repeated;
  scan.downsides = estimateScanDownsides(scan);
  scan.recommendations = createScanRecommendations(scan);
  return scan;
}

function classifyString(path, value, record, platform) {
  const type = String(record.type ?? record.source ?? record.event ?? record.role ?? "").toLowerCase();
  const lowerPath = String(path ?? "").toLowerCase();
  const lowerValue = String(value ?? "").slice(0, 700).toLowerCase();

  if (isInlineMedia(value, lowerPath)) return "media-inline";
  if (lowerPath.includes("base_instructions") || lowerValue.includes("you are codex")) return "static-instructions";
  if (type.includes("conversation_history") || lowerValue.includes("# conversation history")) return "conversation-history";
  if (isToolLike(type, lowerPath, platform)) return "tool-output";
  if (type.includes("user") || (lowerPath.endsWith("content") && lowerValue.includes("<user_request>"))) return "user-input";
  if (type.includes("assistant") || lowerPath.includes("response") || lowerPath.includes("message")) return "assistant-output";
  if (lowerValue.includes("node_modules") || lowerValue.includes("package-lock") || lowerValue.includes("npm")) return "dependency-noise";
  if (lowerValue.includes("diff --git") || lowerValue.includes("@@")) return "diff";
  if (lowerValue.includes("error") || lowerValue.includes("exception") || lowerValue.includes("failed")) return "error-log";
  return "other";
}

function isToolLike(type, path, platform) {
  if (type.includes("tool")) return true;
  if (path.includes("tool") || path.includes("output") || path.includes("stdout") || path.includes("stderr")) return true;
  if (platform === "antigravity" && (path.includes("codecontent") || path.includes("targetcontent") || path.includes("replacementcontent"))) return true;
  return false;
}

function isInlineMedia(value, path) {
  const text = String(value ?? "");
  if (path.includes("image_url") || path.includes("data_url")) return text.startsWith("data:image/") || text.length > 4000;
  return /^data:(image|audio|video)\//i.test(text) || /^[A-Za-z0-9+/]{4000,}={0,2}$/.test(text);
}

function walkStrings(value, out = [], path = "") {
  if (typeof value === "string") {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, out, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, out, path ? `${path}.${key}` : key);
    }
  }
  return out;
}

function pushTopExample(scan, item) {
  scan.topExamples.push(item);
  scan.topExamples.sort((a, b) => b.estimatedReducibleTokens - a.estimatedReducibleTokens);
  if (scan.topExamples.length > scan.options.topLimit) {
    scan.topExamples.length = scan.options.topLimit;
  }
}

function estimateScanDownsides(scan) {
  const riskScore = Math.max(...scan.categories.map((item) => riskRank(item.riskLevel)), 0);
  const mb = scan.source.bytes / 1024 / 1024;
  return {
    addedLocalLatencyMs: Math.max(10, Math.round(mb * 12)),
    localCpuWork: mb > 25 ? "high" : mb > 5 ? "medium" : "low",
    localDiskBytes: 0,
    qualityRisk: riskLabel(riskScore),
    privacyCacheSensitivity: "Scan does not store original content; applying reductions may store originals locally behind handles.",
    userApprovalPrompts: 0
  };
}

function createScanRecommendations(scan) {
  const categories = new Set(scan.categories.filter((item) => item.estimatedReducibleTokens > 0).map((item) => item.category));
  const recommendations = [];
  if (categories.has("media-inline")) recommendations.push("Add media/base64 handle reduction before sending screenshots or image payloads to the model.");
  if (categories.has("tool-output")) recommendations.push("Route noisy tool calls through mdz_gateway so large outputs are summarized with expandable handles.");
  if (categories.has("static-instructions") || scan.repeatedBlocks.length) recommendations.push("Track repeated prompt prefixes and warn when cache stability is likely to be lost.");
  if (scan.source.platform === "antigravity") recommendations.push("Use Antigravity-aware rules for tool_calls, ephemeral messages, and CodeContent/TargetContent blocks.");
  if (scan.totals.estimatedReductionPercent >= 0.15) recommendations.push("Use enabled mode for this project; the estimated savings justify asking before applying reductions.");
  if (!recommendations.length) recommendations.push("No large savings opportunity found; keep MDZ in suggest mode and continue collecting usage.");
  return recommendations;
}

function inferPlatform(file = "") {
  const normalized = String(file).toLowerCase();
  if (normalized.includes(".gemini") || normalized.includes("antigravity")) return "antigravity";
  if (normalized.includes(".codex") || normalized.includes("rollout-")) return "codex";
  if (normalized.includes(".claude")) return "claude";
  return "generic";
}

function contentHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function previewText(value, maxLength) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function renderCategories(categories) {
  if (!categories.length) return ["- No category data found."];
  return categories.map((item) => {
    return `- ${item.category}: ${formatNumber(item.estimatedTokens)} tokens, save ~${formatNumber(item.estimatedReducibleTokens)}, risk=${item.riskLevel}. ${item.reason}`;
  });
}

function renderExamples(examples) {
  if (!examples.length) return ["- No large savings examples found."];
  return examples.map((item, index) => {
    return `${index + 1}. ${item.category} at ${item.path || "<root>"}: save ~${formatNumber(item.estimatedReducibleTokens)} of ${formatNumber(item.estimatedTokens)} tokens, risk=${item.riskLevel}. ${item.preview}`;
  });
}

function renderRepeated(repeated) {
  if (!repeated.length) return ["- No repeated large blocks found."];
  return repeated.map((item, index) => {
    return `${index + 1}. ${item.occurrences} occurrences, ${formatNumber(item.estimatedTokensEach)} tokens each, repeat waste ~${formatNumber(item.estimatedRepeatWasteTokens)}. ${item.preview}`;
  });
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function riskRank(value) {
  return { low: 1, medium: 2, high: 3 }[value] ?? 0;
}

function riskLabel(value) {
  if (value >= 3) return "high";
  if (value >= 2) return "medium";
  if (value >= 1) return "low";
  return "unknown";
}
