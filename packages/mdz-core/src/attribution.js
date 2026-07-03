export function attributeSavings(input = {}) {
  const reports = Array.isArray(input.reports) ? input.reports : input.reports ? [input.reports] : [];
  const sources = {};
  for (const report of reports) {
    add(sources, report.scenario?.type ?? report.type ?? "unknown", report.savings?.estimatedTokensSaved ?? report.savings?.estimatedSavedTokens ?? 0);
    for (const opportunity of report.analysis?.opportunities ?? report.summary?.topOpportunities ?? []) {
      add(sources, opportunity.type, opportunity.estimatedSavedTokens ?? 0);
    }
    for (const note of report.mdz?.notes ?? []) {
      if (/failure|test/i.test(note)) add(sources, "tool-output-filtering", report.savings?.estimatedTokensSaved ?? 0);
      if (/handle/i.test(note)) add(sources, "handle-storage", report.savings?.estimatedTokensSaved ?? 0);
    }
  }
  const total = Object.values(sources).reduce((sum, value) => sum + value, 0);
  return {
    generatedAt: new Date().toISOString(),
    totalAttributedTokens: total,
    sources: Object.fromEntries(Object.entries(sources).sort((a, b) => b[1] - a[1]))
  };
}

function add(target, key, value) {
  target[key || "unknown"] = (target[key || "unknown"] ?? 0) + Number(value ?? 0);
}
