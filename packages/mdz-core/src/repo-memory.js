import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { estimateTokens } from "./token-estimator.js";

const DEFAULT_IGNORES = new Set(["node_modules", ".git", ".mdz", "dist", "build", ".next"]);

export async function createRepoMemoryMap(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const maxFiles = Number(options.maxFiles ?? 250);
  const files = [];
  await walk(root, files, { maxFiles, depth: 0, maxDepth: Number(options.maxDepth ?? 5) });
  const summaries = await Promise.all(files.map(async (file) => summarizeFile(root, file)));
  const map = {
    generatedAt: new Date().toISOString(),
    root,
    totals: {
      files: summaries.length,
      tokens: summaries.reduce((sum, item) => sum + item.tokens, 0)
    },
    fileTypes: groupExtensions(summaries),
    keyFiles: summaries.filter((item) => isKeyFile(item.path)).slice(0, 40),
    files: summaries
  };
  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, JSON.stringify(map, null, 2), "utf8");
  }
  return map;
}

async function walk(dir, files, options) {
  if (files.length >= options.maxFiles || options.depth > options.maxDepth) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= options.maxFiles) return;
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(fullPath, files, { ...options, depth: options.depth + 1 });
    else if (entry.isFile()) files.push(fullPath);
  }
}

async function summarizeFile(root, file) {
  const info = await stat(file);
  let text = "";
  if (info.size < 128 * 1024 && isTextLike(file)) {
    try {
      text = await readFile(file, "utf8");
    } catch {
      text = "";
    }
  }
  const estimate = estimateTokens(text);
  return {
    path: path.relative(root, file),
    ext: path.extname(file).toLowerCase() || "none",
    bytes: info.size,
    tokens: estimate.tokens,
    lines: text ? text.split(/\r?\n/).length : undefined,
    role: inferRole(file)
  };
}

function isTextLike(file) {
  return /\.(js|mjs|ts|tsx|jsx|json|md|txt|yml|yaml|toml|css|html|py|go|rs|java|cs|sh|ps1)$/i.test(file);
}

function inferRole(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/test") || /\.test\./.test(normalized)) return "test";
  if (normalized.endsWith("package.json")) return "manifest";
  if (normalized.includes("/docs/") || normalized.endsWith("readme.md")) return "docs";
  if (normalized.includes("/src/")) return "source";
  return "support";
}

function isKeyFile(file) {
  return /(^|\/)(package\.json|readme\.md|tsconfig\.json|vite\.config|next\.config|src\/index|src\/main)/i.test(file.replaceAll("\\", "/"));
}

function groupExtensions(files) {
  const grouped = {};
  for (const file of files) grouped[file.ext] = (grouped[file.ext] ?? 0) + 1;
  return grouped;
}
