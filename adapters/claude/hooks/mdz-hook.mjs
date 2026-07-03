#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import process from "node:process";
import {
  createAdvisorReport,
  createLedgerReport,
  estimateTokens,
  filterOutput,
  readPolicy,
  recommendForSession,
  recordLedgerEvent,
  renderAdvisorReport,
  renderLedgerReport,
} from "../../../packages/mdz-core/src/index.js";

const input = await readStdin();
const event = parseEvent(input);
const hookName = event.hook_event_name ?? event.hookEventName ?? event.event ?? process.env.CLAUDE_HOOK_EVENT ?? "Unknown";
const policy = await readPolicy();

if (/UserPromptSubmit|PreInvocation/i.test(hookName)) {
  await handlePrompt(event, policy, hookName);
} else if (/PostToolUse|PostToolUseFailure|PostToolBatch/i.test(hookName)) {
  await handleToolOutput(event, policy, hookName);
} else if (/Stop|SessionEnd|PreCompact|PostCompact/i.test(hookName)) {
  await handleStop(event, policy, hookName);
} else {
  await writeHookReport("claude-generic", {
    generatedAt: new Date().toISOString(),
    platform: "claude",
    hook: hookName,
    eventKeys: Object.keys(event),
    policy
  });
  console.error(`MDZ Claude hook observed ${hookName}`);
}

async function handlePrompt(event, policy, hookName) {
  const text = extractPrompt(event);
  const estimate = estimateTokens(text);
  const recommendation = recommendForSession(text);
  const advisor = createAdvisorReport(recommendation, { mode: policy.mode });
  const report = {
    generatedAt: new Date().toISOString(),
    platform: "claude",
    hook: hookName,
    policy,
    estimate,
    advisor,
    text: renderAdvisorReport(advisor)
  };

  await writeHookReport("claude-user-prompt-submit", report);
  await recordLedgerEvent({
    source: { platform: "claude", hook: hookName },
    type: "prompt",
    mode: policy.mode,
    action: advisor.action,
    tokens: {
      original: recommendation.totalTokens,
      reduced: recommendation.totalTokens
    },
    savings: advisor.savings,
    downsides: advisor.downsides,
    notes: [advisor.reason]
  });
  console.error(`MDZ Claude prompt hook: ${estimate.tokens} estimated tokens, action=${advisor.action}`);
}

async function handleToolOutput(event, policy, hookName) {
  const text = extractToolOutput(event);
  const filtered = filterOutput(text, { kind: "auto" });
  const stored = null;

  const recommendation = {
    format: "tool-output",
    recommendation: filtered.metrics.savedTokens > 500 ? "use" : filtered.metrics.savedTokens > 100 ? "ask" : "skip",
    totalTokens: filtered.metrics.originalTokens,
    estimatedSavedTokens: filtered.metrics.savedTokens,
    estimatedPercentSaved: filtered.metrics.percentSaved,
    reason: filtered.metrics.savedTokens > 0
      ? `Tool output can be reduced as ${filtered.kind} output.`
      : "Tool output is too small to benefit from MDZ filtering.",
    downsides: {
      addedLocalLatencyMs: filtered.metrics.estimatedLatencyMs,
      localCpuWork: filtered.metrics.estimatedCpuWork,
      localDiskBytes: stored?.bytes ?? 0,
      qualityRisk: filtered.riskLevel,
      privacyCacheSensitivity: stored ? "stores-original-locally" : "none",
      userApprovalPrompts: policy.mode === "suggest" ? 1 : 0
    },
    topOpportunities: [{
      type: `${filtered.kind}-filter`,
      estimatedSavedTokens: filtered.metrics.savedTokens,
      riskLevel: filtered.riskLevel,
      reason: filtered.notes.join(" ")
    }]
  };
  const advisor = createAdvisorReport(recommendation, { mode: policy.mode });
  const report = {
    generatedAt: new Date().toISOString(),
    platform: "claude",
    hook: hookName,
    policy,
    optimization: {
      kind: filtered.kind,
      riskLevel: filtered.riskLevel,
      notes: filtered.notes,
      metrics: filtered.metrics
    },
    handle: stored?.handle,
    delivered: false,
    deliveryReason: "Claude native hook is advisory; use mdz_gateway for enforceable replacement.",
    advisor,
    text: renderAdvisorReport(advisor)
  };

  await writeHookReport("claude-post-tool-use", report);
  await recordLedgerEvent({
    source: { platform: "claude", hook: hookName },
    type: "tool-output",
    mode: policy.mode,
    action: policy.mode === "observe" ? "observe" : "skip",
    tokens: {
      original: filtered.metrics.originalTokens,
      reduced: filtered.metrics.originalTokens
    },
    savings: advisor.savings,
    downsides: advisor.downsides,
    handle: stored?.handle,
    example: {
      technique: `${filtered.kind}-output-filtering`,
      summary: filtered.notes[0],
      before: `${filtered.metrics.originalLines} lines / ${filtered.metrics.originalTokens} estimated tokens`,
      after: "Advisory hook only; original tool output was unchanged"
    },
    notes: [...filtered.notes, "No model-facing replacement was confirmed; route the tool through mdz_gateway to apply."]
  });
  console.error(`MDZ Claude tool hook: saved=${filtered.metrics.savedTokens} estimated tokens, action=${advisor.action}`);
}

async function handleStop(event, policy, hookName) {
  const usage = await createLedgerReport();
  const report = {
    generatedAt: new Date().toISOString(),
    platform: "claude",
    hook: hookName,
    policy,
    usage,
    text: renderLedgerReport(usage)
  };
  await writeHookReport("claude-stop", report);
  console.error(`MDZ Claude stop hook: events=${usage.totals.events}, saved=${usage.totals.savedTokens}`);
}

function parseEvent(inputText) {
  try {
    return JSON.parse(inputText || "{}");
  } catch {
    return { text: inputText };
  }
}

function extractPrompt(event) {
  return firstString(
    event.prompt,
    event.user_prompt,
    event.userPrompt,
    event.message,
    event.text,
    event.payload?.prompt,
    event.payload?.message,
    event.payload?.text
  ) ?? JSON.stringify(event);
}

function extractToolOutput(event) {
  return firstString(
    event.output,
    event.stdout,
    event.stderr,
    event.result,
    event.text,
    event.tool_response,
    event.toolResponse,
    event.payload?.output,
    event.payload?.stdout,
    event.payload?.stderr,
    event.payload?.text
  ) ?? JSON.stringify(event);
}

function firstString(...values) {
  return values.find((value) => typeof value === "string");
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data;
}

async function writeHookReport(name, report) {
  await mkdir(".mdz/hooks", { recursive: true });
  const target = `.mdz/hooks/${name}.latest.json`;
  const temp = `.mdz/hooks/${name}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(report, null, 2), "utf8");
  await rename(temp, target);
}
