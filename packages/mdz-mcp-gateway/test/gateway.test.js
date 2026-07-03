import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = process.cwd();

test("gateway defers schemas, reduces upstream output, and restores originals", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-gateway-"));
  const mdzDir = path.join(root, ".mdz");
  const configPath = path.join(mdzDir, "gateway.json");
  await mkdir(mdzDir, { recursive: true });
  await writeFile(path.join(mdzDir, "policy.json"), JSON.stringify({ mode: "safe", storeOriginals: true }), "utf8");
  await writeFile(configPath, JSON.stringify({
    mcpServers: {
      fixture: {
        command: process.execPath,
        args: [path.join(repo, "packages", "mdz-mcp-gateway", "fixtures", "noisy-server.mjs")],
        cwd: repo
      }
    }
  }), "utf8");

  const client = new Client({ name: "mdz-gateway-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repo, "packages", "mdz-mcp-gateway", "bin", "mdz-mcp-gateway.mjs")],
    cwd: root,
    env: { ...process.env, MDZ_GATEWAY_CONFIG: configPath },
    stderr: "pipe"
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      "mdz_call_tool", "mdz_expand_context", "mdz_gateway_status", "mdz_search_tools"
    ]);
    const search = await client.callTool({ name: "mdz_search_tools", arguments: { query: "verbose noisy tests" } });
    assert.equal(search.structuredContent.results[0].name, "fixture__noisy_tests");

    const called = await client.callTool({
      name: "mdz_call_tool",
      arguments: { tool: "fixture__noisy_tests", arguments: { lines: 1000 } }
    });
    assert.equal(called.structuredContent.mdz.applied, true);
    assert.ok(called.structuredContent.mdz.savedTokens > 0);
    assert.match(called.content[0].text, /mdz:\/\/context\//);

    const expanded = await client.callTool({
      name: "mdz_expand_context",
      arguments: { handle: called.structuredContent.mdz.handle }
    });
    assert.match(expanded.content[0].text, /PASS fixture test 999/);
    assert.match(expanded.content[0].text, /FAIL authentication integration/);

    const small = await client.callTool({ name: "mdz_call_tool", arguments: { tool: "fixture__small_status" } });
    assert.equal(small.content[0].text, "Status: ready");
    assert.equal(small.structuredContent, undefined);

    const structured = await client.callTool({ name: "mdz_call_tool", arguments: { tool: "fixture__structured_status" } });
    assert.deepEqual(structured.structuredContent, { status: "ready", count: 500 });
    assert.match(structured.content[0].text, /PASS detail/);

    const ledger = (await readFile(path.join(mdzDir, "ledger.jsonl"), "utf8")).trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(ledger.filter((entry) => entry.action === "apply").length, 1);
    assert.ok(ledger.find((entry) => entry.action === "apply").savings.estimatedSavedTokens > 0);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
});
