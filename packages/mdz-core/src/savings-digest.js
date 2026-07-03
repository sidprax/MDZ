import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLedgerReport, renderLedgerReport } from "./ledger.js";

const DEFAULT_DIGEST_STATE = ".mdz/digest-state.json";

export async function createSavingsDigest(options = {}) {
  const since = options.since ?? await readLastDigestTime(options.stateFile);
  const report = await createLedgerReport({
    file: options.ledgerFile,
    since,
    until: options.until,
    mode: options.mode,
    action: options.action,
    type: options.type
  });
  const digest = {
    generatedAt: new Date().toISOString(),
    since,
    until: options.until,
    visibilityLevel: options.visibilityLevel ?? "visible",
    cadence: options.cadence ?? "manual",
    headline: buildHeadline(report),
    report,
    shouldNotify: shouldNotify(report, options)
  };
  if (options.markSent) {
    await writeDigestState(digest.generatedAt, options.stateFile);
  }
  return digest;
}

export function renderSavingsDigest(digest) {
  return [
    "# MDZ Savings Digest",
    "",
    `Generated: ${digest.generatedAt}`,
    `Since: ${digest.since ?? "beginning"}`,
    `Visibility: ${digest.visibilityLevel}`,
    "",
    digest.headline,
    "",
    "## This Period",
    "",
    `- Events observed: ${digest.report.totals.events}`,
    `- Tokens actually saved: ${formatNumber(digest.report.totals.savedTokens)}`,
    `- Potential savings observed: ${formatNumber(digest.report.totals.potentialSavedTokens)}`,
    `- Applied events: ${digest.report.totals.appliedEvents}`,
    `- Added local latency: ${formatNumber(digest.report.downsides.addedLocalLatencyMs)} ms`,
    `- Local cache growth: ${formatBytes(digest.report.downsides.localDiskBytes)}`,
    `- Highest quality risk: ${digest.report.downsides.qualityRisk}`,
    "",
    "## Full Usage Report",
    "",
    renderLedgerReport(digest.report)
  ].join("\n");
}

export async function writeSavingsDigest(digest, options = {}) {
  const dir = options.dir ?? ".mdz/reports";
  const baseName = options.baseName ?? `digest-${safeTimestamp(digest.generatedAt)}`;
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${baseName}.json`);
  const mdPath = path.join(dir, `${baseName}.md`);
  await writeFile(jsonPath, JSON.stringify(digest, null, 2), "utf8");
  await writeFile(mdPath, renderSavingsDigest(digest), "utf8");
  return { jsonPath, mdPath };
}

function buildHeadline(report) {
  const saved = report.totals.savedTokens;
  const potential = report.totals.potentialSavedTokens;
  if (saved > 0) return `MDZ saved about ${formatNumber(saved)} tokens in this period.`;
  if (potential > 0) return `MDZ observed about ${formatNumber(potential)} potential tokens to save, but did not apply them automatically.`;
  return "MDZ did not find meaningful savings in this period.";
}

function shouldNotify(report, options) {
  const minSaved = Number(options.minSavedTokens ?? 1);
  const minPotential = Number(options.minPotentialTokens ?? 500);
  return report.totals.savedTokens >= minSaved || report.totals.potentialSavedTokens >= minPotential;
}

async function readLastDigestTime(stateFile = DEFAULT_DIGEST_STATE) {
  try {
    const parsed = JSON.parse(await readFile(stateFile, "utf8"));
    return parsed.lastDigestAt;
  } catch {
    return undefined;
  }
}

async function writeDigestState(lastDigestAt, stateFile = DEFAULT_DIGEST_STATE) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ lastDigestAt }, null, 2), "utf8");
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

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, "-");
}
