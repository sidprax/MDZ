import { classifyTask } from "./task-classifier.js";
import { estimateTokens } from "./token-estimator.js";

const TASK_BUDGETS = {
  "test-failure": { input: 30000, output: 4000, mode: "safe" },
  "log-analysis": { input: 50000, output: 3000, mode: "safe" },
  debugging: { input: 45000, output: 5000, mode: "suggest" },
  "repo-exploration": { input: 60000, output: 5000, mode: "suggest" },
  refactor: { input: 50000, output: 5000, mode: "suggest" },
  planning: { input: 35000, output: 6000, mode: "suggest" },
  "code-review": { input: 40000, output: 5000, mode: "suggest" },
  general: { input: 25000, output: 4000, mode: "enabled" }
};

export function planContextBudget(text, options = {}) {
  const classification = options.classification ?? classifyTask(text);
  const estimate = estimateTokens(text);
  const budget = TASK_BUDGETS[classification.taskType] ?? TASK_BUDGETS.general;
  const targetReduction = Number(options.targetReduction ?? 0.3);
  return {
    generatedAt: new Date().toISOString(),
    taskType: classification.taskType,
    confidence: classification.confidence,
    current: {
      inputTokens: estimate.tokens
    },
    budget: {
      inputTokens: Number(options.inputBudget ?? budget.input),
      outputTokens: Number(options.outputBudget ?? budget.output),
      targetReduction,
      recommendedMode: options.mode ?? budget.mode
    },
    status: estimate.tokens > budget.input ? "over-budget" : "within-budget",
    recommendation: estimate.tokens > budget.input
      ? "Use MDZ planning, handles, and evidence extraction before sending more context."
      : "Continue, but keep observing usage and tool output."
  };
}
