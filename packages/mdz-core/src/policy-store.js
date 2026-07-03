import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPolicy } from "./policy.js";

const DEFAULT_POLICY_PATH = ".mdz/policy.json";

export async function readPolicy(options = {}) {
  const file = options.file ?? DEFAULT_POLICY_PATH;
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return createPolicy(parsed);
  } catch {
    return createPolicy();
  }
}

export async function writePolicy(policy, options = {}) {
  const file = options.file ?? DEFAULT_POLICY_PATH;
  const finalPolicy = createPolicy(policy);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(finalPolicy, null, 2), "utf8");
  return {
    file,
    policy: finalPolicy
  };
}
