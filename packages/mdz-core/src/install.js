import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_MARKER_START = "# >>> MDZ Token Advisor >>>";
const CONFIG_MARKER_END = "# <<< MDZ Token Advisor <<<";
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export async function installMdz(options = {}) {
  const platform = options.platform ?? "codex";
  if (platform === "codex") return installCodex(options);
  if (platform === "antigravity") return installAntigravity(options);
  if (platform === "claude") return installClaude(options);
  if (platform === "generic") return installGeneric(options);
  throw new Error(`Unsupported install platform: ${platform}`);
}

async function installCodex(options) {
  const { sourceRoot, targetRoot } = resolveInstallRoots(options);
  const scope = options.scope ?? "project";
  const mode = options.mode ?? "enabled";
  const skillSource = path.join(sourceRoot, ".agents", "skills", "mdz", "SKILL.md");
  const mcpServer = path.join(sourceRoot, "packages", "mdz-mcp-server", "bin", "mdz-mcp-server.mjs");
  const gateway = await ensureGatewayConfig(targetRoot, sourceRoot);
  const hookDir = path.join(sourceRoot, "adapters", "codex", "hooks");
  const written = gateway.written;

  await ensureMdzGitignore(targetRoot, written);
  await writePolicyFile(targetRoot, mode, written);

  if (scope === "project") {
    const skillTarget = path.join(targetRoot, ".agents", "skills", "mdz", "SKILL.md");
    await ensureProjectSkill(skillSource, skillTarget, written);
    await writeCodexProjectConfig(targetRoot, mcpServer, gateway, written);
    await writeCodexProjectHooks(targetRoot, hookDir, written);
    return installResult({
      platform: "codex",
      scope,
      mode,
      written,
      nextSteps: [
        "Restart Codex or open a new session in this repo.",
        "Trust the MDZ hooks when Codex asks.",
        "Run `npm run mdz -- latest-advice` after a prompt or tool call to see the latest recommendation.",
        modeGuidance(mode)
      ]
    });
  }

  if (scope === "user") {
    const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
    const skillTarget = path.join(codexHome, "skills", "mdz", "SKILL.md");
    await ensureProjectSkill(skillSource, skillTarget, written);
    await upsertGlobalCodexConfig(path.join(codexHome, "config.toml"), mcpServer, gateway, targetRoot, written);
    return installResult({
      platform: "codex",
      scope,
      mode,
      written,
      nextSteps: [
        "Restart Codex so the global skill and MCP server are loaded.",
        "Use `$mdz show latest advice` or `npm run mdz -- latest-advice` to inspect hook output.",
        modeGuidance(mode)
      ]
    });
  }

  throw new Error("Codex install scope must be project or user.");
}

async function installAntigravity(options) {
  const { sourceRoot, targetRoot } = resolveInstallRoots(options);
  const mcpServer = path.join(sourceRoot, "packages", "mdz-mcp-server", "bin", "mdz-mcp-server.mjs");
  const gateway = await ensureGatewayConfig(targetRoot, sourceRoot);
  const configPath = sourceRoot === targetRoot
    ? path.join(sourceRoot, "adapters", "antigravity", "mcp_config.generated.json")
    : path.join(targetRoot, ".mdz", "generated", "antigravity-mcp.json");
  const scope = options.scope ?? "project";
  const mode = options.mode ?? "enabled";
  const pluginTarget = antigravityPluginTarget(targetRoot, scope);
  const written = gateway.written;
  await ensureMdzGitignore(targetRoot, written);
  await writePolicyFile(targetRoot, mode, written);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify({
    ...mcpConfig(mcpServer, targetRoot, { gateway })
  }, null, 2), "utf8");
  written.push(configPath);
  await writeAntigravityPlugin(sourceRoot, targetRoot, pluginTarget, mcpServer, gateway, written);
  if (scope === "user") {
    await writeAntigravityGlobalMcp(mcpServer, gateway, targetRoot, written);
  }

  return installResult({
    platform: "antigravity",
    scope,
    mode,
    written,
    nextSteps: [
      scope === "user"
        ? "Restart or refresh Antigravity so the global MDZ plugin is discovered."
        : "Open this workspace in Antigravity and refresh customizations so `.agents/plugins/mdz` is discovered.",
      "Refresh Installed MCP Servers and confirm `mdz` is enabled.",
      modeGuidance(mode),
      "Run `npm run mdz -- doctor antigravity --format text --quick-benchmark` if the plugin does not appear."
    ]
  });
}

