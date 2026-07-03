import { estimateTokens } from "./token-estimator.js";

export function analyzeDiffContext(diffText) {
  const text = String(diffText ?? "");
  const files = [];
  let current;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/) || line.match(/^\+\+\+ b\/(.+)$/);
    if (match) {
      current = { file: match[2] ?? match[1], added: 0, removed: 0, hunks: 0 };
      files.push(current);
    } else if (current && line.startsWith("@@")) current.hunks += 1;
    else if (current && line.startsWith("+") && !line.startsWith("+++")) current.added += 1;
    else if (current && line.startsWith("-") && !line.startsWith("---")) current.removed += 1;
  }
  const estimate = estimateTokens(text);
  return {
    generatedAt: new Date().toISOString(),
    tokens: estimate.tokens,
    files,
    recommendation: files.length
      ? "Send diff plus nearby evidence instead of full changed files."
      : "No unified diff detected; provide changed files or git diff output."
  };
}
