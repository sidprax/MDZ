export function createUsageReport(items, options = {}) {
  const entries = Array.isArray(items) ? items : [items];
  const totals = entries.reduce(
    (acc, item) => {
      const metrics = item.metrics ?? item.expected ?? item;
      acc.originalTokens += Number(metrics.originalTokens ?? metrics.totalTokens ?? 0);
      acc.reducedTokens += Number(metrics.reducedTokens ?? 0);
      acc.savedTokens += Number(metrics.savedTokens ?? metrics.savedTokensEstimate ?? 0);
      acc.addedLatencyMs += Number(metrics.estimatedLatencyMs ?? metrics.addedLatencyMs ?? 0);
      acc.localDiskBytes += Number(metrics.estimatedDiskBytes ?? metrics.localDiskBytes ?? 0);
      return acc;
    },
    {
      originalTokens: 0,
      reducedTokens: 0,
      savedTokens: 0,
      addedLatencyMs: 0,
      localDiskBytes: 0
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: options.mode ?? "enabled",
    totals: {
      ...totals,
      percentSaved: totals.originalTokens === 0 ? 0 : totals.savedTokens / totals.originalTokens
    },
    downsides: {
      addedLatencyMs: totals.addedLatencyMs,
      localDiskBytes: totals.localDiskBytes,
      localCpuWork: summarizeCpu(entries),
      qualityRisk: summarizeRisk(entries)
    },
    entries
  };
}

function summarizeCpu(entries) {
  const values = entries.map((entry) => entry.metrics?.estimatedCpuWork ?? entry.expected?.localCpuWork).filter(Boolean);
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return "unknown";
}

function summarizeRisk(entries) {
  const values = entries.map((entry) => entry.riskLevel).filter(Boolean);
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return "unknown";
}