async function installClaude(options) {
  const { sourceRoot, targetRoot } = resolveInstallRoots(options);
  const scope = options.scope ?? "project";
  const mode = options.mode ?? "enabled";
  const mcpServer = path.join(sourceRoot, "packages", "mdz-mcp-server", "bin", "mdz-mcp-server.mjs");
  const gateway = await ensureGatewayConfig(targetRoot, sourceRoot);
  const pluginTarget = claudePluginTarget(targetRoot, scope);
  const written = gateway.written;

  await ensureMdzGitignore(targetRoot, written);
  await writePolicyFile(targetRoot, mode, written);
  await writeClaudePlugin(sourceRoot, targetRoot, pluginTarget, mcpServer, gateway, written);

  return installResult({
    platform: "claude",
    scope,
    mode,
    written,
    nextSteps: [
      scope === "user"
        ? "Restart Claude Code or run `/reload-plugins` so the personal MDZ plugin is discovered."
        : "Start Claude Code from this repo root or run `/reload-plugins` so `.claude/plugins/mdz` is discovered.",
      "Confirm the `mdz` MCP server is connected.",
      `Ask Claude Code to use MDZ in ${mode} mode and call \`doctor\` or \`show_policy\` first.`
    ]
  });
}

async function installGeneric(options) {
  const { sourceRoot, targetRoot } = resolveInstallRoots(options);
  const mode = options.mode ?? "enabled";
  const mcpServer = path.join(sourceRoot, "packages", "mdz-mcp-server", "bin", "mdz-mcp-server.mjs");
  const gateway = await ensureGatewayConfig(targetRoot, sourceRoot);
  const configPath = sourceRoot === targetRoot
    ? path.join(sourceRoot, "adapters", "generic", "mcp_config.generated.json")
    : path.join(targetRoot, ".mdz", "generated", "mcp_config.json");
  const written = gateway.written;

  await ensureMdzGitignore(targetRoot, written);
  await writePolicyFile(targetRoot, mode, written);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(mcpConfig(mcpServer, targetRoot, { includeType: true, gateway }), null, 2), "utf8");
  written.push(configPath);

  return installResult({
    platform: "generic",
    scope: options.scope ?? "project",
    mode,
    written,
    nextSteps: [
      "Add `adapters/generic/mcp_config.generated.json` to your MCP-capable client.",
      "Ask the client to call `doctor`, `show_policy`, and `usage_report`."
    ]
  });
}

function claudePluginTarget(root, scope) {
  if (scope === "user") {
    return path.join(os.homedir(), ".claude", "plugins", "mdz");
  }
  if (scope === "project") {
    return path.join(root, ".claude", "plugins", "mdz");
  }
  throw new Error("Claude install scope must be project or user.");
}

async function writeClaudePlugin(sourceRoot, targetRoot, pluginDir, mcpServer, gateway, written) {
  const hookScript = path.join(sourceRoot, "adapters", "claude", "hooks", "mdz-hook.mjs");
  await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
  await writeFile(path.join(pluginDir, ".claude-plugin", "plugin.json"), JSON.stringify({
    name: "mdz",
    version: "0.1.0",
    description: "MDZ Token Advisor reduces Claude Code token usage with enabled, observe, suggest, and safe modes.",
    author: { name: "MDZ" },
    skills: "./skills",
    hooks: "./hooks/hooks.json",
    mcpServers: "./.mcp.json"
  }, null, 2), "utf8");
  await writeFile(path.join(pluginDir, ".mcp.json"), JSON.stringify(mcpConfig(mcpServer, targetRoot, { includeType: true, gateway }), null, 2), "utf8");
  await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
  await writeFile(path.join(pluginDir, "hooks", "hooks.json"), JSON.stringify({
    hooks: {
      UserPromptSubmit: [{
        hooks: [{
          type: "command",
          command: `node "${toPosix(hookScript)}"`,
          timeout: 30
        }]
      }],
      PostToolUse: [{
        matcher: "*",
        hooks: [{
          type: "command",
          command: `node "${toPosix(hookScript)}"`,
          timeout: 30
        }]
      }],
      Stop: [{
        hooks: [{
          type: "command",
          command: `node "${toPosix(hookScript)}"`,
          timeout: 30
        }]
      }]
    }
  }, null, 2), "utf8");
  await mkdir(path.join(pluginDir, "skills", "mdz"), { recursive: true });
  await copyFile(
    path.join(sourceRoot, "adapters", "claude", "skills", "mdz", "SKILL.md"),
    path.join(pluginDir, "skills", "mdz", "SKILL.md")
  );
  written.push(
    path.join(pluginDir, ".claude-plugin", "plugin.json"),
    path.join(pluginDir, ".mcp.json"),
    path.join(pluginDir, "hooks", "hooks.json"),
    path.join(pluginDir, "skills", "mdz", "SKILL.md")
  );
}

