import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installMdz } from "../src/index.js";

test("installMdz writes project Codex setup in enabled mode by default", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-install-"));
  const sourceSkill = path.join(root, ".agents", "skills", "mdz");
  await mkdir(sourceSkill, { recursive: true });
  await writeSkill(path.join(sourceSkill, "SKILL.md"));
  await mkdir(path.join(root, ".codex"), { recursive: true });
  await writeFile(path.join(root, ".codex", "config.toml"), "model = \"gpt-test\"\n", "utf8");
  await writeFile(path.join(root, ".codex", "hooks.json"), JSON.stringify({ hooks: {
    Stop: [{ hooks: [{ type: "command", command: "node custom-stop.mjs" }] }]
  } }), "utf8");

  const result = await installMdz({ platform: "codex", scope: "project", root });
  const config = await readFile(path.join(root, ".codex", "config.toml"), "utf8");
  const hooks = await readFile(path.join(root, ".codex", "hooks.json"), "utf8");
  const policy = JSON.parse(await readFile(path.join(root, ".mdz", "policy.json"), "utf8"));

  assert.equal(result.installed, true);
  assert.equal(result.startingMode, "enabled");
  assert.match(config, /\[mcp_servers\.mdz\]/);
  assert.match(config, /\[mcp_servers\.mdz_gateway\]/);
  assert.match(config, /model = "gpt-test"/);
  assert.match(config, /# >>> MDZ Token Advisor >>>/);
  assert.match(hooks, /MDZ checks this prompt under the active token policy/);
  assert.match(hooks, /custom-stop\.mjs/);
  assert.equal(policy.mode, "enabled");

  await rm(root, { recursive: true, force: true });
});

test("installMdz generates Antigravity MCP config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-install-ag-"));
  await mkdir(path.join(root, "adapters", "antigravity", "skills", "mdz"), { recursive: true });
  await writeSkill(path.join(root, "adapters", "antigravity", "skills", "mdz", "SKILL.md"));
  await mkdir(path.join(root, "adapters", "antigravity", "plugin-template", "rules"), { recursive: true });
  await writeFile(path.join(root, "adapters", "antigravity", "plugin-template", "rules", "mdz-token-advisor.md"), "# Rule\n", "utf8");
  await writeFile(path.join(root, "adapters", "antigravity", "plugin-template", "README.md"), "# Plugin\n", "utf8");
  const result = await installMdz({ platform: "antigravity", root });
  const config = JSON.parse(await readFile(path.join(root, "adapters", "antigravity", "mcp_config.generated.json"), "utf8"));
  const plugin = JSON.parse(await readFile(path.join(root, ".agents", "plugins", "mdz", "plugin.json"), "utf8"));
  const hooks = JSON.parse(await readFile(path.join(root, ".agents", "plugins", "mdz", "hooks.json"), "utf8"));

  assert.equal(result.platform, "antigravity");
  assert.equal(config.mcpServers.mdz.command, "node");
  assert.equal(config.mcpServers.mdz_gateway.command, "node");
  assert.equal(plugin.name, "mdz");
  assert.equal(hooks["MDZ Token Advisor"].enabled, true);

  await rm(root, { recursive: true, force: true });
});

test("installMdz writes Claude project plugin", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-install-claude-"));
  await mkdir(path.join(root, "adapters", "claude", "skills", "mdz"), { recursive: true });
  await writeSkill(path.join(root, "adapters", "claude", "skills", "mdz", "SKILL.md"));

  const result = await installMdz({ platform: "claude", scope: "project", root });
  const plugin = JSON.parse(await readFile(path.join(root, ".claude", "plugins", "mdz", ".claude-plugin", "plugin.json"), "utf8"));
  const mcp = JSON.parse(await readFile(path.join(root, ".claude", "plugins", "mdz", ".mcp.json"), "utf8"));
  const hooks = JSON.parse(await readFile(path.join(root, ".claude", "plugins", "mdz", "hooks", "hooks.json"), "utf8"));

  assert.equal(result.platform, "claude");
  assert.equal(plugin.name, "mdz");
  assert.equal(mcp.mcpServers.mdz.type, "stdio");
  assert.equal(mcp.mcpServers.mdz_gateway.type, "stdio");
  assert.ok(hooks.hooks.UserPromptSubmit);

  await rm(root, { recursive: true, force: true });
});

test("installMdz writes generic MCP config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdz-install-generic-"));
  const result = await installMdz({ platform: "generic", root });
  const config = JSON.parse(await readFile(path.join(root, "adapters", "generic", "mcp_config.generated.json"), "utf8"));

  assert.equal(result.platform, "generic");
  assert.equal(config.mcpServers.mdz.command, "node");
  assert.equal(config.mcpServers.mdz.type, "stdio");
  assert.equal(config.mcpServers.mdz_gateway.type, "stdio");

  await rm(root, { recursive: true, force: true });
});

test("installMdz can install from the MDZ checkout into a separate Codex project", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdz-target-project-"));
  try {
    const result = await installMdz({
      platform: "codex",
      scope: "project",
      sourceRoot: process.cwd(),
      target
    });
    const config = await readFile(path.join(target, ".codex", "config.toml"), "utf8");
    const hooks = await readFile(path.join(target, ".codex", "hooks.json"), "utf8");
    assert.equal(result.installed, true);
    assert.match(config, new RegExp(process.cwd().replaceAll("\\", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(config, new RegExp(target.replaceAll("\\", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(hooks, /adapters\/codex\/hooks\/post-tool-use\.mjs/);
    assert.ok(JSON.parse(await readFile(path.join(target, ".mdz", "gateway.json"), "utf8")));
    assert.match(await readFile(path.join(target, ".gitignore"), "utf8"), /^\.mdz\/$/m);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

async function writeSkill(file) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "---\nname: mdz\n---\n# MDZ\n", "utf8");
}
