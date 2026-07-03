# MDZ Universal Adapter Contract

MDZ is platform-neutral at the core. Each platform adapter should be a thin
package around the same `mdz-core` library and `mdz-mcp-server`.

## Required Capabilities

Every adapter should provide these surfaces where the platform supports them:

- Skill or instruction file that teaches the agent when to use MDZ.
- MCP server registration for `mdz`.
- Enabled-by-default policy and visible mode controls.
- Usage ledger and reports.
- Session analysis for existing transcripts.
- Optional lifecycle hooks for prompt, tool output, compaction, and stop events.

## Adapter Modes

Adapters must preserve the same policy semantics:

- `enabled`: standard default; surface `ask` recommendations before applying reductions.
- `observe`: measure only and record reports.
- `suggest`: surface `ask` recommendations before applying reductions.
- `safe`: automatically apply low-risk deterministic reductions only.
- `balanced`: allow medium-risk reductions with user confirmation.
- `aggressive`: require explicit user confirmation.

## Hook Contract

Hook adapters should normalize platform-specific event JSON into:

```json
{
  "event": "UserPromptSubmit|PreInvocation|PostToolUse|Stop|...",
  "platform": "codex|claude|antigravity|generic",
  "prompt": "optional user prompt",
  "toolOutput": "optional tool output",
  "metadata": {}
}
```

Then they should call MDZ core to:

- estimate tokens,
- recommend observe/ask/apply/skip,
- store large originals behind handles,
- write `.mdz/hooks/*.latest.json`,
- append `.mdz/ledger.jsonl`.

Hooks must not silently rewrite user intent. If a platform supports blocking or
decision JSON, the adapter should use that only after the policy allows it.

## Degradation Path

```text
Plugin + hooks + MCP + skill  -> best UX, proactive advice
Skill + MCP                   -> agent-directed advice
MCP only                      -> explicit tool calls
CLI only                      -> offline reports and benchmarks
```

The same benchmark and doctor commands should work at every level.
