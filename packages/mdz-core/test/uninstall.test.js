import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installMdz, uninstallMdz } from "../src/index.js";

test("Codex uninstall removes only MDZ-owned configuration and preserves data", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdz-uninstall-"));
  try {
    await installMdz({ platform: "codex", sourceRoot: process.cwd(), target, mode: "observe" });
    const result = await uninstallMdz({ platform: "codex", sourceRoot: process.cwd(), target });
    assert.equal(result.uninstalled, true);
    assert.equal(result.dataPreserved, true);
    await assert.rejects(access(path.join(target, ".codex", "config.toml")));
    await assert.rejects(access(path.join(target, ".codex", "hooks.json")));
    await assert.rejects(access(path.join(target, ".agents", "skills", "mdz")));
    assert.ok(JSON.parse(await readFile(path.join(target, ".mdz", "policy.json"), "utf8")));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("Codex uninstall preserves unrelated config and hook groups", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdz-uninstall-"));
  try {
    await installMdz({ platform: "codex", sourceRoot: process.cwd(), target });
    const configPath = path.join(target, ".codex", "config.toml");
    const hooksPath = path.join(target, ".codex", "hooks.json");
    const mdzBlock = readMarkerBlock(await readFile(configPath, "utf8"));
    const mdzHooks = JSON.parse(await readFile(hooksPath, "utf8")).hooks;
    await writeFile(configPath, `model = "gpt-test"\n\n${mdzBlock}\n`, "utf8");
    await writeFile(hooksPath, JSON.stringify({ hooks: {
      Stop: [{ hooks: [{ type: "command", command: "node custom.mjs" }] }],
      ...mdzHooks
    } }, null, 2), "utf8");
    await uninstallMdz({ platform: "codex", sourceRoot: process.cwd(), target });
    assert.match(await readFile(configPath, "utf8"), /model = "gpt-test"/);
    assert.match(await readFile(hooksPath, "utf8"), /custom\.mjs/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

function readMarkerBlock(value) {
  return value.match(/# >>> MDZ Token Advisor >>>[\s\S]*?# <<< MDZ Token Advisor <<</)?.[0] ?? "";
}
