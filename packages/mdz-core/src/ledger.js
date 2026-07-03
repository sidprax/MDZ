import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LEDGER_FILE = ".mdz/ledger.jsonl";

export async function recordLedgerEvent(event, options = {}) {
  const file = options.file ?? DEFAULT_LEDGER_FILE;
  const entry = normalizeLedgerEvent(event);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
  return {
    file,
    entry
  };
}

export async function readLedger(options = {}) {
  const file = options.file ?? DEFAULT_LEDGER_FILE;
  const text = await readLedgerText(file);
  const entries = [];
  const parseErrors = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        message: error.message
      });
    }
  });
  return {
    file,
    entries,
    parseErrors
  };
}

export async function createLedgerReport(options = {}) {
  const ledger = await readLedger(options);
  const entries = filterEntries(ledger.entries, options);
  const topSavingsExamples = buildSavingsExamples(entries, Number(options.exampleLimit ?? 5));
  const savingsAttribution = buildSavingsAttribution(entries);
  const totals = entries.reduce(
    (acc, entry) => {
      const originalTokens = effectiveOriginalTokens(entry);
      const reducedTokens = effectiveReducedTokens(entry);
      const savedTokens = effectiveSavedTokens(entry);
      acc.events += 1;
      acc.originalTokens += originalTokens;
      acc.reducedTokens += reducedTokens;
      acc.savedTokens += savedTokens;
      acc.potentialSavedTokens += Number(entry.savings?.estimatedSavedTokens ?? 0);
      if (isConfirmedDelivery(entry)) {
        acc.appliedEvents += 1;
        acc.appliedOriginalTokens += originalTokens;
        acc.appliedReducedTokens += reducedTokens;
      }
      acc.addedLocalLatencyMs += Number(entry.downsides?.addedLocalLatencyMs ?? 0);
      acc.localDiskBytes += Number(entry.downsides?.localDiskBytes ?? 0);
      acc.extraMdzToolCalls += Number(entry.downsides?.extraMdzToolCalls ?? 0);
      acc.handleExpansions += Number(entry.downsides?.handleExpansions ?? 0);
      const tokenClass = classifyTokenClass(entry.type);
      acc.byTokenClass[tokenClass].events += 1;
      acc.byTokenClass[tokenClass].originalTokens += originalTokens;
      acc.byTokenClass[tokenClass].reducedTokens += reducedTokens;
      acc.byTokenClass[tokenClass].savedTokens += savedTokens;
      acc.byTokenClass[tokenClass].potentialSavedTokens += Number(entry.savings?.estimatedSavedTokens ?? 0);
      increment(acc.byMode, entry.mode ?? "unknown");
      increment(acc.byAction, entry.action === "apply" && !isConfirmedDelivery(entry) ? "unconfirmed-apply" : (entry.action ?? "unknown"));
      increment(acc.byType, entry.type ?? "unknown");
      increment(acc.byRisk, entry.downsides?.qualityRisk ?? entry.riskLevel ?? "unknown");
      return acc;
    },
    {
      events: 0,
      originalTokens: 0,
      reducedTokens: 0,
      savedTokens: 0,
      potentialSavedTokens: 0,
      appliedEvents: 0,
      appliedOriginalTokens: 0,
      appliedReducedTokens: 0,
      addedLocalLatencyMs: 0,
      localDiskBytes: 0,
      extraMdzToolCalls: 0,
      handleExpansions: 0,
      byTokenClass: {
        inputContext: emptyTokenClass(),
        assistantOutput: emptyTokenClass(),
        other: emptyTokenClass()
      },
      byMode: {},
      byAction: {},
      byType: {},
      byRisk: {}
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    file: ledger.file,
    filters: {
      since: options.since,
      until: options.until,
      mode: options.mode,
      action: options.action,
      type: options.type
    },
    totals: {
      ...totals,
      estimatedPercentSaved: totals.originalTokens === 0 ? 0 : totals.savedTokens / totals.originalTokens
    },
    downsides: {
      addedLocalLatencyMs: totals.addedLocalLatencyMs,
      localDiskBytes: totals.localDiskBytes,
      qualityRisk: highestKey(totals.byRisk),
      workflowInterruptions: totals.byAction.ask ?? 0
    },
    topSavingsExamples,
    savingsAttribution,
    recent: entries.slice(-10).reverse(),
    parseErrors: ledger.parseErrors
  };
}

export function renderLedgerReport(report) {
  return [
    "# MDZ Usage Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Ledger: ${report.file}`,
    "",
    "## Totals",
    "",
    `- Events: ${report.totals.events}`,
    `- Estimated original tokens: ${formatNumber(report.totals.originalTokens)}`,
    `- Estimated tokens after applied savings: ${formatNumber(report.totals.reducedTokens)}`,
    `- Estimated tokens actually saved: ${formatNumber(report.totals.savedTokens)}`,
    `- Potential savings observed: ${formatNumber(report.totals.potentialSavedTokens)}`,
    `- Estimated percent saved: ${formatPercent(report.totals.estimatedPercentSaved)}`,
    `- Applied events: ${report.totals.appliedEvents}`,
    "",
    "## Token Classes",
    "",
    `- Input/context: ${formatTokenClass(report.totals.byTokenClass.inputContext)}`,
    `- Assistant output: ${formatTokenClass(report.totals.byTokenClass.assistantOutput)}`,
    `- Other: ${formatTokenClass(report.totals.byTokenClass.other)}`,
    "",
    "## How Tokens Were Saved",
    "",
    ...renderSavingsExamples(report.topSavingsExamples),
    "",
    "## Savings Attribution",
    "",
    ...renderSavingsAttribution(report.savingsAttribution),
    "",
    "## Downsides",
    "",
    `- Added local latency: ${formatNumber(report.downsides.addedLocalLatencyMs)} ms`,
    `- Local cache growth: ${formatBytes(report.downsides.localDiskBytes)}`,
    `- Highest quality risk: ${report.downsides.qualityRisk}`,
    `- User interruptions: ${report.downsides.workflowInterruptions}`,
    "",
    "## Breakdown",
    "",
    `- By mode: ${formatMap(report.totals.byMode)}`,
    `- By action: ${formatMap(report.totals.byAction)}`,
    `- By type: ${formatMap(report.totals.byType)}`,
    `- By risk: ${formatMap(report.totals.byRisk)}`,
    "",
    "## Recent Events",
    "",
    ...renderRecent(report.recent)
  ].join("\n");
}

export async function writeLedgerReport(report, options = {}) {
  const dir = options.dir ?? ".mdz/reports";
  const baseName = options.baseName ?? `usage-${safeTimestamp(report.generatedAt)}`;
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${baseName}.json`);
  const mdPath = path.join(dir, `${baseName}.md`);
  const htmlPath = path.join(dir, `${baseName}.html`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(mdPath, renderLedgerReport(report), "utf8");
  await writeFile(htmlPath, renderLedgerHtml(report), "utf8");
  return { jsonPath, mdPath, htmlPath };
}

export function renderLedgerHtml(report) {
  return renderHtmlPage("MDZ Usage Report", [
    ["Events", report.totals.events],
    ["Original tokens", formatNumber(report.totals.originalTokens)],
    ["Applied reduced tokens", formatNumber(report.totals.reducedTokens)],
    ["Actually saved", formatNumber(report.totals.savedTokens)],
    ["Potential savings observed", formatNumber(report.totals.potentialSavedTokens)],
    ["Input/context saved", formatNumber(report.totals.byTokenClass.inputContext.savedTokens)],
    ["Assistant output saved", formatNumber(report.totals.byTokenClass.assistantOutput.savedTokens)],
    ["Percent saved", formatPercent(report.totals.estimatedPercentSaved)],
    ["Added local latency", `${formatNumber(report.downsides.addedLocalLatencyMs)} ms`],
    ["Local cache growth", formatBytes(report.downsides.localDiskBytes)],
    ["Highest quality risk", report.downsides.qualityRisk],
    ["User interruptions", report.downsides.workflowInterruptions]
  ], [
    ["Mode", formatMap(report.totals.byMode)],
    ["Action", formatMap(report.totals.byAction)],
    ["Type", formatMap(report.totals.byType)],
    ["Risk", formatMap(report.totals.byRisk)]
  ], report.recent.map((entry) => ({
    time: entry.generatedAt,
    title: `${entry.action === "apply" && !isConfirmedDelivery(entry) ? "unconfirmed-apply" : entry.action} ${entry.type}`,
    detail: isConfirmedDelivery(entry)
      ? `${entry.mode} mode, actually saved ${formatNumber(effectiveSavedTokens(entry))} tokens, risk ${entry.downsides.qualityRisk}`
      : `${entry.mode} mode, observed ${formatNumber(entry.savings.estimatedSavedTokens)} potential tokens, risk ${entry.downsides.qualityRisk}`
  })), report.topSavingsExamples);
}

function normalizeLedgerEvent(event) {
  const action = event.action ?? "observe";
  const originalTokens = Number(event.tokens?.original ?? event.original?.tokens ?? event.savings?.totalTokens ?? 0);
  const rawReducedTokens = Number(event.tokens?.reduced ?? event.reduced?.tokens ?? Math.max(0, originalTokens - Number(event.savings?.estimatedSavedTokens ?? 0)));
  return {
    id: event.id ?? `mdz_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    generatedAt: event.generatedAt ?? new Date().toISOString(),
    source: event.source,
    type: event.type ?? "unknown",
    mode: event.mode ?? "observe",
    action,
    delivered: event.delivered ?? event.delivery?.applied,
    tokens: {
      original: originalTokens,
      reduced: action === "apply" ? rawReducedTokens : originalTokens
    },
    savings: {
      estimatedSavedTokens: Number(event.savings?.estimatedSavedTokens ?? event.estimatedSavedTokens ?? 0),
      estimatedPercentSaved: Number(event.savings?.estimatedPercentSaved ?? event.estimatedPercentSaved ?? 0)
    },
    downsides: {
      addedLocalLatencyMs: Number(event.downsides?.addedLocalLatencyMs ?? 0),
      localCpuWork: event.downsides?.localCpuWork ?? "unknown",
      localDiskBytes: Number(event.downsides?.localDiskBytes ?? 0),
      qualityRisk: event.downsides?.qualityRisk ?? event.riskLevel ?? "unknown",
      privacyCacheSensitivity: event.downsides?.privacyCacheSensitivity ?? "unknown",
      userApprovalPrompts: Number(event.downsides?.userApprovalPrompts ?? 0),
      extraMdzToolCalls: Number(event.downsides?.extraMdzToolCalls ?? 0),
      handleExpansions: Number(event.downsides?.handleExpansions ?? 0)
    },
    handle: event.handle,
    example: normalizeExample(event.example),
    notes: event.notes ?? []
  };
}

