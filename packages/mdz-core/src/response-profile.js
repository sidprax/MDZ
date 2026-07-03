const RESPONSE_PROFILES = {
  terse: {
    name: "terse",
    outputTokenMultiplier: 0.55,
    instruction: "Answer directly with only the essential result, verification, and next step. Avoid background unless requested."
  },
  standard: {
    name: "standard",
    outputTokenMultiplier: 0.75,
    instruction: "Keep responses concise. Include what changed, validation, and important caveats."
  },
  detailed: {
    name: "detailed",
    outputTokenMultiplier: 1,
    instruction: "Use normal detail. Explain reasoning when it materially helps the user."
  }
};

export function getResponseProfile(name = "standard") {
  return RESPONSE_PROFILES[name] ?? RESPONSE_PROFILES.standard;
}

export function recommendResponseProfile(input = {}, options = {}) {
  const targetReduction = Number(options.targetReduction ?? 0.25);
  const outputTokens = Number(input.outputTokens ?? input.totalTokens ?? 0);
  const profile = targetReduction >= 0.4 ? RESPONSE_PROFILES.terse : targetReduction >= 0.15 ? RESPONSE_PROFILES.standard : RESPONSE_PROFILES.detailed;
  const reducedOutputTokens = Math.round(outputTokens * profile.outputTokenMultiplier);
  return {
    generatedAt: new Date().toISOString(),
    profile: profile.name,
    instruction: profile.instruction,
    outputTokens,
    reducedOutputTokens,
    estimatedSavedTokens: Math.max(0, outputTokens - reducedOutputTokens),
    estimatedPercentSaved: outputTokens === 0 ? 0 : Math.max(0, outputTokens - reducedOutputTokens) / outputTokens,
    riskLevel: profile.name === "terse" ? "medium" : "low"
  };
}

export function listResponseProfiles() {
  return {
    generatedAt: new Date().toISOString(),
    profiles: RESPONSE_PROFILES
  };
}
