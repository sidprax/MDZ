export function recommendToolGuardrails(input = {}) {
  const text = String(input.text ?? input.prompt ?? "");
  const plannedTool = String(input.tool ?? "");
  const recommendations = [];
  if (/read|open|cat/i.test(plannedTool) || /read (all|entire|whole)/i.test(text)) {
    recommendations.push("Use targeted search before reading full files.");
  }
  if (/npm test|pytest|test/i.test(text)) {
    recommendations.push("Run focused tests first when the failing area is known; summarize passing noise.");
  }
  if (/log|trace|output/i.test(text)) {
    recommendations.push("Filter logs around ERROR/WARN/failure markers before returning output.");
  }
  if (/repo|repository|codebase/i.test(text)) {
    recommendations.push("Create or reuse a repo memory map before broad exploration.");
  }
  if (/same file|again|reread/i.test(text)) {
    recommendations.push("Check semantic cache or file mtime before rereading unchanged files.");
  }
  return {
    generatedAt: new Date().toISOString(),
    tool: plannedTool || undefined,
    recommendationCount: recommendations.length,
    recommendations: recommendations.length ? recommendations : ["Proceed normally; no special guardrail detected."],
    riskLevel: recommendations.length > 2 ? "medium" : "low"
  };
}
