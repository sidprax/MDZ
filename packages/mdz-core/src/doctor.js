import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readPolicy } from "./policy-store.js";
import { runBenchmarkScenario } from "./benchmark-runner.js";
import { inspectGateway } from "./gateway-config.js";

const REQUIRED_MCP_TOOLS = [
  "show_policy",
  "estimate_tokens",
  "store_context",
  "expand_context",
  "filter_output",
  "analyze_session",
  "run_benchmark",
  "recommend_mdz",
  "report_session",
  "usage_report",
  "compare_context",
  "compact_tool_schemas",
  "plan_tool_deferral",
  "search_tool_catalog",
  "create_prefix_snapshot",
  "analyze_cache_stability"
];

export async function runDoctor(options = {}) {
  const sharedRoot = options.root ? path.resolve(options.root) : null;
  const sourceRoot = path.resolve(options.sourceRoot ?? sharedRoot ?? process.cwd());
  const targetRoot = path.resolve(options.target ?? sharedRoot ?? process.cwd());
  const platform = options.platform ?? "all";
  const checks = [];

  checks.push(checkNodeVersion());
  checks.push(await checkFile(sourceRoot, "package.json", "Package manifest"));
  checks.push(await checkFile(sourceRoot, "packages/mdz-core/bin/mdz-core.mjs", "MDZ CLI"));
  checks.push(await checkFile(sourceRoot, "packages/mdz-mcp-server/bin/mdz-mcp-server.mjs", "MDZ MCP server"));
  checks.push(await checkFile(sourceRoot, "packages/mdz-mcp-gateway/bin/mdz-mcp-gateway.mjs", "MDZ MCP gateway"));
  checks.push(await checkPolicy(targetRoot));
  checks.push(await checkGateway(targetRoot));

  if (platform === "all" || platform === "codex") {
    checks.push(await checkFile(targetRoot, ".agents/skills/mdz/SKILL.md", "Codex MDZ skill"));
    checks.push(await checkFile(targetRoot, ".codex/config.toml", "Codex project MCP config"));
    checks.push(await checkFile(targetRoot, ".codex/hooks.json", "Codex hook config"));
  }

  if (platform === "all" || platform === "antigravity") {
    checks.push(await checkFile(sourceRoot, "adapters/antigravity/skills/mdz/SKILL.md", "Antigravity MDZ skill source"));
    checks.push(await checkAntigravityConfig(sourceRoot, targetRoot));
    checks.push(await checkFile(targetRoot, ".agents/plugins/mdz/plugin.json", "Antigravity project plugin"));
    checks.push(await checkFile(targetRoot, ".agents/plugins/mdz/hooks.json", "Antigravity plugin hooks"));
    checks.push(await checkFile(targetRoot, ".agents/plugins/mdz/rules/mdz-token-advisor.md", "Antigravity MDZ rule"));
  }

  if (platform === "all" || platform === "claude") {
    checks.push(await checkFile(sourceRoot, "adapters/claude/skills/mdz/SKILL.md", "Claude MDZ skill source"));
    checks.push(await checkFile(sourceRoot, "adapters/claude/hooks/mdz-hook.mjs", "Claude MDZ hook source"));
    checks.push(await checkFile(targetRoot, ".claude/plugins/mdz/.claude-plugin/plugin.json", "Claude project plugin"));
    checks.push(await checkFile(targetRoot, ".claude/plugins/mdz/.mcp.json", "Claude plugin MCP config"));
    checks.push(await checkFile(targetRoot, ".claude/plugins/mdz/hooks/hooks.json", "Claude plugin hooks"));
  }

  if (platform === "all" || platform === "generic") {
    checks.push(sourceRoot === targetRoot
      ? await checkFile(sourceRoot, "adapters/generic/mcp_config.example.json", "Generic MCP example")
      : await checkFile(targetRoot, ".mdz/generated/mcp_config.json", "Generic generated MCP config"));
  }

  checks.push(await checkMcpServer(sourceRoot, targetRoot));

  if (options.quickBenchmark) {
    checks.push(await checkQuickBenchmark());
  }

  const failed = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  return {
    generatedAt: new Date().toISOString(),
    platform,
    root: targetRoot,
    sourceRoot,
    targetRoot,
    ready: failed.length === 0,
    summary: {
      checks: checks.length,
      passed: checks.filter((check) => check.status === "pass").length,
      warnings: warnings.length,
      failed: failed.length
    },
    checks,
    nextSteps: nextSteps({ platform, failed, warnings, policyMode: policyMode(checks) })
  };
}

