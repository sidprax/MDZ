import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAdvisorReport, renderAdvisorReport } from "./advisor.js";
import { analyzeSession } from "./session-analyzer.js";
import { recommendForSession } from "./codex-session.js";
import { createCompressionPlan } from "./compression-planner.js";

export function createSessionReport(text, options = {}) {
  const sourceText = String(text ?? "");
  const mode = options.mode ?? "enabled";
  const analysis = analyzeSession(sourceText, options);
  const recommendation = {
    file: options.file,
    ...recommendForSession(sourceText, options)
  };
  const advisor = createAdvisorReport(recommendation, { mode });
  const plan = createCompressionPlan(sourceText, { mode });
  const proposedNextMode = proposeNextMode(advisor);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      file: options.file,
      chars: sourceText.length,
      format: analysis.format ?? recommendation.format
    },
    mode,
    advisor,
    analysis,
    plan: {
      recommendation: plan.recommendation,
      summary: plan.summary,
      evidence: {
        totalEvidence: plan.evidence.totalEvidence,
        byType: plan.evidence.byType,
        requiredMarkers: plan.evidence.requiredMarkers.length
      },
      topActions: plan.actions.slice(0, 12)
    },
    proposedNextMode,
    summary: {
      totalTokens: analysis.totalTokens,
      estimatedSavedTokens: analysis.expected.savedTokens,
      estimatedPercentSaved: analysis.expected.percentSaved,
      opportunityCount: analysis.opportunities.length,
      largestContributors: analysis.largestContributors.slice(0, 5),
      topOpportunities: analysis.opportunities.slice(0, 8)
    }
  };
}

export function renderSessionReport(report) {
  return [
    "# MDZ Session Savings Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.file ?? "provided text"}`,
    `Mode: ${report.mode}`,
    "",
    "## Recommendation",
    "",
    renderAdvisorReport(report.advisor),
    "",
    "## Session Summary",
    "",
    `- Total estimated tokens: ${formatNumber(report.summary.totalTokens)}`,
    `- Estimated tokens saved: ${formatNumber(report.summary.estimatedSavedTokens)}`,
    `- Estimated percent saved: ${formatPercent(report.summary.estimatedPercentSaved)}`,
    `- Optimization opportunities: ${report.summary.opportunityCount}`,
    `- Suggested next mode: ${report.proposedNextMode.mode}`,
    `- Why: ${report.proposedNextMode.reason}`,
    `- Plan recommendation: ${report.plan.recommendation}`,
    `- Evidence items: ${formatNumber(report.plan.evidence.totalEvidence)}`,
    `- Required markers: ${formatNumber(report.plan.evidence.requiredMarkers)}`,
    "",
    "## Top Opportunities",
    "",
    ...renderOpportunities(report.summary.topOpportunities),
    "",
    "## Largest Contributors",
    "",
    ...renderContributors(report.summary.largestContributors),
    "",
    "## Compression Plan",
    "",
    ...renderPlanActions(report.plan.topActions),
    "",
    "## Downsides",
    "",
    `- Added local latency: ${report.advisor.downsides.addedLocalLatencyMs} ms`,
    `- Local CPU: ${report.advisor.downsides.localCpuWork}`,
    `- Local cache: ${formatBytes(report.advisor.downsides.localDiskBytes)}`,
    `- Quality risk: ${report.advisor.downsides.qualityRisk}`,
    `- Privacy/cache: ${report.advisor.downsides.privacyCacheSensitivity}`
  ].join("\n");
}

