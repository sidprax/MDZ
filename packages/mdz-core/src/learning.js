import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EVENTS_FILE = ".mdz/learning/events.jsonl";
const DEFAULT_PROFILE_FILE = ".mdz/learning/profile.json";

export async function recordFeedback(event, options = {}) {
  const file = options.file ?? DEFAULT_EVENTS_FILE;
  const entry = normalizeFeedback(event);
  await mkdir(path.dirname(file), { recursive: true });
  const existing = await readText(file);
  await writeFile(file, `${existing}${JSON.stringify(entry)}\n`, "utf8");
  const profile = await updateLearningProfile({ file, profileFile: options.profileFile ?? DEFAULT_PROFILE_FILE });
  return { file, entry, profile };
}

export async function readFeedbackEvents(options = {}) {
  const file = options.file ?? DEFAULT_EVENTS_FILE;
  const text = await readText(file);
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore malformed local feedback lines.
    }
  }
  return { file, events };
}

export async function updateLearningProfile(options = {}) {
  const feedback = await readFeedbackEvents({ file: options.file });
  const profile = buildLearningProfile(feedback.events);
  const profileFile = options.profileFile ?? DEFAULT_PROFILE_FILE;
  await mkdir(path.dirname(profileFile), { recursive: true });
  await writeFile(profileFile, JSON.stringify(profile, null, 2), "utf8");
  return profile;
}

export async function createLearningReport(options = {}) {
  const feedback = await readFeedbackEvents({ file: options.file });
  const profile = buildLearningProfile(feedback.events);
  return {
    generatedAt: new Date().toISOString(),
    file: feedback.file,
    profile,
    recent: feedback.events.slice(-10).reverse()
  };
}

export function renderLearningReport(report) {
  return [
    "# MDZ Learning Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Events: ${report.profile.events}`,
    `Preferred mode: ${report.profile.preferredMode}`,
    `Risk tolerance: ${report.profile.riskTolerance}`,
    `Average accepted savings: ${formatPercent(report.profile.averageAcceptedSavings)}`,
    `Handle expansion rate: ${formatPercent(report.profile.handleExpansionRate)}`,
    "",
    "## Signals",
    "",
    `- Accepted: ${report.profile.signals.accepted}`,
    `- Rejected: ${report.profile.signals.rejected}`,
    `- Too aggressive: ${report.profile.signals.tooAggressive}`,
    `- Too verbose: ${report.profile.signals.tooVerbose}`,
    `- Too terse: ${report.profile.signals.tooTerse}`,
    `- Task success: ${report.profile.signals.taskSuccess}`,
    `- Handle expansions: ${report.profile.signals.handleExpanded}`
  ].join("\n");
}

function normalizeFeedback(event = {}) {
  return {
    id: event.id ?? `feedback_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    generatedAt: event.generatedAt ?? new Date().toISOString(),
    event: event.event ?? event.type ?? "note",
    mode: event.mode,
    taskType: event.taskType,
    action: event.action,
    savingsPercent: Number(event.savingsPercent ?? event.estimatedPercentSaved ?? 0),
    riskLevel: event.riskLevel,
    handle: event.handle,
    session: event.session,
    note: event.note
  };
}

function buildLearningProfile(events) {
  const signals = {
    accepted: count(events, ["accepted", "apply-once", "task-success"]),
    rejected: count(events, ["rejected", "skip-preferred"]),
    tooAggressive: count(events, ["reduction-too-aggressive", "missing-context"]),
    tooVerbose: count(events, ["too-verbose"]),
    tooTerse: count(events, ["too-terse"]),
    taskSuccess: count(events, ["task-success"]),
    handleExpanded: count(events, ["handle-expanded"])
  };
  const acceptedSavings = events
    .filter((event) => ["accepted", "apply-once", "task-success"].includes(event.event))
    .map((event) => event.savingsPercent)
    .filter((value) => value > 0);
  const averageAcceptedSavings = acceptedSavings.length
    ? acceptedSavings.reduce((sum, value) => sum + value, 0) / acceptedSavings.length
    : 0;
  const handleExpansionRate = events.length ? signals.handleExpanded / events.length : 0;
  return {
    generatedAt: new Date().toISOString(),
    events: events.length,
    preferredMode: inferMode(events, signals),
    preferredOutputProfile: inferOutputProfile(signals),
    riskTolerance: signals.tooAggressive > signals.accepted ? "low" : signals.accepted > 3 ? "medium" : "unknown",
    averageAcceptedSavings,
    handleExpansionRate,
    signals,
    byTaskType: groupBy(events, "taskType"),
    byMode: groupBy(events, "mode")
  };
}

function count(events, names) {
  return events.filter((event) => names.includes(event.event)).length;
}

function inferMode(events, signals) {
  if (!events.length) return "observe";
  if (signals.tooAggressive > 0) return "suggest";
  if (signals.accepted >= 5 && signals.handleExpanded === 0) return "safe";
  if (signals.accepted >= 2) return "suggest";
  return "observe";
}

function inferOutputProfile(signals) {
  if (signals.tooTerse > signals.tooVerbose) return "standard";
  if (signals.tooVerbose > signals.tooTerse) return "terse";
  return "standard";
}

function groupBy(events, key) {
  const grouped = {};
  for (const event of events) {
    const value = event[key] ?? "unknown";
    grouped[value] = (grouped[value] ?? 0) + 1;
  }
  return grouped;
}

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}