function antigravityPluginTarget(root, scope) {
  if (scope === "user") {
    return path.join(os.homedir(), ".gemini", "config", "plugins", "mdz-plugin");
  }
  if (scope === "project") {
    return path.join(root, ".agents", "plugins", "mdz");
  }
  throw new Error("Antigravity install scope must be project or user.");
}

async function writeAntigravityGlobalMcp(mcpServer, gateway, root, written) {
  const configPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
  await mkdir(path.dirname(configPath), { recursive: true });
  let current = { mcpServers: {} };
  try {
    current = JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    current = { mcpServers: {} };
  }
  current.mcpServers ??= {};
  current.mcpServers.mdz = {
    command: "node",
    args: [toPosix(mcpServer)],
    cwd: toPosix(root)
  };
  current.mcpServers.mdz_gateway = gatewayEntry(gateway, root);
  await writeFile(configPath, JSON.stringify(current, null, 2), "utf8");
  written.push(configPath);
}

async function writeAntigravityPlugin(sourceRoot, targetRoot, pluginDir, mcpServer, gateway, written) {
  const hookScript = path.join(sourceRoot, "adapters", "antigravity", "hooks", "mdz-hook.mjs");
  await mkdir(pluginDir, { recursive: true });
  await writeFile(path.join(pluginDir, "plugin.json"), JSON.stringify({
    name: "mdz",
    version: "0.1.0",
    description: "MDZ Token Advisor reduces agent token usage with enabled, observe, suggest, and safe modes."
  }, null, 2), "utf8");
  await writeFile(path.join(pluginDir, "mcp_config.json"), JSON.stringify({
    ...mcpConfig(mcpServer, targetRoot, { gateway })
  }, null, 2), "utf8");
  await writeFile(path.join(pluginDir, "hooks.json"), JSON.stringify({
    "MDZ Token Advisor": {
      enabled: true,
      PreInvocation: [{
        type: "command",
        command: `node "${toPosix(hookScript)}"`,
        timeout: 30
      }],
      PostToolUse: [{
        matcher: "*",
        hooks: [{
          type: "command",
          command: `node "${toPosix(hookScript)}"`,
          timeout: 30
        }]
      }],
      Stop: [{
        type: "command",
        command: `node "${toPosix(hookScript)}"`,
        timeout: 30
      }]
    }
  }, null, 2), "utf8");
  await mkdir(path.join(pluginDir, "skills", "mdz"), { recursive: true });
  await copyFile(
    path.join(sourceRoot, "adapters", "antigravity", "skills", "mdz", "SKILL.md"),
    path.join(pluginDir, "skills", "mdz", "SKILL.md")
  );
  await mkdir(path.join(pluginDir, "rules"), { recursive: true });
  await copyFile(
    path.join(sourceRoot, "adapters", "antigravity", "plugin-template", "rules", "mdz-token-advisor.md"),
    path.join(pluginDir, "rules", "mdz-token-advisor.md")
  );
  await copyFile(
    path.join(sourceRoot, "adapters", "antigravity", "plugin-template", "README.md"),
    path.join(pluginDir, "README.md")
  );
  written.push(
    path.join(pluginDir, "plugin.json"),
    path.join(pluginDir, "mcp_config.json"),
    path.join(pluginDir, "hooks.json"),
    path.join(pluginDir, "skills", "mdz", "SKILL.md"),
    path.join(pluginDir, "rules", "mdz-token-advisor.md"),
    path.join(pluginDir, "README.md")
  );
}

