#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import process from "node:process";
import { createAdvisorReport, estimateTokens, readPolicy, recommendForSession, recordLedgerEvent, renderAdvisorReport } from "../../../packages/mdz-core/src/index.js";

const input = await readStdin();
const text = extractText(input);
const policy = await readPolicy();
const estimate = estimateTokens(text);
const recommendation = recommendForSession(text);
const report = createAdvisorReport(recommendation, { mode: policy.mode });
const hookReport = {
  generatedAt: new Date().toISOString(),
  hook: "UserPromptSubmit",
  policy,
  estimate,
  advisor: report,
  text: renderAdvisorReport(report)
};

await writeHookReport("user-prompt-submit", hookReport);
await recordLedgerEvent({
  source: { hook: "UserPromptSubmit" },
  type: "prompt",
  mode: policy.mode,
  action: report.action,
  tokens: {
    original: recommendation.totalTokens,
    reduced: recommendation.totalTokens
  },
  savings: report.savings,
  downsides: report.downsides,
  notes: [report.reason]
});
console.error(`MDZ prompt hook: ${estimate.tokens} estimated tokens, action=${report.action}`);

function extractText(inputText) {
  try {
    const parsed = JSON.parse(inputText);
    return parsed.prompt ?? parsed.userPrompt ?? parsed.text ?? JSON.stringify(parsed);
  } catch {
    return inputText;
  }
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
