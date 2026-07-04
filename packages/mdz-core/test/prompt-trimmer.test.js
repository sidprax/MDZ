import test from "node:test";
import assert from "node:assert/strict";
import { trimPrompt } from "../src/prompt-trimmer.js";

test("trimPrompt removes low-signal conversational phrasing", () => {
  const result = trimPrompt("Hi there, could you please go ahead and take a look at the failing auth tests if possible?");
  assert.equal(result.riskLevel, "low");
  assert.ok(result.metrics.savedTokens > 0);
  assert.match(result.reduced, /failing auth tests/i);
  assert.doesNotMatch(result.reduced, /could you please|if possible|take a look/i);
  assert.ok(result.examples.length > 0);
});

test("trimPrompt preserves constraints and negations", () => {
  const result = trimPrompt("Please fix the parser, but do not change public APIs and keep JSON output stable.");
  assert.match(result.reduced, /do not change public APIs/i);
  assert.match(result.reduced, /keep JSON output stable/i);
  assert.ok(result.notes.some((note) => /Constraints or negations/i.test(note)));
});

test("trimPrompt preserves code and path-heavy prompts", () => {
  const source = [
    "Could you please update C:\\Users\\<you>\\project\\config.json?",
    "```js",
    "const message = 'please do not trim this string';",
    "```"
  ].join("\n");
  const result = trimPrompt(source);
  assert.match(result.reduced, /C:\\Users\\<you>\\project\\config\.json/);
  assert.match(result.reduced, /please do not trim this string/);
  assert.equal(result.riskLevel, "medium");
});