async function writePolicyFile(root, mode, written) {
  const policyFile = path.join(root, ".mdz", "policy.json");
  await mkdir(path.dirname(policyFile), { recursive: true });
  await writeFile(policyFile, JSON.stringify({
    version: 1,
    mode,
    storeOriginals: true,
    explainEveryDecision: true,
    visibilityLevel: "visible",
    digestCadence: "daily",
    reportDir: ".mdz/reports",
    storeDir: ".mdz/store"
  }, null, 2), "utf8");
  written.push(policyFile);
}

async function ensureMdzGitignore(targetRoot, written) {
  const file = path.join(targetRoot, ".gitignore");
  let current = "";
  try {
    current = await readFile(file, "utf8");
  } catch {
    current = "";
  }
  if (current.split(/\r?\n/).some((line) => line.trim() === ".mdz/" || line.trim() === ".mdz")) return;
  const prefix = current.trimEnd();
  const next = `${prefix}${prefix ? "\n\n" : ""}# MDZ local data\n.mdz/\n`;
  await writeFile(file, next, "utf8");
  written.push(file);
}

async function ensureProjectSkill(source, target, written) {
  await mkdir(path.dirname(target), { recursive: true });
  if (path.resolve(source) === path.resolve(target)) {
    written.push(target);
    return;
  }
  await copyFile(source, target);
  written.push(target);
}

async function writeCodexProjectConfig(root, mcpServer, gateway, written) {
  const configPath = path.join(root, ".codex", "config.toml");
  await upsertCodexConfig(configPath, mcpServer, gateway, root, written);
}

async function writeCodexProjectHooks(root, hookDir, written) {
  const hooksPath = path.join(root, ".codex", "hooks.json");
  await mkdir(path.dirname(hooksPath), { recursive: true });
  let current = { hooks: {} };
  try {
    current = JSON.parse(await readFile(hooksPath, "utf8"));
  } catch {
    current = { hooks: {} };
  }
  current.hooks ??= {};
  current.hooks.UserPromptSubmit = replaceMdzHook(current.hooks.UserPromptSubmit, {
    hooks: [{
      type: "command",
      command: `node "${toPosix(path.join(hookDir, "user-prompt-submit.mjs"))}"`,
      timeout: 30,
      statusMessage: "MDZ checks this prompt under the active token policy"
    }]
  });
  current.hooks.PostToolUse = replaceMdzHook(current.hooks.PostToolUse, {
    matcher: "*",
    hooks: [{
      type: "command",
      command: `node "${toPosix(path.join(hookDir, "post-tool-use.mjs"))}"`,
      timeout: 30,
      statusMessage: "MDZ reviews tool output; gateway reductions apply separately"
    }]
  });
  await writeFile(hooksPath, JSON.stringify(current, null, 2), "utf8");
  written.push(hooksPath);
}

async function upsertGlobalCodexConfig(configPath, mcpServer, gateway, root, written) {
  await upsertCodexConfig(configPath, mcpServer, gateway, root, written);
}

async function upsertCodexConfig(configPath, mcpServer, gateway, root, written) {
  await mkdir(path.dirname(configPath), { recursive: true });
  let current = "";
  try {
    current = await readFile(configPath, "utf8");
  } catch {
    current = "";
  }
  const block = [
    CONFIG_MARKER_START,
    codexMcpToml(mcpServer, gateway, root).trim(),
    CONFIG_MARKER_END
  ].join("\n");
  const pattern = new RegExp(`${escapeRegex(CONFIG_MARKER_START)}[\\s\\S]*?${escapeRegex(CONFIG_MARKER_END)}`);
  const generated = codexMcpToml(mcpServer, gateway, root).trim();
  if (!pattern.test(current) && /\[mcp_servers\.(?:mdz|mdz_gateway)\]/.test(current) && current.trim() !== generated) {
    throw new Error(`Refusing to overwrite unmarked MDZ tables in ${configPath}. Remove those two tables or add MDZ marker comments, then retry.`);
  }
  const updated = pattern.test(current)
    ? current.replace(pattern, block)
    : current.trim() === generated
      ? `${block}\n`
      : `${current.trimEnd()}\n\n${block}\n`;
  await writeFile(configPath, updated.trimStart(), "utf8");
  written.push(configPath);
}

