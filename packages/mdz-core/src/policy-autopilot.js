export function recommendPolicy(report = {}, options = {}) {
  const targetReduction = Number(options.targetReduction ?? options.target ?? 0.3);
  const totals = report.totals ?? report.summary ?? report.savings ?? {};
  const observedSavings = Number(
    totals.estimatedPercentSaved
    ?? totals.percentSaved
    ?? report.advisor?.savings?.estimatedPercentSaved
    ?? 0
  );
  const risk = report.downsides?.qualityRisk
    ?? report.advisor?.downsides?.qualityRisk
    ?? totals.highestRisk
    ?? "unknown";
  const events = Number(totals.events ?? report.scenarioCount ?? 1);
  const interruptions = Number(report.downsides?.workflowInterruptions ?? report.downsides?.userInterruptions ?? 0);
  const recommendedMode = chooseMode({ observedSavings, targetReduction, risk, events, interruptions });

  return {
    generatedAt: new Date().toISOString(),
    targetReduction,
    observedSavings,
    risk,
    events,
    interruptions,
    recommendedMode,
    policy: policyForMode(recommendedMode, targetReduction),
    reason: explain({ recommendedMode, observedSavings, targetReduction, risk, interruptions })
  };
}

function chooseMode({ observedSavings, targetReduction, risk, events, interruptions }) {
  if (events < 3) return "enabled";
  if (risk === "high") return "suggest";
  if (interruptions > Math.max(2, events * 0.2)) return "suggest";
  if (observedSavings >= targetReduction && risk === "low") return "safe";
  if (observedSavings >= targetReduction && risk === "medium") return "balanced";
  if (observedSavings >= Math.max(0.08, targetReduction * 0.5)) return "suggest";
  return "enabled";
}

function policyForMode(mode, targetReduction) {
  const minimums = {
    observe: 0,
    enabled: Math.max(0.05, targetReduction * 0.25),
    suggest: Math.max(0.05, targetReduction * 0.25),
    safe: Math.max(0.08, targetReduction * 0.35),
    balanced: Math.max(0.12, targetReduction * 0.45),
    aggressive: Math.max(0.2, targetReduction * 0.6)
  };
  const risks = {
    observe: "none",
    enabled: "none",
    suggest: "none",
    safe: "low",
    balanced: "medium",
    aggressive: "high"
  };
  return {
    mode,
    minSavingsPercent: minimums[mode] ?? 0.08,
    maxAutoRisk: risks[mode] ?? "low"
  };
}

function explain({ recommendedMode, observedSavings, targetReduction, risk, interruptions }) {
  const pct = Math.round(observedSavings * 1000) / 10;
  const target = Math.round(targetReduction * 1000) / 10;
  if (recommendedMode === "observe") return `Keep observing: observed savings are ${pct}% against a ${target}% target.`;
  if (recommendedMode === "enabled") return `Use enabled mode: observed savings are ${pct}% against a ${target}% target; ask before applying reductions.`;
  if (recommendedMode === "suggest") return `Suggest before applying: savings are plausible, but risk=${risk} or interruptions=${interruptions} require user trust.`;
  if (recommendedMode === "safe") return `Use safe mode: observed savings are ${pct}% with low quality risk.`;
  if (recommendedMode === "balanced") return `Use balanced mode with confirmation: savings meet target but quality risk is medium.`;
  return `Use ${recommendedMode} only with explicit confirmation.`;
}
