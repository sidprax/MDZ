# Codex Hooks

Codex hook adapters for MDZ Token Advisor.

Target hook points:

- `UserPromptSubmit`: estimate prompt size and suggest/prepare compact task
  contracts.
- `PreToolUse`: detect commands likely to produce huge output and suggest
  filtered execution.
- `PostToolUse`: estimate deterministic filtering opportunities without
  changing tool status or output.
- `PreCompact` / `PostCompact`: preserve MDZ handles and decision ledgers.
- `Stop`: produce local usage and savings reports.

Hooks should start in observe mode. Automatic modification should require user
policy opt-in.

Current prototype scripts:

- `user-prompt-submit.mjs`: runs MDZ Token Advisor on submitted prompts and writes
  `.mdz/hooks/user-prompt-submit.latest.json` with an advisor action.
- `post-tool-use.mjs`: runs MDZ Output Review on tool output and writes
  `.mdz/hooks/post-tool-use.latest.json` with an advisor action.
- `hooks.example.json`: example Codex hook configuration.

Codex hooks do not mutate tool output. Block-style replacement can make a
successful tool appear to fail, and Codex does not expose every internal tool
path through `PostToolUse`. Use the MDZ MCP gateway for portable, enforceable
upstream MCP reductions.
