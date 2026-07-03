import { estimateTokens } from "./token-estimator.js";

const CORE_PATTERNS = [
  /(?:read|open|get).*(?:file|text|content)/i,
  /(?:write|edit|patch|replace).*(?:file|text|content)/i,
  /(?:shell|terminal|command|exec|run)/i,
  /(?:search|find|grep).*(?:file|code|workspace|text)?/i
];

export function planToolDeferral(input, options = {}) {
  const tools = parseTools(input);
  const usage = options.usage ?? {};
  const explicitCore = new Set(options.coreTools ?? []);
  const maxCoreTools = Number(options.maxCoreTools ?? 8);
  const ranked = tools.map((tool, index) => {
    const name = toolName(tool, index);
    const usageCount = Number(usage[name] ?? 0);
    const common = CORE_PATTERNS.some((pattern) => pattern.test(`${name} ${tool.description ?? ""}`));
    return {
      tool,
      name,
      usageCount,
      explicit: explicitCore.has(name),
      common,
      score: (explicitCore.has(name) ? 100000 : 0) + usageCount * 100 + (common ? 1000 : 0) - index
    };
  }).sort((a, b) => b.score - a.score);

  const coreNames = new Set(ranked.slice(0, Math.min(maxCoreTools, ranked.length)).map((item) => item.name));
  for (const name of explicitCore) coreNames.add(name);
  const coreTools = tools.filter((tool, index) => coreNames.has(toolName(tool, index)));
  const deferredTools = tools.filter((tool, index) => !coreNames.has(toolName(tool, index)));
  const deferredMetadata = deferredTools.map((tool, index) => metadataFor(tool, index));
  const fullSchemaTokens = estimateTokens(JSON.stringify(tools)).tokens;
  const upfrontTokens = estimateTokens(JSON.stringify({ coreTools, deferredTools: deferredMetadata })).tokens
    + Number(options.routerOverheadTokens ?? 120);

  return {
    generatedAt: new Date().toISOString(),
    strategy: "core-plus-deferred",
    coreTools: coreTools.map((tool, index) => metadataFor(tool, index)),
    deferredTools: deferredMetadata,
    catalog: options.includeCatalog
      ? Object.fromEntries(tools.map((tool, index) => [toolName(tool, index), tool]))
      : undefined,
    metrics: {
      tools: tools.length,
      coreTools: coreTools.length,
      deferredTools: deferredTools.length,
      fullSchemaTokens,
      estimatedUpfrontTokens: upfrontTokens,
      estimatedSavedTokensPerTurn: Math.max(0, fullSchemaTokens - upfrontTokens),
      estimatedPercentSavedPerTurn: fullSchemaTokens === 0 ? 0 : Math.max(0, fullSchemaTokens - upfrontTokens) / fullSchemaTokens
    },
    downsides: {
      extraSearchCallWhenDeferredToolNeeded: deferredTools.length > 0 ? 1 : 0,
      localCpuWork: "low",
      qualityRisk: deferredTools.length > 0 ? "low" : "none",
      warning: "Savings require the host to expose the deferred catalog through an MDZ gateway instead of loading every full schema."
    }
  };
}

export function searchToolCatalog(input, query, options = {}) {
  const tools = parseTools(input);
  const queryTerms = terms(query);
  const usage = options.usage ?? {};
  const loaded = new Set(options.loadedTools ?? []);
  const limit = Number(options.limit ?? 5);
  const minScore = Number(options.minScore ?? 4);
  const results = tools.map((tool, index) => scoreTool(tool, index, queryTerms, usage, loaded))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    .slice(0, limit);
  const discoveredTools = results.map((item) => item.name);
  return {
    generatedAt: new Date().toISOString(),
    query: String(query ?? ""),
    queryTerms,
    results,
    session: {
      previouslyLoadedTools: [...loaded],
      discoveredTools,
      loadedTools: [...new Set([...loaded, ...discoveredTools])]
    },
    downsides: {
      localCpuWork: "low",
      modelCalls: 0,
      qualityRisk: results.length ? "low" : "medium",
      warning: results.length ? undefined : "No deterministic tool match was found; load a broader namespace or ask the user."
    }
  };
}

function scoreTool(tool, index, queryTerms, usage, loaded) {
  const name = toolName(tool, index);
  const nameTerms = new Set(terms(name));
  const descriptionTerms = new Set(terms(tool.description ?? ""));
  const schemaTerms = new Set(terms(schemaKeys(tool.inputSchema ?? tool.parameters ?? {})));
  const matched = [];
  let score = 0;
  for (const term of queryTerms) {
    if (nameTerms.has(term)) {
      score += 8;
      matched.push(`${term}:name`);
    } else if ([...nameTerms].some((candidate) => candidate.includes(term) || term.includes(candidate))) {
      score += 5;
      matched.push(`${term}:name-partial`);
    }
    if (descriptionTerms.has(term)) {
      score += 3;
      matched.push(`${term}:description`);
    }
    if (schemaTerms.has(term)) {
      score += 2;
      matched.push(`${term}:parameter`);
    }
  }
  const usageCount = Number(usage[name] ?? 0);
  score += Math.min(5, Math.log2(usageCount + 1));
  if (loaded.has(name)) score += 1;
  return {
    name,
    namespace: tool.namespace,
    description: compactDescription(tool.description),
    score: Math.round(score * 100) / 100,
    usageCount,
    alreadyLoaded: loaded.has(name),
    matched: [...new Set(matched)],
    schema: optionsSchema(tool)
  };
}

function optionsSchema(tool) {
  return tool.inputSchema ?? tool.parameters ?? { type: "object", properties: {} };
}

function parseTools(input) {
  const value = typeof input === "string" ? JSON.parse(input) : input ?? {};
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.tools)) return value.tools;
  if (Array.isArray(value?.result?.tools)) return value.result.tools;
  return [];
}

function metadataFor(tool, index) {
  return {
    name: toolName(tool, index),
    namespace: tool.namespace,
    description: compactDescription(tool.description)
  };
}

function toolName(tool, index) {
  return tool?.name ?? tool?.title ?? `tool_${index}`;
}

function compactDescription(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) return normalized;
  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (sentence && sentence.length <= 120) return sentence;
  return `${normalized.slice(0, 117).trimEnd()}...`;
}

function schemaKeys(value) {
  if (Array.isArray(value)) return value.map(schemaKeys).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value).map(([key, child]) => `${key} ${schemaKeys(child)}`).join(" ");
}

function terms(value) {
  return [...new Set(String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
    .map(stem)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
}

function stem(value) {
  return value.replace(/(?:ing|ed|es|s)$/i, (suffix) => value.length - suffix.length >= 3 ? "" : suffix);
}

const STOP_WORDS = new Set(["a", "all", "an", "and", "any", "every", "for", "from", "in", "of", "on", "or", "that", "the", "this", "to", "with"]);
