import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROJECT_POLICY = {
  version: 1,
  defaults: {
    mode: "enabled",
    targetReduction: 0.3,
    cacheRetentionDays: 30
  },
  taskModes: {
    "test-failure": "safe",
    "log-analysis": "safe",
    debugging: "suggest",
    planning: "suggest"
  },
  privacy: {
    redactReports: true,
    scanBeforeCache: true,
    ignoredPaths: [".env", "node_modules", ".git", ".mdz/store"]
  }
};

export async function readProjectPolicy(options = {}) {
  const file = options.file ?? ".mdz/project-policy.json";
  try {
    return { file, policy: { ...DEFAULT_PROJECT_POLICY, ...JSON.parse(await readFile(file, "utf8")) } };
  } catch {
    return { file, policy: DEFAULT_PROJECT_POLICY };
  }
}

export async function writeProjectPolicy(policy = {}, options = {}) {
  const file = options.file ?? ".mdz/project-policy.json";
  const merged = merge(DEFAULT_PROJECT_POLICY, policy);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(merged, null, 2), "utf8");
  return { file, policy: merged };
}

function merge(base, overrides) {
  return {
    ...base,
    ...overrides,
    defaults: { ...base.defaults, ...overrides.defaults },
    taskModes: { ...base.taskModes, ...overrides.taskModes },
    privacy: { ...base.privacy, ...overrides.privacy }
  };
}
