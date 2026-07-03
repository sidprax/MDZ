import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import {
  analyzeDiffContext,
  attributeSavings,
  classifyTask,
  createCompactionArtifact,
  createHandoffArtifact,
  createLearningReport,
  createRepoMemoryMap,
  createTaskContract,
  getSemanticCache,
  planContextBudget,
  putSemanticCache,
  readProjectPolicy,
  recommendToolGuardrails,
  recordFeedback,
  redactText,
  runCompressionExperiment,
  runQualityHarness,
  runSetupWizard,
  scanSecrets,
  writeProjectPolicy
} from "../src/index.js";

test("learning profile records feedback and reports preferences", async () => {
  const dir = ".mdz/test-learning";
  await rm(dir, { recursive: true, force: true });
  await recordFeedback({ event: "task-success", mode: "suggest", taskType: "debugging", savingsPercent: 0.25 }, {
    file: `${dir}/events.jsonl`,
    profileFile: `${dir}/profile.json`
  });
  const report = await createLearningReport({ file: `${dir}/events.jsonl` });

  assert.equal(report.profile.events, 1);
  assert.equal(report.profile.signals.taskSuccess, 1);
});

test("task classifier and budget planner choose task-aware defaults", () => {
  const text = "FAIL auth test AssertionError expected 401 received 200";
  const classified = classifyTask(text);
  const budget = planContextBudget(text);

  assert.equal(classified.taskType, "test-failure");
  assert.equal(budget.budget.recommendedMode, "safe");
});

test("privacy scanner redacts likely secrets", () => {
  const text = "api_key=supersecretvalue12345";
  const scan = scanSecrets(text);
  const redacted = redactText(text);

  assert.equal(scan.findingCount, 1);
  assert.match(redacted.redacted, /REDACTED/);
});

test("task contract, compaction, and handoff create handle-backed artifacts", async () => {
  const dir = ".mdz/test-contracts/store";
  await rm(".mdz/test-contracts", { recursive: true, force: true });
  const text = "Please fix auth. ERROR token expired in src/auth/session.ts. Next: run tests.";
  const contract = await createTaskContract(text, { storeDir: dir });
  const compact = await createCompactionArtifact(text, { storeDir: dir });
  const handoff = await createHandoffArtifact(text, { storeDir: dir, target: "antigravity" });

  assert.match(contract.handle, /^mdz:\/\/context\//);
  assert.match(compact.artifact, /MDZ Compaction State/);
  assert.match(handoff.artifact, /MDZ Cross-Agent Handoff/);
});

test("semantic cache stores and retrieves summaries", async () => {
  const cacheDir = ".mdz/test-semantic-cache";
  await rm(cacheDir, { recursive: true, force: true });
  const text = "Important file content";
  await putSemanticCache(text, "summary", { cacheDir });
  const cached = await getSemanticCache(text, { cacheDir });

  assert.equal(cached.summary, "summary");
});

test("repo memory map and tool guardrails summarize workflow context", async () => {
  const map = await createRepoMemoryMap({ root: ".", maxFiles: 20, maxDepth: 2 });
  const guardrails = recommendToolGuardrails({ text: "inspect repository and read entire files", tool: "read" });

  assert.ok(map.totals.files > 0);
  assert.ok(guardrails.recommendationCount > 0);
});

test("diff context, quality harness, attribution, and compression experiment run locally", async () => {
  const diff = "diff --git a/a.js b/a.js\n@@\n-old\n+new";
  const diffReport = analyzeDiffContext(diff);
  const quality = runQualityHarness("ERROR database timeout", "ERROR database timeout", { markers: ["ERROR database timeout"] });
  const attribution = attributeSavings({ reports: [{ type: "test-output", savings: { estimatedTokensSaved: 100 } }] });
  const compression = runCompressionExperiment(["repeat long diagnostic line", "repeat long diagnostic line"].join("\n"));

  assert.equal(diffReport.files.length, 1);
  assert.equal(quality.passed, true);
  assert.equal(attribution.totalAttributedTokens, 100);
  assert.ok(compression.originalTokens >= compression.encodedTokens || compression.warning);
});

test("project policy and setup wizard are local and deterministic", async () => {
  const dir = ".mdz/test-project-policy";
  await rm(dir, { recursive: true, force: true });
  const written = await writeProjectPolicy({ defaults: { mode: "suggest" } }, { file: `${dir}/policy.json` });
  const read = await readProjectPolicy({ file: `${dir}/policy.json` });
  const setup = await runSetupWizard({ root: ".", platform: "generic", skipDoctor: true });

  assert.equal(written.policy.defaults.mode, "suggest");
  assert.equal(read.policy.defaults.mode, "suggest");
  assert.match(setup.recommendedInstall, /install generic/);
});

test("redaction output can be written by callers", async () => {
  const dir = ".mdz/test-redaction";
  await rm(dir, { recursive: true, force: true });
  await writeFile(`${dir}.txt`, "token=verysecretvalue12345", "utf8");
  const result = redactText(await readFile(`${dir}.txt`, "utf8"));

  assert.match(result.redacted, /REDACTED/);
});
