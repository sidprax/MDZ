import { estimateTokens } from "./token-estimator.js";

export function runCompressionExperiment(text, options = {}) {
  const original = String(text ?? "");
  const dictionary = buildDictionary(original, Number(options.limit ?? 12));
  let encoded = original;
  dictionary.forEach((entry, index) => {
    encoded = encoded.split(entry.phrase).join(`§${index}§`);
  });
  const decoderPrompt = dictionary.map((entry, index) => `§${index}§=${entry.phrase}`).join("\n");
  const originalTokens = estimateTokens(original).tokens;
  const encodedTokens = estimateTokens(`${decoderPrompt}\n${encoded}`).tokens;
  return {
    generatedAt: new Date().toISOString(),
    originalTokens,
    encodedTokens,
    savedTokens: Math.max(0, originalTokens - encodedTokens),
    percentSaved: originalTokens === 0 ? 0 : Math.max(0, originalTokens - encodedTokens) / originalTokens,
    dictionary,
    warning: "This tests prompt-level dictionary encoding only. Provider billing still counts decoder instructions and encoded text."
  };
}

function buildDictionary(text, limit) {
  const counts = new Map();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 24);
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase: phrase.slice(0, 160), count }))
    .sort((a, b) => b.count * b.phrase.length - a.count * a.phrase.length)
    .slice(0, limit);
}
