const PRICES_PER_MILLION = {
  "openai:gpt-5.1": { input: 1.25, output: 10 },
  "openai:gpt-5-mini": { input: 0.25, output: 2 },
  "anthropic:claude-sonnet-4.5": { input: 3, output: 15 },
  "google:gemini-2.5-pro": { input: 1.25, output: 10 },
  generic: { input: 1, output: 5 }
};

export function estimateCost(tokens = {}, options = {}) {
  const provider = options.provider;
  const model = options.model;
  const key = provider && model ? `${provider}:${model}` : options.priceKey ?? "generic";
  const price = {
    ...(PRICES_PER_MILLION[key] ?? PRICES_PER_MILLION.generic),
    ...(options.inputPerMillion !== undefined ? { input: Number(options.inputPerMillion) } : {}),
    ...(options.outputPerMillion !== undefined ? { output: Number(options.outputPerMillion) } : {})
  };
  const inputTokens = Number(tokens.inputTokens ?? tokens.input ?? tokens.originalTokens ?? tokens.totalTokens ?? 0);
  const outputTokens = Number(tokens.outputTokens ?? tokens.output ?? 0);
  const savedInputTokens = Number(tokens.savedInputTokens ?? tokens.savedTokens ?? 0);
  const savedOutputTokens = Number(tokens.savedOutputTokens ?? 0);
  const baseline = cost({ inputTokens, outputTokens }, price);
  const optimized = cost({
    inputTokens: Math.max(0, inputTokens - savedInputTokens),
    outputTokens: Math.max(0, outputTokens - savedOutputTokens)
  }, price);
  return {
    generatedAt: new Date().toISOString(),
    priceKey: key,
    pricePerMillion: price,
    tokens: {
      inputTokens,
      outputTokens,
      savedInputTokens,
      savedOutputTokens
    },
    cost: {
      baselineUsd: roundMoney(baseline),
      optimizedUsd: roundMoney(optimized),
      savedUsd: roundMoney(Math.max(0, baseline - optimized))
    },
    note: "Prices are configurable estimates, not provider billing records."
  };
}

export function listCostModels() {
  return {
    generatedAt: new Date().toISOString(),
    pricesPerMillionTokens: PRICES_PER_MILLION
  };
}

function cost(tokens, price) {
  return tokens.inputTokens / 1_000_000 * price.input + tokens.outputTokens / 1_000_000 * price.output;
}

function roundMoney(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
