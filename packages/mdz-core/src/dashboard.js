import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLedgerReport } from "./ledger.js";
import { inspectCache } from "./cache-manager.js";
import { recommendPolicy } from "./policy-autopilot.js";

export async function createDashboard(options = {}) {
  const usage = await createLedgerReport({ file: options.ledgerFile });
  const cache = await inspectCache({ storeDir: options.storeDir, limit: 10 });
  const autopilot = recommendPolicy(usage, { targetReduction: options.targetReduction });
  return {
    generatedAt: new Date().toISOString(),
    usage,
    cache,
    autopilot
  };
}

export async function writeDashboard(dashboard, options = {}) {
  const dir = options.dir ?? ".mdz/reports";
  const baseName = options.baseName ?? `dashboard-${safeTimestamp(dashboard.generatedAt)}`;
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${baseName}.json`);
  const htmlPath = path.join(dir, `${baseName}.html`);
  await writeFile(jsonPath, JSON.stringify(dashboard, null, 2), "utf8");
  await writeFile(htmlPath, renderDashboardHtml(dashboard), "utf8");
  return { jsonPath, htmlPath };
}

export function renderDashboardHtml(dashboard) {
  const stats = [
    ["Events", dashboard.usage.totals.events],
    ["Potential savings", formatNumber(dashboard.usage.totals.potentialSavedTokens)],
    ["Applied savings", formatNumber(dashboard.usage.totals.savedTokens)],
    ["Cache size", formatBytes(dashboard.cache.totals.bytes)],
    ["Cache objects", dashboard.cache.totals.objects],
    ["Recommended mode", dashboard.autopilot.recommendedMode],
    ["Observed savings", formatPercent(dashboard.autopilot.observedSavings)],
    ["Risk", dashboard.autopilot.risk]
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDZ Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #17202a; background: #f7f9fb; }
    main { max-width: 1080px; margin: 0 auto; }
    h1 { margin: 0 0 8px; }
    .subtitle { color: #53606d; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #dde4ec; border-radius: 8px; padding: 14px; }
    .label { color: #53606d; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 22px; margin-top: 6px; font-weight: 700; }
    section { margin-top: 26px; background: #fff; border: 1px solid #dde4ec; border-radius: 8px; padding: 16px; }
  </style>
</head>
<body>
<main>
  <h1>MDZ Dashboard</h1>
  <div class="subtitle">Modum Delta Zero local savings, cache, and policy guidance.</div>
  <div class="grid">${stats.map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</div>
  <section><h2>Autopilot Recommendation</h2><p>${escapeHtml(dashboard.autopilot.reason)}</p></section>
</main>
</body>
</html>
`;
}

function safeTimestamp(value) {
  return String(value).replace(/[:.]/g, "-");
}

function formatNumber(value) {
  return Math.round(value ?? 0).toLocaleString("en-US");
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}
