#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import process from "node:process";
import {
  createAdvisorReport,
  prepareModelFacingReduction,
  readPolicy,
  recordModelFacingObservation,
  renderAdvisorReport
} from "../../../packages/mdz-core/src/index.js";

const input = await readStdin();
const text = extractToolOutput(input);
const policy = await readPolicy();
const toolName = input.tool_name ?? input.toolName ?? "unknown";
const reduction = await prepareModelFacingReduction(text, {
  policy: { ...policy, mode: "observe" },
  storeDir: policy.storeDir,
  sourceLabel: toolName
});
reduction.mode = policy.mode;
reduction.reason = "codex-native-hook-advisory-only";
const result = reduction.filter;
const stored = reduction.stored;

const recommendation = {
  format: "tool-output",
  recommendation: result.metrics.savedTokens > 500 ? "use" : result.metrics.savedTokens > 100 ? "ask" : "skip",
  totalTokens: result.metrics.originalTokens,
  estimatedSavedTokens: result.metrics.savedTokens,
  estimatedPercentSaved: result.metrics.percentSaved,
  reason: result.metrics.savedTokens > 0
    ? `Tool output can be reduced as ${result.kind} output.`
    : "Tool output is too small to benefit from MDZ filtering.",
  downsides: {
    addedLocalLatencyMs: result.metrics.estimatedLatencyMs,
    localCpuWork: result.metrics.estimatedCpuWork,
    localDiskBytes: stored?.bytes ?? 0,
    qualityRisk: result.riskLevel,
    privacyCacheSensitivity: stored ? "stores-original-locally" : "none",
    userApprovalPrompts: policy.mode === "suggest" ? 1 : 0
  },
  topOpportunities: [{
    type: `${result.kind}-filter`,
    estimatedSavedTokens: result.metrics.savedTokens,
    riskLevel: result.riskLevel,
    reason: result.notes.join(" ")
  }]
};
const advisor = createAdvisorReport(recommendation, { mode: policy.mode });
if (advisor.action === "apply" && !reduction.applied) {
  advisor.action = "skip";
  advisor.headline = "Skip MDZ because the delivered wrapper would not meet policy thresholds.";
  advisor.reason = `No model-facing reduction: ${reduction.reason}.`;
}
const report = {
  generatedAt: new Date().toISOString(),
  hook: "PostToolUse",
  policy,
  optimization: {
    kind: result.kind,
    riskLevel: result.riskLevel,
    notes: result.notes,
    metrics: result.metrics
  },
  handle: reduction.handle,
  delivered: reduction.applied,
  toolName,
  replacementSupported: false,
  deliveryReason: "Codex block-style replacement marks successful tools as failed; use mdz_gateway for automatic reduction.",
  advisor,
  text: renderAdvisorReport(advisor)
};

await writeHookReport("post-tool-use", report);
await recordModelFacingObservation(reduction, { source: { hook: "PostToolUse", platform: "codex", tool: toolName } });
console.error(`MDZ tool hook: delivered=${reduction.applied}, netSaved=${reduction.metrics.savedTokens}, risk=${result.riskLevel}`);

function extractToolOutput(parsed) {
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object") return String(parsed ?? "");
  const response = parsed.tool_response ?? parsed.toolResponse ?? parsed;
  if (typeof response === "string") return response;
  if (Array.isArray(response.content)) {
    const text = response.content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
    if (text) return text;
  }
  return response.output ?? response.stdout ?? response.stderr ?? response.text ?? JSON.stringify(response);
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function writeHookReport(name, report) {
  await mkdir(".mdz/hooks", { recursive: true });
  const target = `.mdz/hooks/${name}.latest.json`;
  const temp = `.mdz/hooks/${name}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(report, null, 2), "utf8");
  await rename(temp, target);
}
