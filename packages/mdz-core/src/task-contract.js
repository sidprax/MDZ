import { extractEvidence } from "./evidence-extractor.js";
import { classifyTask } from "./task-classifier.js";
import { storeContext } from "./handles.js";

export async function createTaskContract(text, options = {}) {
  const original = String(text ?? "");
  const stored = options.storeOriginal === false ? null : await storeContext(original, { storeDir: options.storeDir });
  const classification = classifyTask(original);
  const evidence = extractEvidence(original, { limit: 12 });
  const goals = extractLines(original, [/please/i, /need/i, /build/i, /fix/i, /add/i, /create/i]).slice(0, 6);
  const constraints = extractLines(original, [/do not/i, /must/i, /without/i, /keep/i, /avoid/i]).slice(0, 6);
  const contract = [
    "# MDZ Task Contract",
    "",
    `Task type: ${classification.taskType} (${classification.confidence})`,
    `Original handle: ${stored?.handle ?? "not stored"}`,
    "",
    "## Goal",
    ...renderList(goals.length ? goals : [firstSentence(original)]),
    "",
    "## Constraints",
    ...renderList(constraints),
    "",
    "## Required Evidence",
    ...renderList(evidence.requiredMarkers.slice(0, 10)),
    "",
    "## Expansion",
    stored ? `Use ${stored.handle} if more original detail is required.` : "Original content was not stored."
  ].join("\n");
  return {
    generatedAt: new Date().toISOString(),
    handle: stored?.handle,
    classification,
    evidence: {
      totalEvidence: evidence.totalEvidence,
      requiredMarkers: evidence.requiredMarkers.slice(0, 20)
    },
    contract
  };
}

function extractLines(text, patterns) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && patterns.some((pattern) => pattern.test(line)))
    .map((line) => line.slice(0, 220));
}

function firstSentence(text) {
  return String(text ?? "").replace(/\s+/g, " ").split(/[.!?]\s/)[0].slice(0, 220);
}

function renderList(items) {
  if (!items.length) return ["- None detected."];
  return items.map((item) => `- ${item}`);
}
