import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

test("Antigravity hook writes parseable prompt and tool reports", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-antigravity-hook-"));
  try {
    const script = path.join(root, "adapters", "antigravity", "hooks", "mdz-hook.mjs");
    await runHook(script, JSON.stringify({
      hook_event_name: "PreInvocation",
      prompt: "Please inspect the failing tests and keep only actionable findings."
    }), cwd);
    await runHook(script, JSON.stringify({
      hook_event_name: "PostToolUse",
      stdout: largeToolOutput()
    }), cwd);

    const prompt = await readJson(path.join(cwd, ".mdz", "hooks", "antigravity-pre-invocation.latest.json"));
    const tool = await readJson(path.join(cwd, ".mdz", "hooks", "antigravity-post-tool-use.latest.json"));
    assert.equal(prompt.platform, "antigravity");
    assert.equal(prompt.hook, "PreInvocation");
    assert.equal(tool.platform, "antigravity");
    assert.equal(tool.hook, "PostToolUse");
    assert.ok(tool.optimization.metrics.savedTokens >= 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Claude hook writes parseable prompt and tool reports", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mdz-claude-hook-"));
  try {
    const script = path.join(root, "adapters", "claude", "hooks", "mdz-hook.mjs");
    await runHook(script, JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      prompt: "Please inspect the failing tests and keep only actionable findings."
    }), cwd);
    await runHook(script, JSON.stringify({
      hook_event_name: "PostToolUse",
      stdout: largeToolOutput()
    }), cwd);

    const prompt = await readJson(path.join(cwd, ".mdz", "hooks", "claude-user-prompt-submit.latest.json"));
    const tool = await readJson(path.join(cwd, ".mdz", "hooks", "claude-post-tool-use.latest.json"));
    assert.equal(prompt.platform, "claude");
    assert.equal(prompt.hook, "UserPromptSubmit");
    assert.equal(tool.platform, "claude");
    assert.equal(tool.hook, "PostToolUse");
    assert.ok(tool.optimization.metrics.savedTokens >= 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function largeToolOutput() {
  return [
    "PASS setup\n".repeat(200),
    "FAIL auth.spec.ts",
    "AssertionError: Expected status 401 Received 200",
    "WARN repeated dependency notice\n".repeat(200)
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function runHook(script, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Hook failed with code ${code}: ${stderr}`));
      }
    });
    child.stdin.end(input);
  });
}
