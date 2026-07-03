import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const promptHook = path.join(root, "adapters", "codex", "hooks", "user-prompt-submit.mjs");
const toolHook = path.join(root, "adapters", "codex", "hooks", "post-tool-use.mjs");

test("user prompt hook writes an observation report", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-codex-hook-"));
  try {
    await runHook(promptHook, JSON.stringify({
      prompt: "Please inspect the failing tests and fix the auth bug."
    }), cwd);

    const report = JSON.parse(await readFile(path.join(cwd, ".mdz", "hooks", "user-prompt-submit.latest.json"), "utf8"));
    assert.equal(report.hook, "UserPromptSubmit");
    assert.ok(report.estimate.tokens > 0);
    assert.ok(["observe", "ask", "apply", "skip"].includes(report.advisor.action));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("post tool hook writes an output savings report", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-codex-hook-"));
  try {
    await runHook(toolHook, JSON.stringify({
      stdout: ["PASS one", "FAIL auth test", "AssertionError: Expected 401 Received 200"].join("\n")
    }), cwd);

    const report = JSON.parse(await readFile(path.join(cwd, ".mdz", "hooks", "post-tool-use.latest.json"), "utf8"));
    assert.equal(report.hook, "PostToolUse");
    assert.ok(report.optimization.metrics.savedTokens >= 0);
    assert.ok(["observe", "ask", "apply", "skip"].includes(report.advisor.action));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("post tool hook remains advisory in safe mode and records potential savings", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-codex-hook-"));
  try {
    await mkdir(path.join(cwd, ".mdz"), { recursive: true });
    await writeFile(path.join(cwd, ".mdz", "policy.json"), JSON.stringify({ mode: "safe", storeOriginals: true }), "utf8");
    const noisy = [
      ...Array.from({ length: 800 }, (_, index) => `PASS test ${index}`),
      "FAIL auth test",
      "AssertionError: Expected 401 Received 200"
    ].join("\n");
    const execution = await runHook(toolHook, JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_response: { content: [{ type: "text", text: noisy }] }
    }), cwd);
    assert.equal(execution.stdout, "");

    const ledger = await readFile(path.join(cwd, ".mdz", "ledger.jsonl"), "utf8");
    assert.doesNotMatch(ledger, /"action":"apply"/);
    const report = JSON.parse(await readFile(path.join(cwd, ".mdz", "hooks", "post-tool-use.latest.json"), "utf8"));
    assert.equal(report.delivered, false);
    assert.equal(report.replacementSupported, false);
    assert.ok(report.optimization.metrics.savedTokens > 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("post tool hook does not claim replacement for unsupported Codex execution tools", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-codex-hook-"));
  try {
    await mkdir(path.join(cwd, ".mdz"), { recursive: true });
    await writeFile(path.join(cwd, ".mdz", "policy.json"), JSON.stringify({ mode: "safe", storeOriginals: true }), "utf8");
    const execution = await runHook(toolHook, JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "shell_command",
      tool_response: { content: [{ type: "text", text: "PASS test\n".repeat(1000) + "FAIL auth\nAssertionError" }] }
    }), cwd);
    assert.equal(execution.stdout, "");
    const report = JSON.parse(await readFile(path.join(cwd, ".mdz", "hooks", "post-tool-use.latest.json"), "utf8"));
    assert.equal(report.delivered, false);
    assert.equal(report.replacementSupported, false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function runHook(script, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Hook failed with code ${code}: ${stderr}`));
      }
    });
    child.stdin.end(input);
  });
}
