import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_MARKER_START = "# >>> MDZ Token Advisor >>>";
const CONFIG_MARKER_END = "# <<< MDZ Token Advisor <<<";
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export async function uninstallMdz(options = {}) {
  const platform = options.platform ?? "codex";
  const targetRoot = path.resolve(options.target ?? options.root ?? process.cwd());
  const sourceRoot = path.resolve(options.sourceRoot ?? options.root ?? PACKAGE_ROOT);
  const scope = options.scope ?? "project";
  const removed = [];
  const updated = [];

  if (platform === "codex") {
    const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
    const configPath = scope === "user"
      ? path.join(codexHome, "config.toml")
      : path.join(targetRoot, ".codex", "config.toml");
    if (await removeCodexConfigBlock(configPath)) updated.push(configPath);
    if (scope === "project") {
      const hooksPath = path.join(targetRoot, ".codex", "hooks.json");
      if (await removeCodexHooks(hooksPath)) updated.push(hooksPath);
      const skillDir = path.join(targetRoot, ".agents", "skills", "mdz");
      if (targetRoot !== sourceRoot) {
        await removePath(skillDir, removed);
      }
    } else {
      await removePath(path.join(codexHome, "skills", "mdz"), removed);
    }
  } else if (platform === "antigravity") {
    const pluginDir = scope === "user"
      ? path.join(os.homedir(), ".gemini", "config", "plugins", "mdz-plugin")
      : path.join(targetRoot, ".agents", "plugins", "mdz");
    await removePath(pluginDir, removed);
    if (scope === "user") {
      const configPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
      if (await removeJsonMcpEntries(configPath)) updated.push(configPath);
    }
  } else if (platform === "claude") {
    const pluginDir = scope === "user"
      ? path.join(os.homedir(), ".claude", "plugins", "mdz")
      : path.join(targetRoot, ".claude", "plugins", "mdz");
    await removePath(pluginDir, removed);
  } else if (platform === "generic") {
    await removePath(path.join(targetRoot, ".mdz", "generated", "mcp_config.json"), removed);
  } else {
    throw new Error(`Unsupported uninstall platform: ${platform}`);
  }

  if (options.purgeData === true) {
    await removePath(path.join(targetRoot, ".mdz"), removed);
  }

  return {
    uninstalled: true,
    platform,
    scope,
    targetRoot,
    removed,
    updated,
    dataPreserved: options.purgeData !== true,
    note: options.purgeData === true
      ? "MDZ policy, reports, ledger, gateway configuration, and stored originals were removed."
      : "MDZ data under .mdz was preserved. Use --purge-data only when that history and stored context are no longer needed."
  };
}

async function removeCodexConfigBlock(file) {
  const current = await readOptional(file);
  if (current === null) return false;
  const pattern = new RegExp(`\\s*${escapeRegex(CONFIG_MARKER_START)}[\\s\\S]*?${escapeRegex(CONFIG_MARKER_END)}\\s*`, "g");
  if (!pattern.test(current)) return false;
  const next = current.replace(pattern, "\n").trim();
  if (next) {
    await writeFile(file, `${next}\n`, "utf8");
  } else {
    await rm(file, { force: true });
  }
  return true;
}

async function removeCodexHooks(file) {
  const text = await readOptional(file);
  if (text === null) return false;
  const value = JSON.parse(text);
  let changed = false;
  for (const [event, groups] of Object.entries(value.hooks ?? {})) {
    const retained = groups.filter((group) => !JSON.stringify(group).includes("/adapters/codex/hooks/"));
    if (retained.length !== groups.length) changed = true;
    if (retained.length) value.hooks[event] = retained;
    else delete value.hooks[event];
  }
  if (!changed) return false;
  if (Object.keys(value.hooks ?? {}).length) {
    await writeFile(file, JSON.stringify(value, null, 2), "utf8");
  } else {
    await rm(file, { force: true });
  }
  return true;
}

async function removeJsonMcpEntries(file) {
  const text = await readOptional(file);
  if (text === null) return false;
  const value = JSON.parse(text);
  const hadEntries = Boolean(value.mcpServers?.mdz || value.mcpServers?.mdz_gateway);
  if (!hadEntries) return false;
  delete value.mcpServers.mdz;
  delete value.mcpServers.mdz_gateway;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
  return true;
}

async function removePath(target, removed) {
  const existing = await readOptional(target, true);
  if (existing === null) return;
  await rm(target, { recursive: true, force: true });
  removed.push(target);
}

async function readOptional(file, directoryOkay = false) {
  try {
    if (directoryOkay) {
      await stat(file);
      return "exists";
    }
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