export async function writeSessionReport(report, options = {}) {
  const dir = options.dir ?? ".mdz/reports";
  const baseName = options.baseName ?? `session-${safeTimestamp(report.generatedAt)}`;
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${baseName}.json`);
  const mdPath = path.join(dir, `${baseName}.md`);
  const htmlPath = path.join(dir, `${baseName}.html`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(mdPath, renderSessionReport(report), "utf8");
  await writeFile(htmlPath, renderSessionHtml(report), "utf8");
  return { jsonPath, mdPath, htmlPath };
}

export function renderSessionHtml(report) {
  const stats = [
    ["Total tokens", formatNumber(report.summary.totalTokens)],
    ["Estimated saved", formatNumber(report.summary.estimatedSavedTokens)],
    ["Percent saved", formatPercent(report.summary.estimatedPercentSaved)],
    ["Opportunities", report.summary.opportunityCount],
    ["Next mode", report.proposedNextMode.mode],
    ["Quality risk", report.advisor.downsides.qualityRisk],
    ["Local cache", formatBytes(report.advisor.downsides.localDiskBytes)],
    ["Added latency", `${report.advisor.downsides.addedLocalLatencyMs} ms`]
  ];
  const opportunities = report.summary.topOpportunities.map((item) => ({
    title: item.type,
    detail: `Save about ${formatNumber(item.estimatedSavedTokens)} tokens, risk ${item.riskLevel}. ${item.reason}`
  }));
  const actions = report.plan.topActions.map((item) => ({
    title: `${item.strategy} ${item.kind}`,
    detail: `Save about ${formatNumber(item.estimatedSavedTokens)} tokens, risk ${item.riskLevel}. ${item.reason}`
  }));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDZ Session Savings Report</title>
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
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #edf1f5; vertical-align: top; }
    section { margin-top: 26px; }
  </style>
</head>
<body>
<main>
  <h1>MDZ Session Savings Report</h1>
  <div class="subtitle">Modum Delta Zero analysis for ${escapeHtml(report.source.file ?? "provided text")}.</div>
  <section class="grid">${stats.map(([label, value]) => `<div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join("")}</section>
  <section><h2>Recommendation</h2><p>${escapeHtml(report.advisor.headline)} ${escapeHtml(report.advisor.reason)}</p><p>${escapeHtml(report.proposedNextMode.reason)}</p></section>
  <section><h2>Top Opportunities</h2>${renderHtmlTable(opportunities)}</section>
  <section><h2>Compression Plan</h2>${renderHtmlTable(actions)}</section>
</main>
</body>
</html>
`;
}

function proposeNextMode(advisor) {
  const pct = advisor.savings.estimatedPercentSaved ?? 0;
  const risk = advisor.downsides.qualityRisk;
  if (advisor.mode === "observe" && pct >= 0.08 && ["low", "medium"].includes(risk)) {
    return {
      mode: "enabled",
      reason: "Savings look meaningful; enabled mode will ask before applying so the user can build trust."
    };
  }
  if (["suggest", "enabled"].includes(advisor.mode) && pct >= 0.15 && risk === "low") {
    return {
      mode: "safe",
      reason: "Low-risk savings are strong enough to consider automatic deterministic reductions."
    };
  }
  return {
    mode: advisor.mode,
    reason: "Keep the current mode until more low-risk savings are observed."
  };
}

function renderOpportunities(opportunities) {
  if (!opportunities.length) return ["- No major opportunities found."];
  return opportunities.map((item) => {
    return `- ${item.type}: save ~${formatNumber(item.estimatedSavedTokens)} tokens, risk=${item.riskLevel}. ${item.reason}`;
  });
}

function renderContributors(contributors) {
  if (!contributors.length) return ["- No large contributors found."];
  return contributors.map((item) => {
    return `- ${item.kind ?? `block ${item.index}`}: ${formatNumber(item.tokens)} tokens, ${formatNumber(item.chars)} chars`;
  });
}

function renderPlanActions(actions) {
  if (!actions.length) return ["- No plan actions."];
  return actions.map((item) => {
    return `- ${item.strategy} ${item.kind}: save ~${formatNumber(item.estimatedSavedTokens)} tokens, risk=${item.riskLevel}. ${item.reason}`;
  });
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

function renderHtmlTable(items) {
  if (!items.length) return "<p>No major items found.</p>";
  return `<table><thead><tr><th>Item</th><th>Detail</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join("")}</tbody></table>`;
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
