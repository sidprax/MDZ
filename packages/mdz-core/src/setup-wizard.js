import { existsSync } from "node:fs";
import path from "node:path";
import { runDoctor } from "./doctor.js";

export async function runSetupWizard(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const platforms = detectPlatforms(root);
  const doctor = options.skipDoctor ? null : await runDoctor({ platform: options.platform ?? "all", root, quickBenchmark: true });
  return {
    generatedAt: new Date().toISOString(),
    root,
    detected: platforms,
    recommendedInstall: recommendInstall(platforms, options.platform),
    doctor,
    nextSteps: [
      "Run the recommended install command.",
      "Restart or refresh the target agent.",
      "Confirm the mdz MCP server is enabled.",
      "Start in enabled mode so MDZ asks before applying reductions; use observe only for measurement-only audits."
    ]
  };
}

function detectPlatforms(root) {
  return {
    codexProject: existsSync(path.join(root, ".codex")),
    antigravityProject: existsSync(path.join(root, ".agents")),
    claudeProject: existsSync(path.join(root, ".claude")),
    nodeProject: existsSync(path.join(root, "package.json"))
  };
}

function recommendInstall(platforms, requested) {
  const platform = requested && requested !== "all"
    ? requested
    : platforms.antigravityProject ? "antigravity" : platforms.claudeProject ? "claude" : "codex";
  return `npm run mdz -- install ${platform} --scope project`;
}
