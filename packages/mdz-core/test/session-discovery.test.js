import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverSessions, renderSessionDiscovery } from "../src/index.js";

test("discoverSessions finds likely workspace and Antigravity transcripts", async () => {
  const root = ".mdz/test-session-discovery/workspace";
  const home = path.resolve(".mdz/test-session-discovery/home");
  await rm(".mdz/test-session-discovery", { recursive: true, force: true });
  await mkdir(path.join(root, "logs"), { recursive: true });
  await mkdir(path.join(home, ".gemini", "antigravity", "brain", "abc", ".system_generated", "logs"), { recursive: true });
  await writeFile(path.join(root, "logs", "session-demo.txt"), "user: test\nassistant: done", "utf8");
  await writeFile(
    path.join(home, ".gemini", "antigravity", "brain", "abc", ".system_generated", "logs", "transcript.jsonl"),
    "{\"type\":\"user\",\"text\":\"hello\"}\n",
    "utf8"
  );

  const report = await discoverSessions({ root, home, platform: "all", maxDepth: 8 });
  const rendered = renderSessionDiscovery(report);

  assert.equal(report.candidates.length, 2);
  assert.ok(report.candidates.some((item) => item.platform === "antigravity"));
  assert.match(rendered, /MDZ Session Discovery/);
  assert.match(rendered, /transcript\.jsonl/);
});
