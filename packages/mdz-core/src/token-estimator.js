const TOKEN_PATTERN = /[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g;

export function estimateTokens(input) {
  const text = String(input ?? "");
  if (!text) {
    return {
      tokens: 0,
      chars: 0,
      words: 0,
      method: "heuristic-v1",
      confidence: "medium"
    };
  }

  const matches = text.match(TOKEN_PATTERN) ?? [];
  const charEstimate = Math.ceil(text.length / 4);
  const tokenEstimate = Math.max(matches.length, charEstimate);

  return {
    tokens: tokenEstimate,
    chars: text.length,
    words: countWords(text),
    method: "heuristic-v1",
    confidence: "medium"
  };
}

export function estimateSavings(originalText, reducedText) {
  const original = estimateTokens(originalText);
  const reduced = estimateTokens(reducedText);
  const savedTokens = Math.max(0, original.tokens - reduced.tokens);
  const percentSaved = original.tokens === 0 ? 0 : savedTokens / original.tokens;

  return {
    originalTokens: original.tokens,
    reducedTokens: reduced.tokens,
    savedTokens,
    percentSaved,
    estimator: original.method,
    confidence: "medium"
  };
}

function countWords(text) {
  const words = text.match(/[A-Za-z0-9_]+/g);
  return words ? words.length : 0;
}
