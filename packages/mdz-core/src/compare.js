import { estimateTokens } from "./token-estimator.js";

export function compareContext(original, reduced, options = {}) {
  const originalText = String(original ?? "");
  const reducedText = String(reduced ?? "");
  const markers = options.markers ?? inferMarkers(originalText);
  const markerResults = markers.map((marker) => ({
    marker,
    present: reducedText.includes(marker)
  }));
  const missingMarkers = markerResults.filter((item) => !item.present).map((item) => item.marker);
  const originalEstimate = estimateTokens(originalText);
  const reducedEstimate = estimateTokens(reducedText);
  const savedTokens = Math.max(0, originalEstimate.tokens - reducedEstimate.tokens);
  const lineRetention = retainedLineRatio(originalText, reducedText);
  const riskLevel = assessRisk({ missingMarkers, lineRetention, options });

  return {
    generatedAt: new Date().toISOString(),
    passed: missingMarkers.length === 0 && riskLevel !== "high",
    riskLevel,
    tokens: {
      original: originalEstimate.tokens,
      reduced: reducedEstimate.tokens,
      saved: savedTokens,
      percentSaved: originalEstimate.tokens === 0 ? 0 : savedTokens / originalEstimate.tokens
    },
    markers: {
      checked: markers.length,
      passed: markerResults.length - missingMarkers.length,
      missing: missingMarkers,
      results: markerResults
    },
    structure: {
      originalLines: countLines(originalText),
      reducedLines: countLines(reducedText),
      retainedImportantLineRatio: lineRetention
    },
    downsides: {
      addedLocalLatencyMs: Math.max(1, Math.round((originalText.length + reducedText.length) / 250000)),
      localCpuWork: originalText.length + reducedText.length > 1000000 ? "medium" : "low",
      qualityRisk: riskLevel
    },
    notes: notesFor({ missingMarkers, lineRetention, riskLevel })
  };
}

export function renderCompareReport(report) {
  return [
    "# MDZ Context Comparison",
    "",
    `Result: ${report.passed ? "passed" : "needs review"}`,
    `Risk: ${report.riskLevel}`,
    `Estimated savings: ${formatPercent(report.tokens.percentSaved)} (${formatNumber(report.tokens.saved)} tokens)`,
    "",
    "## Marker Check",
    "",
    `- Checked: ${report.markers.checked}`,
    `- Missing: ${report.markers.missing.length}`,
    ...report.markers.missing.slice(0, 20).map((marker) => `- Missing marker: ${marker}`),
    "",
    "## Structure",
    "",
    `- Original lines: ${report.structure.originalLines}`,
    `- Reduced lines: ${report.structure.reducedLines}`,
    `- Important line retention: ${formatPercent(report.structure.retainedImportantLineRatio)}`,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`)
  ].join("\n");
}

function inferMarkers(text) {
  const candidates = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/fail|error|exception|assert|timeout|denied|unauthorized|critical|warn/i.test(trimmed)) {
      candidates.push(trimmed.slice(0, 180));
    }
    if (/[/\\][\w.-]+|[\w.-]+\.(js|ts|tsx|jsx|py|go|rs|java|md|json|yaml|yml|toml)/i.test(trimmed)) {
      candidates.push(trimmed.slice(0, 180));
    }
  }
  return [...new Set(candidates)].slice(0, 50);
}

function retainedLineRatio(original, reduced) {
  const important = original
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 24 && /fail|error|exception|assert|timeout|warn|critical|\.js|\.ts|\.py|\.md|[/\\]/i.test(line));
  if (!important.length) return 1;
  const retained = important.filter((line) => reduced.includes(line.slice(0, 120))).length;
  return retained / important.length;
}

function assessRisk({ missingMarkers, lineRetention, options }) {
  if (missingMarkers.length > 0 && options.requireMarkers !== false) return "high";
  if (lineRetention < 0.7) return "medium";
  return "low";
}

function notesFor({ missingMarkers, lineRetention, riskLevel }) {
  const notes = [];
  if (missingMarkers.length) notes.push("Reduced context is missing inferred or supplied quality markers.");
  if (lineRetention < 0.7) notes.push("Important-line retention is below the medium-risk threshold.");
  if (!notes.length) notes.push("No obvious marker loss detected.");
  notes.push(`Overall comparison risk is ${riskLevel}.`);
  return notes;
}

function countLines(text) {
  return String(text ?? "").split(/\r?\n/).length;
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}
