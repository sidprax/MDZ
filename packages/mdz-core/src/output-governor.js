import { classifyTask } from "./task-classifier.js";
import { estimateTokens } from "./token-estimator.js";
import { getResponseProfile, recommendResponseProfile } from "./response-profile.js";

const TASK_OUTPUT_BUDGETS = {
  "test-failure": 600,
  debugging: 900,
  "log-analysis": 700,
  "repo-exploration": 900,
  refactor: 800,
  "docs-lookup": 900,
  planning: 1600,
  "code-review": 1200,
  handoff: 1000,
  general: 800
};

const CONTRACTS = {
  "test-failure": ["Result", "Files changed", "Validation", "Caveats"],
  debugging: ["Root cause", "Fix", "Validation", "Caveats"],
  "log-analysis": ["Root cause", "Evidence", "Recommended action"],
  "repo-exploration": ["Findings", "Relevant files", "Next step"],
  refactor: ["Changed", "Validation", "Risk"],
  "docs-lookup": ["Answer", "Source", "Caveat"],
  planning: ["Decision", "Plan", "Tradeoffs"],
  "code-review": ["Findings", "Open questions", "Residual risk"],
  handoff: ["State", "Evidence", "Next steps"],
  general: ["Result", "Validation", "Next step"]
};

export function createOutputContract(input = {}, options = {}) {
  const task = options.taskType ? { taskType: options.taskType, confidence: "provided" } : classifyTask(input.prompt ?? input.context ?? "");
  const profile = getResponseProfile(options.profile ?? recommendedProfileFor(task.taskType, options));
  const maxTokens = Number(options.maxTokens ?? TASK_OUTPUT_BUDGETS[task.taskType] ?? TASK_OUTPUT_BUDGETS.general);
  const sections = options.sections ?? CONTRACTS[task.taskType] ?? CONTRACTS.general;
  return {
    generatedAt: new Date().toISOString(),
    taskType: task.taskType,
    confidence: task.confidence,
    profile: profile.name,
    maxOutputTokens: maxTokens,
    maxLines: Number(options.maxLines ?? Math.max(4, Math.ceil(maxTokens / 90))),
    sections,
    instruction: [
      `Use MDZ output profile: ${profile.name}.`,
      `Keep final answer under about ${maxTokens} output tokens.`,
      `Use only these sections when applicable: ${sections.join(", ")}.`,
      profile.instruction,
      "Do not restate full tool output. Report deltas, failures, files, tests, and caveats only."
    ].join(" ")
  };
}

export function auditResponse(text, options = {}) {
  const response = String(text ?? "");
  const estimate = estimateTokens(response);
  const contract = options.contract ?? createOutputContract({ prompt: options.prompt ?? response }, options);
  const overBudget = estimate.tokens > contract.maxOutputTokens;
  const repeated = repeatedSentences(response);
  return {
    generatedAt: new Date().toISOString(),
    tokens: estimate.tokens,
    chars: estimate.chars,
    lines: response.split(/\r?\n/).length,
    contract,
    overBudget,
    repeated,
    estimatedSavingsIfCompressed: overBudget ? Math.max(0, estimate.tokens - contract.maxOutputTokens) : 0,
    recommendation: overBudget
      ? "Compress response before sending."
      : repeated.length
        ? "Remove repeated explanations before sending."
        : "Response is within MDZ output budget."
  };
}

export function compressResponse(text, options = {}) {
  const original = String(text ?? "");
  const contract = options.contract ?? createOutputContract({ prompt: options.prompt ?? original }, options);
  const audit = auditResponse(original, { ...options, contract });
  const units = responseUnits(original);
  const selected = selectImportantLines(units, contract.maxLines);
  const compressed = renderCompressed(selected, contract);
  const originalTokens = estimateTokens(original).tokens;
  const reducedTokens = estimateTokens(compressed).tokens;
  return {
    generatedAt: new Date().toISOString(),
    contract,
    audit,
    originalTokens,
    reducedTokens,
    estimatedSavedTokens: Math.max(0, originalTokens - reducedTokens),
    estimatedPercentSaved: originalTokens === 0 ? 0 : Math.max(0, originalTokens - reducedTokens) / originalTokens,
    compressed
  };
}

