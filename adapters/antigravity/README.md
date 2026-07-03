# Antigravity Adapter

MDZ Token Advisor supports Antigravity through the same portable surfaces used
elsewhere:

- Agent Skill-compatible `SKILL.md` instructions.
- A reporting MCP server and a model-facing MCP gateway.
- Benchmark and session-analysis workflows.

The Antigravity adapter should reuse `mdz-core` and `mdz-mcp-server`.

## Install Plugin

Recommended project install:

```bash
npm run mdz -- install antigravity --scope project
```

This writes:

```text
.agents/plugins/mdz/plugin.json
.agents/plugins/mdz/mcp_config.json
.agents/plugins/mdz/hooks.json
.agents/plugins/mdz/rules/mdz-token-advisor.md
.agents/plugins/mdz/skills/mdz/SKILL.md
```

For all Antigravity workspaces:

```bash
npm run mdz -- install antigravity --scope user
```

This writes the same plugin under:

```text
C:\Users\<you>\.gemini\config\plugins\mdz-plugin
```

It also writes the `mdz` and `mdz_gateway` server entries to:

```text
C:\Users\<you>\.gemini\config\mcp_config.json
```

After installation, refresh Antigravity customizations and installed MCP
servers.

## Configure MCP Manually

Antigravity's official MCP docs expose a "Manage MCP Servers" flow with a raw
`mcp_config.json` editor. Prefer the generated configuration from
`npm run mdz -- install antigravity --scope project`; it contains both servers
and the gateway config environment variable.

If Antigravity cannot find `node`, replace `"node"` with the full Node path
used by your shell.

## Local Preflight

Before opening Antigravity, run:

```bash
npm run mdz -- install antigravity --scope project
npm run mdz -- doctor antigravity --format text --quick-benchmark
```

The doctor check verifies:

- Node.js version,
- MDZ CLI, MCP server, and gateway files,
- enabled-by-default policy,
- Antigravity skill file,
- generated MCP config and plugin files,
- MCP server startup and tool list,
- optional quick benchmark quality.

Do not switch from observe to suggest/safe until this passes.

## What The Plugin Does

- MCP exposes MDZ tools such as `advisor`, `usage_report`, `report_session`, and
  `compare_context`.
- The gateway exposes `mdz_search_tools`, `mdz_call_tool`, status, and context
  expansion while deferring upstream schemas.
- Skill instructions teach the agent when to call MDZ.
- Rules nudge Antigravity to check MDZ for large files, logs, session
  transcripts, and repeated tool output.
- Hooks observe prompt, tool-output, and stop events, then write advice under
  `.mdz/hooks` and usage history under `.mdz/ledger.jsonl`.

The hooks are intentionally conservative. They do not silently rewrite prompts
or tool output; in `suggest` mode they record and surface `ask` recommendations.
Use the gateway for automatic safe reductions. Advisory hook recommendations
remain potential savings.

## First Test Prompt

Use this in Antigravity after the skill and MCP server are configured:

```text
Use MDZ Token Advisor in enabled mode. First call the MDZ doctor tool for
Antigravity and report whether setup is ready. Do not modify files.
```

Then test the MCP tool path:

```text
Use MDZ Token Advisor to call show_policy, estimate_tokens on README.md, and
usage_report. Report the current mode, estimated README tokens, cumulative
savings, and downsides.
```

Benchmark test:

```text
Use MDZ Token Advisor to list benchmarks, then run the verbose-test-failure
benchmark in safe mode. Report token savings, downside estimates, and whether
quality markers passed.
```

Custom benchmark test:

```text
Use MDZ Token Advisor to run a custom benchmark against README.md as a session
artifact. Report savings, downsides, and quality risk.
```

Recommendation test:

```text
Use MDZ Token Advisor to recommend whether MDZ should be used for README.md.
Report use/ask/skip, estimated savings, and downsides.
```

Session report test:

```text
Use MDZ Token Advisor to run report_session on README.md as a session artifact
in observe mode. Report the suggested next mode and why.
```

Older session discovery test:

```text
Use MDZ Token Advisor to call find_sessions for Antigravity, then choose the
most recent transcript candidate and run report_session on it in observe mode.
Report estimated savings, downsides, and the recommended next MDZ mode.
```

Compare test:

```text
Use MDZ Token Advisor to compare this original text and reduced text with marker
"ERROR database timeout":
original: ERROR database timeout on login
reduced: ERROR database timeout on login
Report whether the comparison passed.
```
