import { createCompressionPlan } from "./compression-planner.js";
import { extractEvidence } from "./evidence-extractor.js";
import { storeContext } from "./handles.js";
import { classifyTask } from "./task-classifier.js";

export async function createCompactionArtifact(text, options = {}) {
  const original = String(text ?? "");
  const stored = options.storeOriginal === false ? null : await storeContext(original, { storeDir: options.storeDir });
  const task = classifyTask(original);
  const evidence = extractEvidence(original, { limit: 20 });
  const plan = createCompressionPlan(original, { mode: options.mode ?? "suggest" });
  const artifact = [
    "# MDZ Compaction State",
    "",
    `Task type: ${task.taskType}`,
    `Original handle: ${stored?.handle ?? "not stored"}`,
    `Plan recommendation: ${plan.recommendation}`,
    "",
    "## Evidence To Preserve",
    ...list(evidence.requiredMarkers.slice(0, 15)),
    "",
    "## Next Steps",
    ...list(extractNextSteps(original)),
    "",
    "## Expansion",
    stored ? `Expand ${stored.handle} if the next agent needs omitted detail.` : "No original handle was stored."
  ].join("\n");
  return {
    generatedAt: new Date().toISOString(),
    handle: stored?.handle,
    task,
    plan: plan.summary,
    evidence: {
      totalEvidence: evidence.totalEvidence,
      requiredMarkers: evidence.requiredMarkers.slice(0, 20)
    },
    artifact
  };
}

function extractNextSteps(text) {
  const lines = String(text ?? "").split(/\r?\n/).filter((line) => /next|todo|remaining|follow/i.test(line));
  return lines.length ? lines.slice(-8).map((line) => line.trim().slice(0, 220)) : ["Continue from the preserved evidence and current task objective."];
}

function list(items) {
  return items.length ? items.map((item) => `- ${item}`) : ["- None detected."];
}