function buildSavingsExamples(entries, limit) {
  return entries
    .map((entry) => {
      const originalTokens = effectiveOriginalTokens(entry);
      const reducedTokens = effectiveReducedTokens(entry);
      const actualSavedTokens = effectiveSavedTokens(entry);
      const potentialSavedTokens = Number(entry.savings?.estimatedSavedTokens ?? 0);
      return {
        id: entry.id,
        generatedAt: entry.generatedAt,
        technique: entry.example?.technique ?? techniqueFor(entry),
        summary: entry.example?.summary ?? summaryFor(entry),
        type: entry.type,
        action: entry.action,
        tokenClass: classifyTokenClass(entry.type),
        originalTokens,
        reducedTokens,
        actualSavedTokens,
        potentialSavedTokens,
        percentSaved: originalTokens === 0 ? 0 : (actualSavedTokens || potentialSavedTokens) / originalTokens,
        before: entry.example?.before ?? `${formatNumber(originalTokens)} estimated tokens`,
        after: entry.action === "apply" && !isConfirmedDelivery(entry)
          ? "Replacement was proposed or emitted, but model-facing delivery was not confirmed"
          : entry.example?.after ?? (entry.action === "apply"
          ? `${formatNumber(reducedTokens)} estimated tokens`
          : "Observed only; original context was unchanged"),
        riskLevel: entry.downsides?.qualityRisk ?? "unknown",
        source: entry.source,
        handle: entry.handle
      };
    })
    .filter((item) => item.actualSavedTokens > 0 || item.potentialSavedTokens > 0)
    .sort((a, b) => b.actualSavedTokens - a.actualSavedTokens
      || b.potentialSavedTokens - a.potentialSavedTokens
      || Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
    .slice(0, Math.max(0, limit));
}

function buildSavingsAttribution(entries) {
  const techniques = {};
  for (const entry of entries) {
    const technique = entry.example?.technique ?? techniqueFor(entry);
    const current = techniques[technique] ?? {
      technique,
      events: 0,
      actualSavedTokens: 0,
      potentialSavedTokens: 0
    };
    current.events += 1;
    current.actualSavedTokens += effectiveSavedTokens(entry);
    current.potentialSavedTokens += Number(entry.savings?.estimatedSavedTokens ?? 0);
    techniques[technique] = current;
  }
  return Object.values(techniques)
    .filter((item) => item.actualSavedTokens > 0 || item.potentialSavedTokens > 0)
    .sort((a, b) => b.actualSavedTokens - a.actualSavedTokens || b.potentialSavedTokens - a.potentialSavedTokens);
}

function techniqueFor(entry) {
  const note = String(entry.notes?.[0] ?? "");
  if (/passing-test|failure|test output/i.test(note)) return "test-output-filtering";
  if (/warning|log|signature/i.test(note)) return "log-output-filtering";
  if (/handle|stored original/i.test(note) || entry.handle) return "local-context-handle";
  if (entry.type === "assistant-output") return "assistant-output-compression";
  if (entry.type === "prompt" || entry.type === "task-contract") return "prompt-contract";
  if (entry.type === "session") return "session-compaction";
  return String(entry.type ?? "unknown").replaceAll("_", "-");
}

function summaryFor(entry) {
  const note = String(entry.notes?.find((item) => String(item).trim()) ?? "").trim();
  if (note) return truncate(note, 220);
  const potential = Number(entry.savings?.estimatedSavedTokens ?? 0);
  if (entry.action === "apply") {
    return `${humanTechnique(techniqueFor(entry))} reduced content before it was used.`;
  }
  return `${humanTechnique(techniqueFor(entry))} identified about ${formatNumber(potential)} potential tokens to remove.`;
}

function normalizeExample(example) {
  if (!example || typeof example !== "object") return undefined;
  return {
    technique: truncate(example.technique, 80),
    summary: truncate(example.summary, 220),
    before: truncate(example.before, 160),
    after: truncate(example.after, 160)
  };
}

function humanTechnique(value) {
  return String(value ?? "optimization")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value, maxLength) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function effectiveOriginalTokens(entry) {
  return Number(entry.tokens?.original ?? 0);
}

function effectiveReducedTokens(entry) {
  const original = effectiveOriginalTokens(entry);
  if (!isConfirmedDelivery(entry)) return original;
  const reduced = Number(entry.tokens?.reduced ?? original);
  return Math.min(original, Math.max(0, reduced));
}

function effectiveSavedTokens(entry) {
  if (!isConfirmedDelivery(entry)) return 0;
  const original = effectiveOriginalTokens(entry);
  const reduced = effectiveReducedTokens(entry);
  const reported = Number(entry.savings?.estimatedSavedTokens ?? 0);
  return Math.max(0, Math.min(reported || original - reduced, original - reduced));
}

function isConfirmedDelivery(entry) {
  if (entry.action !== "apply") return false;
  const platform = String(entry.source?.platform ?? "").toLowerCase();
  const hook = String(entry.source?.hook ?? "");
  if (["antigravity", "claude"].includes(platform) && /PostTool/i.test(hook)) {
    return entry.delivered === true;
  }
  if (platform === "codex" && /PostTool/i.test(hook)) {
    return entry.delivered === true && /^(Bash|bash|apply_patch|mcp__)/.test(String(entry.source?.tool ?? ""));
  }
  return true;
}

async function readLedgerText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function filterEntries(entries, options) {
  return entries.filter((entry) => {
    const ts = Date.parse(entry.generatedAt);
    if (options.since && ts < Date.parse(options.since)) return false;
    if (options.until && ts > Date.parse(options.until)) return false;
    if (options.mode && entry.mode !== options.mode) return false;
    if (options.action && entry.action !== options.action) return false;
    if (options.type && entry.type !== options.type) return false;
    return true;
  });
}

function increment(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

function emptyTokenClass() {
  return {
    events: 0,
    originalTokens: 0,
    reducedTokens: 0,
    savedTokens: 0,
    potentialSavedTokens: 0
  };
}

function classifyTokenClass(type) {
  if (type === "assistant-output" || type === "response-output" || type === "final-answer") return "assistantOutput";
  if (["prompt", "tool-output", "test-output", "log-output", "session", "context", "task-contract", "tool-schema", "tool-deferral"].includes(type)) return "inputContext";
  return "other";
}

function formatTokenClass(value) {
  return [
    `${formatNumber(value.events)} events`,
    `${formatNumber(value.originalTokens)} original`,
    `${formatNumber(value.savedTokens)} actual saved`,
    `${formatNumber(value.potentialSavedTokens)} potential`
  ].join(", ");
}

function highestKey(map) {
  if (map.high) return "high";
  if (map.medium) return "medium";
  if (map.low) return "low";
  if (map.unknown) return "unknown";
  return "none";
}

function renderRecent(entries) {
  if (!entries.length) return ["- No MDZ usage events recorded yet."];
  return entries.map((entry) => {
    const savings = isConfirmedDelivery(entry)
      ? `actually saved ~${formatNumber(effectiveSavedTokens(entry))}`
      : `observed ~${formatNumber(entry.savings.estimatedSavedTokens)} potential`;
    const action = entry.action === "apply" && !isConfirmedDelivery(entry) ? "unconfirmed-apply" : entry.action;
    return `- ${entry.generatedAt}: ${action} ${entry.type} in ${entry.mode} mode, ${savings} tokens, risk=${entry.downsides.qualityRisk}`;
  });
}

function renderSavingsExamples(examples = []) {
  if (!examples.length) return ["- No savings examples recorded yet."];
  return examples.map((item, index) => {
    const saved = item.actualSavedTokens > 0
      ? `${formatNumber(item.actualSavedTokens)} actually saved`
      : `${formatNumber(item.potentialSavedTokens)} potential`;
    return `${index + 1}. ${humanTechnique(item.technique)}: ${item.summary} Before: ${item.before}. After: ${item.after}. ${saved}; risk=${item.riskLevel}.`;
  });
}

function renderSavingsAttribution(items = []) {
  if (!items.length) return ["- No attributed savings recorded yet."];
  return items.slice(0, 10).map((item) => {
    return `- ${humanTechnique(item.technique)}: ${formatNumber(item.actualSavedTokens)} actually saved, ${formatNumber(item.potentialSavedTokens)} potential across ${formatNumber(item.events)} events`;
  });
}

function formatMap(map) {
  const entries = Object.entries(map);
  if (!entries.length) return "none";
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
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

function renderHtmlPage(title, stats, breakdown, recent, examples = []) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #17202a; background: #f7f9fb; }
    main { max-width: 1040px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subtitle { color: #53606d; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #dde4ec; border-radius: 8px; padding: 14px; }
    .label { color: #53606d; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 22px; margin-top: 6px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dde4ec; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #edf1f5; }
    section { margin-top: 26px; }
  </style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">Modum Delta Zero token savings, risks, and local overhead.</div>
  <section class="grid">${stats.map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</section>
  <section><h2>Breakdown</h2><table><tbody>${breakdown.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table></section>
  <section><h2>How Tokens Were Saved</h2><table><thead><tr><th>Technique</th><th>Before</th><th>After</th><th>Savings</th><th>Risk</th></tr></thead><tbody>${examples.length ? examples.map((item) => `<tr><td>${escapeHtml(humanTechnique(item.technique))}<br><small>${escapeHtml(item.summary)}</small></td><td>${escapeHtml(item.before)}</td><td>${escapeHtml(item.after)}</td><td>${escapeHtml(item.actualSavedTokens > 0 ? `${formatNumber(item.actualSavedTokens)} actual` : `${formatNumber(item.potentialSavedTokens)} potential`)}</td><td>${escapeHtml(item.riskLevel)}</td></tr>`).join("") : '<tr><td colspan="5">No savings examples recorded yet.</td></tr>'}</tbody></table></section>
  <section><h2>Recent Activity</h2><table><thead><tr><th>Time</th><th>Event</th><th>Detail</th></tr></thead><tbody>${recent.map((item) => `<tr><td>${escapeHtml(item.time)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join("")}</tbody></table></section>
</main>
</body>
</html>
`;
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
