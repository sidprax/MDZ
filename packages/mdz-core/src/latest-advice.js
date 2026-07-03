import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function readLatestAdvice(options = {}) {
  const dir = options.dir ?? ".mdz/hooks";
  const files = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const candidates = [];

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;
    const fullPath = path.join(dir, file.name);
    const content = await readFile(fullPath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed.advisor) continue;
    candidates.push({
      file: fullPath,
      generatedAt: parsed.generatedAt ?? parsed.advisor.generatedAt,
      hook: parsed.hook,
      advisor: parsed.advisor,
      text: parsed.text
    });
  }

  candidates.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  return candidates[0] ?? {
    file: null,
    generatedAt: null,
    hook: null,
    advisor: null,
    text: "No MDZ advisor report found yet."
  };
}
