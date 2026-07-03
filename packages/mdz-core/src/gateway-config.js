import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function initializeGateway(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const outputFile = path.resolve(options.out ?? path.join(root, ".mdz", "gateway.json"));
  const sourceFile = options.source ? path.resolve(options.source) : null;
  let mcpServers = {};
  if (sourceFile) {
    const source = JSON.parse(await readFile(sourceFile, "utf8"));
    mcpServers = source.mcpServers ?? source.servers ?? {};
  }
  const upstreams = Object.fromEntries(Object.entries(mcpServers).filter(([name]) => !["mdz", "mdz_gateway"].includes(name)));
  const config = {
    version: 1,
    mcpServers: upstreams,
    policyFile: "policy.json",
    ledgerFile: "ledger.jsonl",
    policy: { storeDir: "store" }
  };
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(config, null, 2), "utf8");

  let hostRewrite;
  if (sourceFile && options.rewriteHost === true) {
    const backup = `${sourceFile}.pre-mdz`;
    await copyFile(sourceFile, backup);
    const mcpServer = path.join(root, "packages", "mdz-mcp-server", "bin", "mdz-mcp-server.mjs");
    const gateway = path.join(root, "packages", "mdz-mcp-gateway", "bin", "mdz-mcp-gateway.mjs");
    await writeFile(sourceFile, JSON.stringify({
      mcpServers: {
        mdz: stdioEntry(mcpServer, root),
        mdz_gateway: { ...stdioEntry(gateway, root), env: { MDZ_GATEWAY_CONFIG: outputFile } }
      }
    }, null, 2), "utf8");
    hostRewrite = { file: sourceFile, backup };
  }

  return {
    initialized: true,
    file: outputFile,
    upstreamServers: Object.keys(upstreams),
    hostRewrite,
    nextStep: sourceFile && !options.rewriteHost
      ? "Add mdz_gateway to the host and disable the migrated upstream servers, or rerun with --rewrite-host."
      : "Restart the MCP client and call mdz_gateway_status."
  };
}

export async function inspectGateway(options = {}) {
  const file = path.resolve(options.file ?? path.join(options.root ?? process.cwd(), ".mdz", "gateway.json"));
  try {
    const config = JSON.parse(await readFile(file, "utf8"));
    const entries = Object.entries(config.mcpServers ?? {});
    const checks = entries.map(([name, value]) => ({
      name,
      valid: Boolean(value?.command),
      command: value?.command,
      args: value?.args ?? []
    }));
    return {
      ready: checks.every((item) => item.valid),
      file,
      upstreamServers: checks.length,
      checks,
      warnings: checks.length ? [] : ["No upstream MCP servers are configured; gateway reductions cannot occur yet."]
    };
  } catch (error) {
    return { ready: false, file, upstreamServers: 0, checks: [], errors: [error.message] };
  }
}

function stdioEntry(script, root) {
  return { command: "node", args: [toPosix(script)], cwd: toPosix(root) };
}

function toPosix(value) {
  return path.resolve(value).replaceAll("\\", "/");
}
