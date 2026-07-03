# Platform Adapter Matrix

## Strategy

Build MDZ around a portable core and MCP server. Add platform-specific adapters
only where they improve workflow invisibility or installation.

## Codex

Current support:

- Agent Skill.
- MCP server.
- MCP gateway for automatic upstream reductions.
- Plugin packaging.
- Hooks for prompt/tool-output observation.
- Local reports.

Advantages:

- Skills, plugins, MCP, and hooks can be packaged together.
- Good first platform for proving the full stack.

Risks:

- Hook behavior is platform-specific.
- Plugin packaging may evolve.

## Claude Code

Current support:

- Agent Skill.
- MCP server.
- MCP gateway for automatic upstream reductions.
- Project plugin generation under `.claude/plugins/mdz`.
- Hooks for prompt/tool-output/stop observation.
- Local reports.

Advantages:

- Strong context-management pain point.
- Users are already familiar with usage/cost reporting.

Risks:

- Exact hook and plugin packaging differs from Codex.
- Some behavior may require user config.

## Google Antigravity

Current support:

- Agent Skill.
- MCP server config generation.
- MCP gateway config generation.
- Project plugin generation under `.agents/plugins/mdz`.
- Hooks/rules for prompt/tool-output/stop observation.
- Installation docs and test prompts.

Advantages:

- Skills are a natural portability path.

Risks:

- Hook/plugin capabilities may differ.
- Need platform-specific validation.

## Generic MCP Clients

Current support:

- MCP server.
- MCP gateway.
- Generated MCP config.
- Manual prompt instructions.
- Session analysis CLI.

Advantages:

- Most portable.
- Least coupled to platform changes.

Risks:

- Harder to provide no-workflow-change behavior without hooks.

## Adapter Principle

MDZ features should degrade gracefully:

```text
Gateway available   -> automatic routed-MCP reduction
Hooks available     -> advisory observation
Skill + MCP only    -> agent-directed optimization
MCP only            -> manual or explicit tool use
CLI only            -> offline reports and benchmarks
```
