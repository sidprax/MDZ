import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installMdz, runDoctor, renderDoctorReport } from "../src/index.js";

test("runDoctor verifies local MDZ setup", async () => {
  const report = await runDoctor({
    platform: "antigravity",
    quickBenchmark: false
  });

  assert.equal(report.ready, true);
  assert.equal(report.platform, "antigravity");
  assert.ok(report.summary.checks >= 5);
  assert.ok(report.checks.some((check) => check.name === "MCP server" && check.status === "pass"));
  assert.match(renderDoctorReport(report), /MDZ Doctor/);
});

test("runDoctor verifies a separate target project", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdz-doctor-target-"));
  try {
    for (const platform of ["codex", "antigravity", "claude", "generic"]) {
      await installMdz({ platform, sourceRoot: process.cwd(), target, mode: "observe" });
    }
    const report = await runDoctor({
      platform: "all",
      sourceRoot: process.cwd(),
      target,
      quickBenchmark: false
    });
    assert.equal(report.ready, true);
    assert.equal(report.targetRoot, target);
    assert.ok(report.checks.some((check) => check.name === "MCP server" && check.status === "pass"));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
