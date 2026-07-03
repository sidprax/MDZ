import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SESSION_PATTERNS = [
  /transcript\.jsonl$/i,
  /session.*\.(jsonl|json|txt|log|md)$/i,
  /conversation.*\.(jsonl|json|txt|log|md)$/i,
  /chat.*\.(jsonl|json|txt|log|md)$/i
];

export async function discoverSessions(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const platform = options.platform ?? "all";
  const limit = Number(options.limit ?? 20);
  const maxDepth = Number(options.maxDepth ?? 5);
  const roots = candidateRoots({ root, platform, home: options.home ?? os.homedir() });
  const seenRoots = [...new Set(roots.map((item) => path.resolve(item.path)))];
  const candidates = [];

  for (const base of seenRoots) {
    const found = await scanRoot(base, { maxDepth, limit: Math.max(limit * 4, 40) });
    candidates.push(...found.map((item) => ({
      ...item,
      platform: inferPlatform(item.file)
    })));
  }

  return {
    generatedAt: new Date().toISOString(),
    platform,
    scannedRoots: seenRoots,
    candidates: dedupeCandidates(candidates)
      .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
      .slice(0, limit)
  };
}

export function renderSessionDiscovery(report) {
  return [
    "# MDZ Session Discovery",
    "",
    `Generated: ${report.generatedAt}`,
    `Platform filter: ${report.platform}`,
    "",
    "## Scanned Roots",
    "",
    ...report.scannedRoots.map((root) => `- ${root}`),
    "",
    "## Candidate Sessions",
    "",
    ...renderCandidates(report.candidates)
  ].join("\n");
}

function candidateRoots({ root, platform, home }) {
  const roots = platform === "all" ? [{ platform: "workspace", path: root }] : [];
  if (platform === "all" || platform === "antigravity") {
    roots.push({ platform: "antigravity", path: path.join(home, ".gemini", "antigravity", "brain") });
  }
  if (platform === "all" || platform === "codex") {
    roots.push({ platform: "codex", path: path.join(home, ".codex") });
  }
  if (platform === "all" || platform === "claude") {
    roots.push({ platform: "claude", path: path.join(home, ".claude") });
  }
  if (platform === "all" || platform === "generic") {
    roots.push({ platform: "generic", path: path.join(root, ".mdz") });
  }
  return roots;
}

async function scanRoot(root, options) {
  try {
    const info = await stat(root);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }
  const results = [];
  await scanDirectory(root, 0, options, results);
  return results;
}

async function scanDirectory(dir, depth, options, results) {
  if (depth > options.maxDepth || results.length >= options.limit) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= options.limit) return;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      await scanDirectory(fullPath, depth + 1, options, results);
      continue;
    }
    if (!entry.isFile() || !isLikelySession(fullPath)) continue;
    const info = await stat(fullPath);
    results.push({
      file: fullPath,
      modifiedAt: info.mtime.toISOString(),
      bytes: info.size,
      kind: classifySessionFile(fullPath)
    });
  }
}

function shouldSkipDirectory(name) {
  return ["node_modules", ".git", "cache", "store"].includes(name);
}

function isLikelySession(file) {
  const normalized = file.replaceAll("\\", "/");
  return SESSION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function classifySessionFile(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  if (normalized.endsWith("transcript.jsonl")) return "transcript";
  if (normalized.endsWith(".jsonl")) return "jsonl";
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".log")) return "log";
  if (normalized.endsWith(".md")) return "markdown";
  return "text";
}

function inferPlatform(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/.gemini/antigravity/")) return "antigravity";
  if (normalized.includes("/.codex/")) return "codex";
  if (normalized.includes("/.claude/")) return "claude";
  if (normalized.includes("/.mdz/")) return "mdz";
  return "workspace";
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = path.resolve(candidate.file).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderCandidates(candidates) {
  if (!candidates.length) {
    return ["- No likely session transcripts found. Export a transcript or pass a file directly to `report-session`."];
  }
  return candidates.map((candidate, index) => {
    return `${index + 1}. ${candidate.file} (${candidate.platform}, ${candidate.kind}, ${formatBytes(candidate.bytes)}, modified ${candidate.modifiedAt})`;
  });
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