function replaceMdzHook(groups = [], replacement) {
  return [
    ...groups.filter((group) => !JSON.stringify(group).includes("/adapters/codex/hooks/")),
    replacement
  ];
}

function codexMcpToml(mcpServer, gateway, root) {
  return `[mcp_servers.mdz]
command = "node"
args = ["${toPosix(mcpServer)}"]
cwd = "${toPosix(root)}"
startup_timeout_sec = 20
tool_timeout_sec = 60
enabled = true

[mcp_servers.mdz_gateway]
command = "node"
args = ["${toPosix(gateway.script)}"]
cwd = "${toPosix(root)}"
env = { MDZ_GATEWAY_CONFIG = "${toPosix(gateway.config)}" }
startup_timeout_sec = 20
tool_timeout_sec = 120
enabled = true
`;
}

function mcpConfig(mcpServer, root, options = {}) {
  return {
    mcpServers: {
      mdz: {
        ...(options.includeType ? { type: "stdio" } : {}),
        command: "node",
        args: [toPosix(mcpServer)],
        cwd: toPosix(root)
      },
      ...(options.gateway ? { mdz_gateway: {
        ...(options.includeType ? { type: "stdio" } : {}),
        ...gatewayEntry(options.gateway, root)
      } } : {})
    }
  };
}

async function ensureGatewayConfig(targetRoot, sourceRoot = targetRoot, existingWritten = []) {
  const config = path.join(targetRoot, ".mdz", "gateway.json");
  const script = path.join(sourceRoot, "packages", "mdz-mcp-gateway", "bin", "mdz-mcp-gateway.mjs");
  const written = existingWritten;
  try {
    await readFile(config, "utf8");
  } catch {
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, JSON.stringify({
      version: 1,
      mcpServers: {},
      policyFile: "policy.json",
      ledgerFile: "ledger.jsonl",
      policy: { storeDir: "store" }
    }, null, 2), "utf8");
    written.push(config);
  }
  return { script, config, written };
}

function resolveInstallRoots(options) {
  const sharedRoot = options.root ? path.resolve(options.root) : null;
  return {
    sourceRoot: path.resolve(options.sourceRoot ?? sharedRoot ?? PACKAGE_ROOT),
    targetRoot: path.resolve(options.target ?? sharedRoot ?? process.cwd())
  };
}

function gatewayEntry(gateway, root) {
  return {
    command: "node",
    args: [toPosix(gateway.script)],
    cwd: toPosix(root),
    env: { MDZ_GATEWAY_CONFIG: toPosix(gateway.config) }
  };
}

function installResult({ platform, scope, mode, written, nextSteps }) {
  return {
    installed: true,
    platform,
    scope,
    startingMode: mode,
    written,
    userExperience: {
      activation: `MDZ starts in ${mode} mode for this install.`,
      visibility: "MDZ starts visible: hooks write latest advice, and `usage_report`/`savings_digest` show savings plus downsides.",
      escalation: "Recommended trust path is enabled by default, observe only for audits, then safe once reports show acceptable savings and downsides.",
      savingsMechanism: "MDZ saves tokens by filtering verbose output, storing originals locally behind handles, summarizing sessions with provenance, and compressing final responses when requested."
    },
    nextSteps
  };
}

function modeGuidance(mode) {
  if (mode === "observe") {
    return "Keep MDZ in observe mode until the usage report shows useful, low-risk savings.";
  }
  if (mode === "enabled") {
    return "MDZ is enabled and will ask before applying reductions; review `usage_report` before moving to safe mode.";
  }
  if (mode === "suggest") {
    return "MDZ will suggest reductions before applying them; review `usage_report` before moving to safe mode.";
  }
  if (mode === "safe") {
    return "MDZ is in safe mode; review `usage_report` and `savings_digest` to confirm low-risk savings and downsides.";
  }
  return `MDZ is in ${mode} mode; review usage reports frequently and confirm risk is acceptable.`;
}

function toPosix(value) {
  return path.resolve(value).replaceAll("\\", "/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