export function createAssistantOutputLedgerEvent(result, options = {}) {
  const isCompression = Number.isFinite(Number(result.reducedTokens));
  const originalTokens = Number(result.originalTokens ?? result.tokens ?? 0);
  const reducedTokens = isCompression
    ? Number(result.reducedTokens)
    : Math.max(0, originalTokens - Number(result.estimatedSavingsIfCompressed ?? 0));
  const estimatedSavedTokens = isCompression
    ? Number(result.estimatedSavedTokens ?? Math.max(0, originalTokens - reducedTokens))
    : Number(result.estimatedSavingsIfCompressed ?? 0);
  const mode = options.mode ?? "observe";
  const action = options.action ?? (isCompression ? "apply" : "observe");
  return {
    source: options.source ?? { tool: isCompression ? "compress-response" : "audit-response" },
    type: "assistant-output",
    mode,
    action,
    tokens: {
      original: originalTokens,
      reduced: action === "apply" ? reducedTokens : originalTokens
    },
    savings: {
      estimatedSavedTokens,
      estimatedPercentSaved: originalTokens === 0 ? 0 : estimatedSavedTokens / originalTokens
    },
    downsides: {
      addedLocalLatencyMs: 1,
      localCpuWork: "low",
      localDiskBytes: 0,
      qualityRisk: isCompression ? "low" : "none",
      privacyCacheSensitivity: "none",
      userApprovalPrompts: mode === "suggest" && isCompression ? 1 : 0
    },
    example: {
      technique: "assistant-output-compression",
      summary: isCompression
        ? "Removed repeated or low-priority response text while retaining task results, validation, and caveats."
        : "Measured how far the drafted response exceeded its task-aware output budget.",
      before: `${originalTokens} estimated output tokens`,
      after: action === "apply" ? `${reducedTokens} estimated output tokens` : "Audit only; response unchanged"
    },
    notes: [
      isCompression
        ? "Compressed assistant response before sending."
        : "Audited assistant response for output-token savings."
    ]
  };
}

export function createAnswerLengthContract(input = {}, options = {}) {
  return createOutputContract(input, {
    ...options,
    maxTokens: options.maxTokens ?? options.outputTokens
  });
}

export function recommendOutputBudget(input = {}, options = {}) {
  const task = options.taskType ? { taskType: options.taskType, confidence: "provided" } : classifyTask(input.prompt ?? input.context ?? "");
  const contract = createOutputContract(input, options);
  const profile = recommendResponseProfile({ outputTokens: contract.maxOutputTokens }, { targetReduction: options.targetReduction ?? 0.25 });
  return {
    generatedAt: new Date().toISOString(),
    taskType: task.taskType,
    maxOutputTokens: contract.maxOutputTokens,
    profile: profile.profile,
    maxLines: contract.maxLines,
    instruction: contract.instruction
  };
}

function recommendedProfileFor(taskType, options) {
  if (options.profile) return options.profile;
  if (["planning", "code-review"].includes(taskType)) return "standard";
  return "terse";
}

function repeatedSentences(text) {
  const counts = new Map();
  for (const sentence of text.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter((item) => item.length > 40)) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sentence, count]) => ({ sentence: sentence.slice(0, 160), count }));
}

function selectImportantLines(lines, maxLines) {
  const priority = [
    /^(done|fixed|implemented|changed|added|updated|removed|result|summary)/i,
    /(test|validated|verification|pass|fail|error|caveat|risk|next)/i,
    /(\.js|\.ts|\.tsx|\.md|\.json|\/|\\)/
  ];
  const scored = lines.map((line, index) => ({
    line,
    index,
    score: priority.reduce((sum, pattern) => sum + (pattern.test(line) ? 1 : 0), 0)
  }));
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxLines)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.line);
}

function renderCompressed(lines, contract) {
  const content = lines.length ? lines : ["Done."];
  if (contract.profile === "terse") {
    return content.slice(0, contract.maxLines).join("\n");
  }
  return content.slice(0, contract.maxLines).join("\n");
}

function responseUnits(text) {
  const units = [];
  const seen = new Set();
  for (const line of String(text ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const parts = line.length > 280 ? splitSentences(line) : [line];
    for (const part of parts) {
      const normalized = part.replace(/\s+/g, " ").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      units.push(normalized);
    }
  }
  return units;
}

function splitSentences(line) {
  const parts = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line];
  return parts.map((part) => part.trim()).filter(Boolean);
}
