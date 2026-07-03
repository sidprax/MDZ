import { estimateTokens } from "./token-estimator.js";

const TASK_RULES = [
  ["test-failure", [/fail/i, /assert/i, /test/i, /jest|vitest|pytest|mocha/i]],
  ["debugging", [/error/i, /exception/i, /stack/i, /root cause/i, /bug/i]],
  ["log-analysis", [/log/i, /warn/i, /trace/i, /timeout/i, /request_id/i]],
  ["repo-exploration", [/inspect/i, /repository/i, /\brg\b/i, /package\.json/i, /file tree/i]],
  ["refactor", [/refactor/i, /rename/i, /cleanup/i, /deduplicate/i]],
  ["docs-lookup", [/docs/i, /documentation/i, /readme/i, /api reference/i]],
  ["planning", [/plan/i, /roadmap/i, /architecture/i, /design/i]],
  ["code-review", [/review/i, /risk/i, /regression/i, /findings/i]],
  ["handoff", [/handoff/i, /continue/i, /resume/i, /transfer/i]]
];

export function classifyTask(text, options = {}) {
  const content = String(text ?? "");
  const scores = TASK_RULES.map(([type, patterns]) => {
    const matches = patterns.filter((pattern) => pattern.test(content)).length;
    return {
      type,
      score: matches / patterns.length,
      matches
    };
  }).sort((a, b) => b.score - a.score || b.matches - a.matches);
  const top = scores[0] ?? { type: "general", score: 0, matches: 0 };
  const estimate = estimateTokens(content);
  return {
    generatedAt: new Date().toISOString(),
    taskType: top.score > 0 ? top.type : "general",
    confidence: top.score >= 0.5 ? "high" : top.score > 0 ? "medium" : "low",
    tokens: estimate.tokens,
    recommendedMode: recommendedModeFor(top.type, top.score, estimate.tokens),
    riskNotes: riskNotesFor(top.type),
    scores: scores.slice(0, Number(options.limit ?? 5))
  };
}

function recommendedModeFor(type, score, tokens) {
  if (score === 0 || tokens < 500) return "observe";
  if (["test-failure", "log-analysis"].includes(type)) return "safe";
  if (["repo-exploration", "debugging", "code-review"].includes(type)) return "suggest";
  if (["planning", "handoff"].includes(type)) return "suggest";
  return "observe";
}

function riskNotesFor(type) {
  if (["test-failure", "log-analysis"].includes(type)) return "Preserve errors, paths, commands, and nearby context.";
  if (type === "planning") return "Avoid aggressive summaries because tradeoffs and decisions may matter later.";
  if (type === "repo-exploration") return "Cache repo map and avoid rereading unchanged files.";
  if (type === "handoff") return "Create a state artifact with evidence, decisions, changed files, and next steps.";
  return "Use evidence extraction before reducing context.";
}
