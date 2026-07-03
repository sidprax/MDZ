import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeGateway, inspectGateway } from "../src/index.js";

test("gateway migration preserves a backup and removes direct upstream exposure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-gateway-config-"));
  const source = path.join(root, "mcp.json");
  await writeFile(source, JSON.stringify({ mcpServers: {
    github: { command: "github-mcp", args: ["stdio"] },
    mdz: { command: "node", args: ["old-mdz.mjs"] }
  } }), "utf8");
  try {
    const result = await initializeGateway({ root, source, rewriteHost: true });
    assert.deepEqual(result.upstreamServers, ["github"]);
    const gateway = JSON.parse(await readFile(path.join(root, ".mdz", "gateway.json"), "utf8"));
    assert.ok(gateway.mcpServers.github);
    const host = JSON.parse(await readFile(source, "utf8"));
    assert.deepEqual(Object.keys(host.mcpServers).sort(), ["mdz", "mdz_gateway"]);
    assert.ok(await readFile(`${source}.pre-mdz`, "utf8"));
    assert.equal((await inspectGateway({ root })).ready, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
