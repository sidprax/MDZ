import { estimateSavings } from "./token-estimator.js";

const TEST_FAIL_PATTERNS = [
  /\bFAIL\b/i,
  /\bFAILED\b/i,
  /\bERROR\b/i,
  /\bAssertionError\b/i,
  /\bExpected\b.*\bReceived\b/i,
  /\bTraceback\b/i,
  /\bException\b/i,
  /\bnot ok\b/i
];

const PASSING_TEST_PATTERNS = [
  /^\s*(PASS|PASSED|ok)\b/i,
  /\bpassed\b/i,
  /\b✓\b/,
  /\bSUCCESS\b/i
];

const LOG_IMPORTANCE_PATTERNS = [
  /\b(FATAL|CRITICAL|ERROR|WARN|WARNING)\b/i,
  /\bException\b/i,
  /\bTraceback\b/i,
  /\bfailed\b/i,
  /\btimeout\b/i,
  /\bdenied\b/i,
  /\brefused\b/i
];

export function filterOutput(text, options = {}) {
  const kind = options.kind ?? "auto";
  if (kind === "test") return filterTestOutput(text, options);
  if (kind === "log") return filterLogOutput(text, options);

  const testScore = countMatches(text, TEST_FAIL_PATTERNS) + countMatches(text, PASSING_TEST_PATTERNS);
  const logScore = countMatches(text, LOG_IMPORTANCE_PATTERNS);
  return testScore >= logScore ? filterTestOutput(text, options) : filterLogOutput(text, options);
}

export function filterTestOutput(text, options = {}) {
  const original = String(text ?? "");
  const lines = original.split(/\r?\n/);
  const windowSize = Number(options.windowSize ?? 4);
  const maxLines = Number(options.maxLines ?? 160);
  const keep = new Set();
  let passingCount = 0;

  lines.forEach((line, index) => {
    if (matchesAny(line, PASSING_TEST_PATTERNS) && !matchesAny(line, TEST_FAIL_PATTERNS)) {
      passingCount += 1;
    }
    if (matchesAny(line, TEST_FAIL_PATTERNS)) {
      addWindow(keep, index, lines.length, windowSize);
    }
  });

  if (keep.size === 0) {
    return buildFilterResult({
      original,
      reduced: summarizeQuietOutput(lines, "No obvious failing test lines found.", maxLines),
      kind: "test",
      riskLevel: "medium",
      notes: ["No failure markers were detected; output was trimmed conservatively."]
    });
  }

  const selected = [...keep].sort((a, b) => a - b).slice(0, maxLines).map((index) => {
    return `${index + 1}: ${lines[index]}`;
  });

  const header = [
    "MDZ filtered test output",
    `Original lines: ${lines.length}`,
    `Passing lines collapsed: ${passingCount}`,
    `Failure windows returned: ${selected.length}`,
    ""
  ];

  return buildFilterResult({
    original,
    reduced: [...header, ...selected].join("\n"),
    kind: "test",
    riskLevel: "low",
    notes: ["Kept windows around failure/error markers and collapsed passing-test noise."]
  });
}

export function filterLogOutput(text, options = {}) {
  const original = String(text ?? "");
  const lines = original.split(/\r?\n/);
  const windowSize = Number(options.windowSize ?? 3);
  const maxLines = Number(options.maxLines ?? 180);
  const keep = new Set();
  const duplicateCounts = new Map();

  lines.forEach((line, index) => {
    const normalized = normalizeLogLine(line);
    duplicateCounts.set(normalized, (duplicateCounts.get(normalized) ?? 0) + 1);
    if (matchesAny(line, LOG_IMPORTANCE_PATTERNS)) {
      addWindow(keep, index, lines.length, windowSize);
    }
  });

  const repeated = [...duplicateCounts.entries()]
    .filter(([, count]) => count > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (keep.size === 0) {
    return buildFilterResult({
      original,
      reduced: summarizeQuietOutput(lines, "No obvious error/warning lines found.", maxLines),
      kind: "log",
      riskLevel: "medium",
      notes: ["No severity markers were detected; output was trimmed conservatively."]
    });
  }

  const selected = [...keep].sort((a, b) => a - b).slice(0, maxLines).map((index) => {
    return `${index + 1}: ${lines[index]}`;
  });

  const repeatedSection = repeated.length
    ? ["", "Repeated signatures:", ...repeated.map(([line, count]) => `- ${count}x ${line}`)]
    : [];

  const header = [
    "MDZ filtered log output",
    `Original lines: ${lines.length}`,
    `Important windows returned: ${selected.length}`,
    ""
  ];

  return buildFilterResult({
    original,
    reduced: [...header, ...selected, ...repeatedSection].join("\n"),
    kind: "log",
    riskLevel: "low",
    notes: ["Kept windows around warning/error markers and summarized repeated signatures."]
  });
}

function buildFilterResult({ original, reduced, kind, riskLevel, notes }) {
  const savings = estimateSavings(original, reduced);
  return {
    kind,
    reduced,
    riskLevel,
    notes,
    metrics: {
      ...savings,
      originalChars: original.length,
      reducedChars: reduced.length,
      originalLines: original.split(/\r?\n/).length,
      reducedLines: reduced.split(/\r?\n/).length,
      estimatedLatencyMs: estimateLocalLatency(original.length),
      estimatedCpuWork: estimateCpuWork(original.length),
      estimatedDiskBytes: Buffer.byteLength(original, "utf8")
    }
  };
}

function summarizeQuietOutput(lines, reason, maxLines) {
  const head = lines.slice(0, Math.min(40, maxLines));
  const tail = lines.length > 80 ? lines.slice(-20) : [];
  return [
    "MDZ trimmed output",
    reason,
    `Original lines: ${lines.length}`,
    "",
    ...head,
    ...(tail.length ? ["", "...", "", ...tail] : [])
  ].join("\n");
}

function addWindow(set, index, total, windowSize) {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(total - 1, index + windowSize);
  for (let i = start; i <= end; i += 1) {
    set.add(i);
  }
}

function matchesAny(line, patterns) {
  return patterns.some((pattern) => pattern.test(line));
}

function countMatches(text, patterns) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter((line) => matchesAny(line, patterns)).length;
}

function normalizeLogLine(line) {
  return String(line ?? "")
    .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "<timestamp>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<number>")
    .trim();
}

function estimateLocalLatency(chars) {
  return Math.max(1, Math.round(chars / 250000));
}

function estimateCpuWork(chars) {
  if (chars < 100000) return "low";
  if (chars < 2000000) return "medium";
  return "high";
}
