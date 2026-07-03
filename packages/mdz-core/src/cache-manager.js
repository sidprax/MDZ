import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export async function inspectCache(options = {}) {
  const storeDir = options.storeDir ?? ".mdz/store";
  const limit = Number(options.limit ?? 50);
  const objects = await listObjects(storeDir);
  const totalBytes = objects.reduce((sum, item) => sum + item.bytes, 0);
  return {
    generatedAt: new Date().toISOString(),
    storeDir,
    totals: {
      objects: objects.length,
      bytes: totalBytes
    },
    objects: objects
      .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
      .slice(0, limit)
  };
}

export async function pruneCache(options = {}) {
  const storeDir = options.storeDir ?? ".mdz/store";
  const dryRun = options.dryRun !== false;
  const maxAgeDays = Number(options.maxAgeDays ?? 30);
  const maxBytes = options.maxBytes === undefined ? undefined : Number(options.maxBytes);
  const now = Date.now();
  const objects = (await listObjects(storeDir)).sort((a, b) => Date.parse(a.modifiedAt) - Date.parse(b.modifiedAt));
  const oldObjects = objects.filter((item) => now - Date.parse(item.modifiedAt) > maxAgeDays * 24 * 60 * 60 * 1000);
  const overflowObjects = maxBytes === undefined ? [] : selectOverflow(objects, maxBytes);
  const targets = dedupe([...oldObjects, ...overflowObjects]);

  if (!dryRun) {
    for (const item of targets) {
      await rm(item.file, { force: true });
    }
    await removeEmptyDirs(storeDir);
  }

  return {
    generatedAt: new Date().toISOString(),
    storeDir,
    dryRun,
    criteria: {
      maxAgeDays,
      maxBytes
    },
    before: {
      objects: objects.length,
      bytes: objects.reduce((sum, item) => sum + item.bytes, 0)
    },
    selected: {
      objects: targets.length,
      bytes: targets.reduce((sum, item) => sum + item.bytes, 0)
    },
    objects: targets
  };
}

export function renderCacheReport(report) {
  return [
    "# MDZ Cache Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Store: ${report.storeDir}`,
    "",
    "## Totals",
    "",
    `- Objects: ${formatNumber(report.totals?.objects ?? report.before?.objects ?? 0)}`,
    `- Bytes: ${formatBytes(report.totals?.bytes ?? report.before?.bytes ?? 0)}`,
    report.selected ? `- Selected for pruning: ${formatNumber(report.selected.objects)} objects (${formatBytes(report.selected.bytes)})` : undefined,
    report.dryRun !== undefined ? `- Dry run: ${report.dryRun}` : undefined,
    "",
    "## Objects",
    "",
    ...renderObjects(report.objects ?? [])
  ].filter((line) => line !== undefined).join("\n");
}

async function listObjects(storeDir) {
  try {
    await mkdir(storeDir, { recursive: true });
  } catch {
    return [];
  }
  const files = [];
  await walk(storeDir, files);
  return Promise.all(files.map(async (file) => {
    const info = await stat(file);
    const id = path.basename(file, path.extname(file));
    return {
      id,
      handle: `mdz://context/${id}`,
      file,
      bytes: info.size,
      modifiedAt: info.mtime.toISOString()
    };
  }));
}

async function walk(dir, files) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(fullPath, files);
    if (entry.isFile() && entry.name.endsWith(".txt")) files.push(fullPath);
  }
}

function selectOverflow(objects, maxBytes) {
  let total = objects.reduce((sum, item) => sum + item.bytes, 0);
  const selected = [];
  for (const item of objects) {
    if (total <= maxBytes) break;
    selected.push(item);
    total -= item.bytes;
  }
  return selected;
}

function dedupe(objects) {
  const seen = new Set();
  return objects.filter((item) => {
    if (seen.has(item.file)) return false;
    seen.add(item.file);
    return true;
  });
}

async function removeEmptyDirs(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await removeEmptyDirs(path.join(dir, entry.name));
  }
  try {
    await rm(dir, { recursive: false });
  } catch {
    // Directory is not empty or is the root; keep it.
  }
}

function renderObjects(objects) {
  if (!objects.length) return ["- No cache objects found."];
  return objects.slice(0, 50).map((item) => `- ${item.handle}: ${formatBytes(item.bytes)}, modified ${item.modifiedAt}`);
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
