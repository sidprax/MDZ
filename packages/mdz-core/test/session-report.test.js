import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createSessionReport, renderSessionReport, writeSessionReport } from "../src/index.js";

test("createSessionReport includes advisor, opportunities, and next mode", async () => {
  const dir = ".mdz/test-session-report";
  await rm(dir, { recursive: true, force: true });
  const text = [
    "tool output:",
    "ERROR database timeout request_id=req_1",
    ...Array.from({ length: 80 }, () => "WARN connection pool exhausted active=50 idle=0 max=50")
  ].join("\n");

  const report = createSessionReport(text, { mode: "observe", file: "session.txt" });
  const rendered = renderSessionReport(report);
  const written = await writeSessionReport(report, { dir, baseName: "session-test" });

  assert.equal(report.mode, "observe");
  assert.ok(report.summary.totalTokens > 0);
  assert.match(rendered, /MDZ Session Savings Report/);
  assert.match(written.jsonPath, /session-test\.json$/);
  assert.match(written.htmlPath, /session-test\.html$/);
});
