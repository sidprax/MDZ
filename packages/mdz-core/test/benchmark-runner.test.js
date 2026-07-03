import test from "node:test";
import assert from "node:assert/strict";
import { listBenchmarkScenarios, runBenchmarkScenario, runBenchmarkSuite } from "../src/index.js";

test("listBenchmarkScenarios returns MVP scenarios", () => {
  const scenarios = listBenchmarkScenarios();
  const ids = scenarios.map((scenario) => scenario.id);

  assert.ok(ids.includes("verbose-test-failure"));
  assert.ok(ids.includes("large-log-root-cause"));
  assert.ok(ids.includes("repo-exploration"));
});

test("runBenchmarkScenario reports savings and downsides", async () => {
  const report = await runBenchmarkScenario("verbose-test-failure", {
    mode: "safe",
    storeDir: ".mdz/test-benchmark-store"
  });

  assert.equal(report.scenario.id, "verbose-test-failure");
  assert.equal(report.mdz.mode, "safe");
  assert.ok(report.savings.estimatedTokensSaved > 500);
  assert.ok(report.savings.estimatedPercentSaved > 0.2);
  assert.ok(report.downsides.addedLocalLatencyMs >= 1);
  assert.ok(report.downsides.localDiskBytes > 0);
  assert.equal(report.quality.passed, true);
});

test("runBenchmarkScenario supports custom files", async () => {
  const report = await runBenchmarkScenario({
    id: "custom",
    name: "Custom Log",
    fixture: "benchmarks/fixtures/large-log-root-cause.txt",
    type: "log-output",
    successMarkers: ["connection pool exhausted"]
  }, {
    mode: "safe",
    storeDir: ".mdz/test-benchmark-store"
  });

  assert.equal(report.scenario.id, "custom");
  assert.equal(report.quality.passed, true);
  assert.ok(report.downsides.localDiskBytes > 0);
});

test("runBenchmarkSuite aggregates scenario totals", async () => {
  const suite = await runBenchmarkSuite({
    mode: "safe",
    storeDir: ".mdz/test-benchmark-store"
  });

  assert.equal(suite.scenarioCount, 3);
  assert.ok(suite.totals.baselineTokens > 0);
  assert.ok(suite.totals.savedTokens >= 0);
  assert.ok(suite.totals.addedLocalLatencyMs > 0);
  assert.equal(suite.reports.length, 3);
});
