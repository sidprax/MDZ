import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createContentId } from "./handles.js";
import { estimateTokens } from "./token-estimator.js";

const DEFAULT_CACHE_DIR = ".mdz/semantic-cache";

export async function putSemanticCache(text, summary, options = {}) {
  const content = String(text ?? "");
  const id = createContentId(content);
  const dir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const entry = {
    id,
    generatedAt: new Date().toISOString(),
    source: options.source,
    contentTokens: estimateTokens(content).tokens,
    summary: String(summary ?? "").slice(0, Number(options.maxSummaryChars ?? 4000)),
    tags: options.tags ?? []
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(entry, null, 2), "utf8");
  return entry;
}

export async function getSemanticCache(text, options = {}) {
  const id = createContentId(String(text ?? ""));
  const dir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  try {
    return JSON.parse(await readFile(path.join(dir, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function listSemanticCache(options = {}) {
  const dir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    return { generatedAt: new Date().toISOString(), cacheDir: dir, entries: [] };
  }
  const entries = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    try {
      entries.push(JSON.parse(await readFile(path.join(dir, file), "utf8")));
    } catch {
      // Ignore malformed local cache entries.
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    cacheDir: dir,
    entries: entries.sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt)).slice(0, Number(options.limit ?? 20))
  };
}