export function renderDoctorReport(report) {
  return [
    "# MDZ Doctor",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Platform: ${report.platform}`,
    `Root: ${report.root}`,
    `Checks: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${symbol(check.status)} ${check.name}: ${check.message}`),
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((step) => `- ${step}`)
  ].join("\n");
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    name: "Node.js",
    status: major >= 22 ? "pass" : "fail",
    message: `current=${process.version}, required=>=22`
  };
}

async function checkFile(root, relativePath, name) {
  const fullPath = path.join(root, relativePath);
  try {
    await access(fullPath);
    return {
      name,
      status: "pass",
      message: relativePath
    };
  } catch {
    return {
      name,
      status: "fail",
      message: `missing ${relativePath}`
    };
  }
}

async function checkPolicy(root) {
  const policy = await readPolicy({ file: path.join(root, ".mdz", "policy.json") });
  const firstUse = policy.mode === "observe";
  return {
    name: "MDZ policy",
    status: firstUse ? "pass" : "warn",
    message: firstUse
      ? "mode=observe; explicit measurement-only mode"
      : `mode=${policy.mode}; review usage reports and downsides while MDZ is active`,
    details: { mode: policy.mode }
  };
}

async function checkGateway(root) {
  const report = await inspectGateway({ root });
  if (!report.ready) {
    return { name: "MCP gateway config", status: "fail", message: report.errors?.join("; ") ?? "invalid gateway config" };
  }
  return {
    name: "MCP gateway config",
    status: report.upstreamServers ? "pass" : "warn",
    message: report.upstreamServers
      ? `${report.upstreamServers} upstream server(s) configured for model-facing reduction`
      : "valid, but no upstream servers are routed through MDZ yet"
  };
}

async function checkAntigravityConfig(sourceRoot, targetRoot) {
  const relativePath = sourceRoot === targetRoot
    ? "adapters/antigravity/mcp_config.generated.json"
    : ".mdz/generated/antigravity-mcp.json";
  const fullPath = path.join(sourceRoot === targetRoot ? sourceRoot : targetRoot, relativePath);
  try {
    const parsed = JSON.parse(await readFile(fullPath, "utf8"));
    const server = parsed.mcpServers?.mdz;
    const gateway = parsed.mcpServers?.mdz_gateway;
    if (!server?.command || !Array.isArray(server.args) || !gateway?.command || !Array.isArray(gateway.args)) {
      return {
        name: "Antigravity MCP config",
        status: "fail",
        message: `${relativePath} does not contain valid mdz and mdz_gateway command/args`
      };
    }
    return {
      name: "Antigravity MCP config",
      status: "pass",
      message: relativePath
    };
  } catch (error) {
    return {
      name: "Antigravity MCP config",
      status: "fail",
      message: `missing or invalid ${relativePath}: ${error.message}`
    };
  }
}

async function checkMcpServer(sourceRoot, targetRoot) {
  const client = new Client({
    name: "mdz-doctor",
    version: "0.1.0"
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(sourceRoot, "packages/mdz-mcp-server/bin/mdz-mcp-server.mjs")],
    cwd: targetRoot,
    stderr: "pipe"
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((tool) => tool.name));
    const missing = REQUIRED_MCP_TOOLS.filter((tool) => !names.has(tool));
    return {
      name: "MCP server",
      status: missing.length ? "fail" : "pass",
      message: missing.length
        ? `missing tools: ${missing.join(", ")}`
        : `started and exposed ${tools.tools.length} tools`
    };
  } catch (error) {
    return {
      name: "MCP server",
      status: "fail",
      message: error.message
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function checkQuickBenchmark() {
  try {
    const report = await runBenchmarkScenario("verbose-test-failure", {
      mode: "safe",
      storeDir: ".mdz/doctor-benchmark-store"
    });
    return {
      name: "Quick benchmark",
      status: report.quality.passed ? "pass" : "warn",
      message: `saved=${report.savings.estimatedTokensSaved} tokens, quality=${report.quality.passed ? "passed" : "needs review"}`
    };
  } catch (error) {
    return {
      name: "Quick benchmark",
      status: "fail",
      message: error.message
    };
  }
}

function nextSteps({ platform, failed, warnings, policyMode = "enabled" }) {
  if (failed.length) {
    return [
      "Fix failed checks before testing in Antigravity.",
    "Run `npm install` if dependencies are missing.",
      `Run \`npm run mdz -- install ${platform === "all" ? "antigravity" : platform} --scope project\` to regenerate adapter setup files.`
    ];
  }
  const steps = [
    "Connect or refresh the MDZ adapter for the selected platform.",
    "Confirm the `mdz` MCP server is enabled.",
    `Ask the agent to use MDZ in ${policyMode} mode and call \`doctor\` or \`show_policy\` first.`
  ];
  if (platform === "codex") {
    steps[0] = "Restart Codex or open a new session so the local MCP config and hooks are loaded.";
  } else if (platform === "antigravity") {
    steps[0] = "Refresh Antigravity customizations so `.agents/plugins/mdz` is discovered.";
  } else if (platform === "claude") {
    steps[0] = "Start Claude Code from the repo root or run `/reload-plugins` so `.claude/plugins/mdz` is discovered.";
  } else if (platform === "generic") {
    steps[0] = "Add `adapters/generic/mcp_config.generated.json` to your MCP client.";
  } else if (platform === "all") {
    steps[0] = "Refresh the target platform adapter: Codex, Claude Code, Antigravity, or generic MCP.";
  }
  if (warnings.length) {
    steps.unshift("Review warnings and monitor `usage_report` plus `savings_digest`.");
  }
  return steps;
}

function policyMode(checks) {
  return checks.find((check) => check.name === "MDZ policy")?.details?.mode ?? "enabled";
}

function symbol(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}
