import { createCompactionArtifact } from "./compaction-assistant.js";

export async function createHandoffArtifact(text, options = {}) {
  const compact = await createCompactionArtifact(text, options);
  const target = options.target ?? "generic-agent";
  return {
    generatedAt: new Date().toISOString(),
    format: "mdz-handoff-v1",
    target,
    handle: compact.handle,
    artifact: [
      "# MDZ Cross-Agent Handoff",
      "",
      `Target: ${target}`,
      `Generated: ${compact.generatedAt}`,
      "",
      compact.artifact,
      "",
      "## Handoff Instructions",
      "- Respect preserved evidence and task constraints.",
      "- Expand handles only when required for correctness.",
      "- Continue using MDZ reports for savings and downsides."
    ].join("\n"),
    compact
  };
}
