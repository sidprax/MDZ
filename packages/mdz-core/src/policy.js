export const POLICY_PROFILES = {
  observe: {
    mode: "observe",
    autoApply: false,
    askUser: false,
    maxAutoRisk: "none",
    minSavingsPercent: 0,
    description: "Measure only. Do not change context."
  },
  suggest: {
    mode: "suggest",
    autoApply: false,
    askUser: true,
    maxAutoRisk: "none",
    minSavingsPercent: 0.05,
    description: "Recommend actions and ask before applying."
  },
  enabled: {
    mode: "enabled",
    autoApply: false,
    askUser: true,
    maxAutoRisk: "none",
    minSavingsPercent: 0.05,
    description: "Enabled standard mode. Recommend actions and ask before applying."
  },
  safe: {
    mode: "safe",
    autoApply: true,
    askUser: false,
    maxAutoRisk: "low",
    minSavingsPercent: 0.08,
    description: "Automatically apply low-risk deterministic reductions."
  },
  balanced: {
    mode: "balanced",
    autoApply: true,
    askUser: true,
    maxAutoRisk: "medium",
    minSavingsPercent: 0.15,
    description: "Use handles and provenance-backed summaries; ask on medium risk."
  },
  aggressive: {
    mode: "aggressive",
    autoApply: false,
    askUser: true,
    maxAutoRisk: "high",
    minSavingsPercent: 0.25,
    description: "Prioritize savings with explicit user confirmation."
  }
};

export const DEFAULT_POLICY = {
  version: 1,
  mode: "enabled",
  storeOriginals: true,
  minSavingsPercent: 0.08,
  maxAutoRisk: "low",
  explainEveryDecision: true,
  visibilityLevel: "visible",
  digestCadence: "daily",
  reportDir: ".mdz/reports",
  storeDir: ".mdz/store"
};

const RISK_ORDER = {
  none: 0,
  unknown: 1,
  low: 2,
  medium: 3,
  high: 4
};

export function getPolicyProfile(mode = "suggest") {
  return POLICY_PROFILES[mode] ?? POLICY_PROFILES.suggest;
}

export function createPolicy(overrides = {}) {
  const mode = overrides.mode ?? DEFAULT_POLICY.mode;
  const profile = getPolicyProfile(mode);
  return {
    ...DEFAULT_POLICY,
    mode,
    minSavingsPercent: overrides.minSavingsPercent ?? profile.minSavingsPercent,
    maxAutoRisk: overrides.maxAutoRisk ?? profile.maxAutoRisk,
    storeOriginals: overrides.storeOriginals ?? DEFAULT_POLICY.storeOriginals,
    explainEveryDecision: overrides.explainEveryDecision ?? DEFAULT_POLICY.explainEveryDecision,
    visibilityLevel: overrides.visibilityLevel ?? DEFAULT_POLICY.visibilityLevel,
    digestCadence: overrides.digestCadence ?? DEFAULT_POLICY.digestCadence,
    reportDir: overrides.reportDir ?? DEFAULT_POLICY.reportDir,
    storeDir: overrides.storeDir ?? DEFAULT_POLICY.storeDir
  };
}

export function decideAdvisorAction(recommendation, mode = "suggest") {
  const policy = getPolicyProfile(mode);
  const risk = recommendation.downsides?.qualityRisk ?? "unknown";
  const savingsPercent = recommendation.estimatedPercentSaved ?? 0;
  const riskAllowed = RISK_ORDER[risk] <= RISK_ORDER[policy.maxAutoRisk];
  const enoughSavings = savingsPercent >= policy.minSavingsPercent;

  if (policy.mode === "observe") return "observe";
  if (recommendation.recommendation === "skip") return "skip";
  if (policy.autoApply && riskAllowed && enoughSavings) return "apply";
  if (policy.askUser || recommendation.recommendation === "ask") return "ask";
  return "skip";
}
