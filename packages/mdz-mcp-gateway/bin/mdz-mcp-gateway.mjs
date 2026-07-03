#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  expandContext,
  prepareModelFacingReduction,
  readPolicy,
  recordModelFacingDelivery,
  recordModelFacingObservation,
  searchToolCatalog
} from "../../mdz-core/src/index.js";

const configPath = path.resolve(process.env.MDZ_GATEWAY_CONFIG ?? ".mdz/gateway.json");
const config = await loadConfig(configPath);
const policy = { ...await readPolicy({ file: config.policyFile }), ...config.policy };
const upstreams = await connectUpstreams(config.mcpServers ?? {});
const catalog = upstreams.flatMap(({ name, tools }) => tools.map((tool) => ({
  ...tool,
  name: `${name}__${tool.name}`,
  namespace: name,
  upstreamName: tool.name
})));

const server = new McpServer({ name: "mdz-gateway", version: "0.1.0" });

server.registerTool("mdz_gateway_status", {
  title: "MDZ Gateway Status",
  description: "Show connected upstream MCP servers, deferred tool counts, policy, and gateway configuration.",
  inputSchema: {}
}, async () => jsonResult({
  ready: upstreams.length > 0 && upstreams.some((item) => item.connected),
  configPath,
  mode: policy.mode,
  upstreams: upstreams.map((item) => ({ name: item.name, connected: item.connected, tools: item.tools.length, error: item.error })),
  deferredTools: catalog.length
}));

server.registerTool("mdz_search_tools", {
  title: "Find an Upstream Tool",
  description: "Search deferred upstream MCP tools by intent. Call this when the needed tool is not already exposed directly.",
  inputSchema: {
    query: z.string(),
    limit: z.number().int().positive().max(20).optional()
  }
}, async ({ query, limit }) => jsonResult(searchToolCatalog(catalog, query, { limit, minScore: 1 })));

server.registerTool("mdz_call_tool", {
  title: "Call an Upstream Tool Through MDZ",
  description: "Call a deferred upstream MCP tool by its server__tool name. MDZ may replace verbose text with a reversible compact result under the active policy.",
  inputSchema: {
    tool: z.string(),
    arguments: z.record(z.string(), z.unknown()).optional()
  }
}, async ({ tool, arguments: toolArguments }) => {
  const match = catalog.find((item) => item.name === tool);
  if (!match) return errorResult(`Unknown upstream tool: ${tool}. Use mdz_search_tools first.`);
  const upstream = upstreams.find((item) => item.name === match.namespace);
  const result = await upstream.client.callTool({ name: match.upstreamName, arguments: toolArguments ?? {} });
  return reduceToolResult(result, match);
});

server.registerTool("mdz_expand_context", {
  title: "Expand MDZ Context",
  description: "Recover all or part of an original upstream tool result from an MDZ context handle.",
  inputSchema: {
    handle: z.string(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional()
  }
}, async ({ handle, startLine, endLine }) => ({
  content: [{ type: "text", text: await expandContext(handle, { storeDir: policy.storeDir, startLine, endLine }) }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await Promise.allSettled(upstreams.filter((item) => item.client).map((item) => item.client.close()));
    process.exit(0);
  });
}

async function reduceToolResult(result, tool) {
  const textParts = (result.content ?? []).filter((item) => item.type === "text").map((item) => item.text);
  if (!textParts.length) return result;
  const original = textParts.join("\n");
  const mirroredStructuredContent = result.structuredContent === undefined
    ? undefined
    : replaceMirroredText(result.structuredContent, original, null);
  const reduction = await prepareModelFacingReduction(original, {
    policy,
    storeDir: policy.storeDir,
    sourceLabel: tool.name
  });
  const eventOptions = {
    source: { boundary: "mcp-gateway", server: tool.namespace, tool: tool.upstreamName },
    ledgerFile: config.ledgerFile,
    type: "tool-output"
  };
  if (!reduction.applied) {
    await recordModelFacingObservation(reduction, eventOptions);
    return result;
  }

  await recordModelFacingDelivery(reduction, eventOptions);
  const nonText = (result.content ?? []).filter((item) => item.type !== "text");
  const reducedStructuredContent = result.structuredContent === undefined
    ? undefined
    : mirroredStructuredContent.replacements === 0
      ? result.structuredContent
      : replaceMirroredText(result.structuredContent, original, reduction.replacement).value;
  const mdz = {
    applied: true,
    handle: reduction.handle,
    originalTokens: reduction.metrics.originalTokens,
    reducedTokens: reduction.metrics.reducedTokens,
    savedTokens: reduction.metrics.savedTokens,
    riskLevel: reduction.filter.riskLevel
  };
  return {
    content: [{ type: "text", text: reduction.replacement }, ...nonText],
    isError: result.isError,
    structuredContent: result.structuredContent === undefined
      ? { mdz }
      : { mdz, upstream: reducedStructuredContent }
  };
}

function replaceMirroredText(value, original, replacement) {
  if (typeof value === "string") {
    return value === original
      ? { value: replacement ?? value, replacements: 1 }
      : { value, replacements: 0 };
  }
  if (Array.isArray(value)) {
    const children = value.map((item) => replaceMirroredText(item, original, replacement));
    return { value: children.map((item) => item.value), replacements: children.reduce((sum, item) => sum + item.replacements, 0) };
  }
  if (!value || typeof value !== "object") return { value, replacements: 0 };
  const entries = Object.entries(value).map(([key, item]) => [key, replaceMirroredText(item, original, replacement)]);
  return {
    value: Object.fromEntries(entries.map(([key, item]) => [key, item.value])),
    replacements: entries.reduce((sum, [, item]) => sum + item.replacements, 0)
  };
}

async function connectUpstreams(definitions) {
  const connected = [];
  for (const [name, definition] of Object.entries(definitions)) {
    if (name === "mdz" || name === "mdz_gateway") continue;
    const client = new Client({ name: `mdz-gateway-${name}`, version: "0.1.0" });
    try {
      const transport = new StdioClientTransport({
        command: definition.command,
        args: definition.args ?? [],
        cwd: definition.cwd ?? process.cwd(),
        env: { ...process.env, ...(definition.env ?? {}) },
        stderr: "pipe"
      });
      await client.connect(transport);
      const listed = await client.listTools();
      connected.push({ name, client, transport, tools: listed.tools, connected: true });
    } catch (error) {
      await client.close().catch(() => {});
      connected.push({ name, client: null, tools: [], connected: false, error: error.message });
    }
  }
  return connected;
}

async function loadConfig(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return {
      ...parsed,
      policyFile: path.resolve(path.dirname(file), parsed.policyFile ?? "policy.json"),
      ledgerFile: path.resolve(path.dirname(file), parsed.ledgerFile ?? "ledger.jsonl"),
      policy: {
        ...parsed.policy,
        storeDir: path.resolve(path.dirname(file), parsed.policy?.storeDir ?? "store")
      }
    };
  } catch (error) {
    throw new Error(`Unable to load MDZ gateway config ${file}: ${error.message}`);
  }
}

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

function errorResult(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
