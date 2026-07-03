import { estimateTokens } from "./token-estimator.js";

export function analyzeToolSchema(input, options = {}) {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? {}, null, 2);
  const parsed = parseJson(text);
  const tools = extractTools(parsed.value);
  const total = estimateTokens(text);
  const toolReports = tools.map((tool, index) => {
    const serialized = JSON.stringify(tool);
    const estimate = estimateTokens(serialized);
    return {
      index,
      name: tool.name ?? tool.title ?? `tool_${index}`,
      tokens: estimate.tokens,
      chars: estimate.chars,
      hasDescription: Boolean(tool.description),
      recommendation: recommendTool(tool, estimate.tokens)
    };
  }).sort((a, b) => b.tokens - a.tokens);
  const estimatedSavedTokens = toolReports.reduce((sum, tool) => sum + tool.recommendation.estimatedSavedTokens, 0);
  return {
    generatedAt: new Date().toISOString(),
    parseError: parsed.error,
    totals: {
      tools: toolReports.length,
      tokens: total.tokens,
      chars: total.chars,
      estimatedSavedTokens,
      estimatedPercentSaved: total.tokens === 0 ? 0 : estimatedSavedTokens / total.tokens
    },
    largestTools: toolReports.slice(0, Number(options.limit ?? 10)),
    recommendations: summarizeRecommendations(toolReports)
  };
}

export function compactToolSchemas(input, options = {}) {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? {}, null, 2);
  const parsed = parseJson(text);
  if (parsed.error) {
    return {
      generatedAt: new Date().toISOString(),
      parseError: parsed.error,
      compatible: false,
      compacted: undefined
    };
  }

  const changes = [];
  const compacted = compactValue(parsed.value, {
    path: "$",
    changes,
    maxToolDescriptionChars: Number(options.maxToolDescriptionChars ?? 220),
    maxFieldDescriptionChars: Number(options.maxFieldDescriptionChars ?? 120),
    removeExamples: options.removeExamples !== false
  });
  const originalTools = extractTools(parsed.value);
  const compactedTools = extractTools(compacted);
  const compatibility = compareToolContracts(originalTools, compactedTools);
  const originalTokens = estimateTokens(JSON.stringify(parsed.value)).tokens;
  const reducedTokens = estimateTokens(JSON.stringify(compacted)).tokens;
  return {
    generatedAt: new Date().toISOString(),
    compatible: compatibility.compatible,
    compatibility,
    metrics: {
      tools: originalTools.length,
      originalTokens,
      reducedTokens,
      estimatedSavedTokens: Math.max(0, originalTokens - reducedTokens),
      estimatedPercentSaved: originalTokens === 0 ? 0 : Math.max(0, originalTokens - reducedTokens) / originalTokens,
      changes: changes.length
    },
    changes,
    compacted
  };
}

function parseJson(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { value: undefined, error: error.message };
  }
}

function extractTools(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.tools)) return value.tools;
  if (Array.isArray(value?.result?.tools)) return value.result.tools;
  if (value.mcpServers) return Object.entries(value.mcpServers).map(([name, config]) => ({ name, ...config }));
  return [value];
}

function recommendTool(tool, tokens) {
  const description = String(tool.description ?? "");
  const saved = Math.max(0, Math.round((tokens - 120) * 0.35));
  if (tokens > 300) {
    return {
      action: "compact-schema",
      estimatedSavedTokens: saved,
      reason: "Large tool schemas can often shorten descriptions, examples, and nested option text."
    };
  }
  if (description.length > 240) {
    return {
      action: "shorten-description",
      estimatedSavedTokens: Math.round(tokens * 0.15),
      reason: "Tool description is long enough to benefit from a compact variant."
    };
  }
  return {
    action: "keep",
    estimatedSavedTokens: 0,
    reason: "Schema is already compact."
  };
}

function summarizeRecommendations(tools) {
  const counts = {};
  for (const tool of tools) {
    counts[tool.recommendation.action] = (counts[tool.recommendation.action] ?? 0) + 1;
  }
  return counts;
}

function compactValue(value, context) {
  if (Array.isArray(value)) {
    return value.map((item, index) => compactValue(item, { ...context, path: `${context.path}[${index}]` }));
  }
  if (!value || typeof value !== "object") return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${context.path}.${key}`;
    if (context.removeExamples && ["example", "examples", "$comment"].includes(key)) {
      context.changes.push({ path: childPath, action: "remove-documentation", beforeChars: JSON.stringify(child).length });
      continue;
    }
    if (key === "description" && typeof child === "string") {
      const isToolDescription = context.path.match(/(?:tools|result\.tools)\[\d+\]$/) || context.path === "$";
      const limit = isToolDescription ? context.maxToolDescriptionChars : context.maxFieldDescriptionChars;
      const shortened = shortenDescription(child, limit);
      result[key] = shortened;
      if (shortened !== child) {
        context.changes.push({
          path: childPath,
          action: "shorten-description",
          beforeChars: child.length,
          afterChars: shortened.length
        });
      }
      continue;
    }
    result[key] = compactValue(child, { ...context, path: childPath });
  }
  return result;
}

function shortenDescription(value, limit) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 24 && firstSentence.length <= limit) return firstSentence;
  return `${normalized.slice(0, Math.max(1, limit - 3)).trimEnd()}...`;
}

function compareToolContracts(originalTools, compactedTools) {
  const originalNames = originalTools.map(toolName);
  const compactedNames = compactedTools.map(toolName);
  const issues = [];
  if (originalTools.length !== compactedTools.length) {
    issues.push(`Tool count changed from ${originalTools.length} to ${compactedTools.length}.`);
  }
  if (JSON.stringify(originalNames) !== JSON.stringify(compactedNames)) {
    issues.push("Tool names or ordering changed.");
  }
  for (let index = 0; index < Math.min(originalTools.length, compactedTools.length); index += 1) {
    const originalContract = stripDocumentation(originalTools[index]);
    const compactedContract = stripDocumentation(compactedTools[index]);
    if (stableJson(originalContract) !== stableJson(compactedContract)) {
      issues.push(`Validation contract changed for ${originalNames[index]}.`);
    }
  }
  return {
    compatible: issues.length === 0,
    originalToolNames: originalNames,
    compactedToolNames: compactedNames,
    issues
  };
}

function stripDocumentation(value) {
  if (Array.isArray(value)) return value.map(stripDocumentation);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["description", "example", "examples", "$comment"].includes(key))
    .map(([key, child]) => [key, stripDocumentation(child)]));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function toolName(tool, index) {
  return tool?.name ?? tool?.title ?? `tool_${index}`;
}
