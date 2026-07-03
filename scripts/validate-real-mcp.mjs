#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const filesystemPackage = require.resolve("@modelcontextprotocol/server-filesystem/package.json");
const filesystemServer = path.join(path.dirname(filesystemPackage), "dist", "index.js");
const root = await mkdtemp(path.join(os.tmpdir(), "mdz-real-mcp-"));
const project = path.join(root, "sample-project");
const mdzDir = path.join(project, ".mdz");
const noisyFile = path.join(project, "application.log");
const configPath = path.join(mdzDir, "gateway.json");
const client = new Client({ name: "mdz-real-mcp-validation", version: "0.1.0" });

try {
  await mkdir(mdzDir, { recursive: true });
  const noisy = [
    ...Array.from({ length: 1200 }, (_, index) => `INFO request ${index} completed`),
    "ERROR authentication rejected request",
    "Traceback: token validation failed"
  ].join("\n");
  await writeFile(noisyFile, noisy, "utf8");
  await writeFile(path.join(mdzDir, "policy.json"), JSON.stringify({ mode: "safe", storeOriginals: true }, null, 2), "utf8");
  await writeFile(configPath, JSON.stringify({
    version: 1,
    mcpServers: {
      filesystem: {
        command: process.execPath,
        args: [filesystemServer, project],
        cwd: project
      }
    },
    policyFile: "policy.json",
    ledgerFile: "ledger.jsonl",
    policy: { storeDir: "store" }
  }, null, 2), "utf8");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repo, "packages", "mdz-mcp-gateway", "bin", "mdz-mcp-gateway.mjs")],
    cwd: project,
    env: { ...process.env, MDZ_GATEWAY_CONFIG: configPath },
    stderr: "pipe"
  });
  await client.connect(transport);

  const status = await client.callTool({ name: "mdz_gateway_status", arguments: {} });
  assert.equal(status.structuredContent.ready, true);
  assert.equal(status.structuredContent.upstreams[0].name, "filesystem");
  assert.equal(status.structuredContent.upstreams[0].connected, true);

  const search = await client.callTool({ name: "mdz_search_tools", arguments: { query: "read text file" } });
  assert.ok(search.structuredContent.results.some((item) => item.name === "filesystem__read_text_file"));

  const called = await client.callTool({
    name: "mdz_call_tool",
    arguments: { tool: "filesystem__read_text_file", arguments: { path: path.basename(noisyFile) } }
  });
  assert.equal(called.structuredContent?.mdz?.applied, true);
  assert.ok(called.structuredContent.mdz.savedTokens > 1000);
  assert.match(called.content[0].text, /mdz:\/\/context\//);
  assert.ok(called.content[0].text.length < noisy.length / 4);
  assert.equal(called.structuredContent.upstream.content, called.content[0].text);

  const expanded = await client.callTool({
    name: "mdz_expand_context",
    arguments: { handle: called.structuredContent.mdz.handle }
  });
  assert.equal(expanded.content[0].text, noisy);

  process.stdout.write(`${JSON.stringify({
    passed: true,
    project,
    upstream: "@modelcontextprotocol/server-filesystem",
    tool: "filesystem__read_text_file",
    originalTokens: called.structuredContent.mdz.originalTokens,
    reducedTokens: called.structuredContent.mdz.reducedTokens,
    savedTokens: called.structuredContent.mdz.savedTokens,
    handleExpanded: true
  }, null, 2)}\n`);
} finally {
  await client.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
