# MDZ Token Advisor (Modum Delta Zero)

> **Public alpha (`0.1.0`)**: MDZ is experimental. When MCP calls are routed
> through the MDZ gateway, MDZ can apply real payload reductions before content
> reaches the agent. Token and cost savings are still estimated locally unless
> confirmed by provider usage data. Stored originals may contain sensitive local
> data.

MDZ stands for **Modum Delta Zero**. It is a local token governance and context
efficiency layer for agentic coding platforms such as Codex, Antigravity,
Claude Code, and any MCP client that can run a local stdio server.

MDZ can reduce avoidable input and output tokens without asking users to change
how they prompt agents. It observes prompts, tool output, logs, and session
transcripts; estimates savings; keeps high-value evidence; stores bulky
original content locally behind `mdz://context/<id>` handles; recommends
concise output contracts; and reports tradeoffs. Automatic savings require an
enforcement boundary: the MDZ MCP gateway.

## Plain-English Quick Start

MDZ helps your AI coding agent waste fewer tokens. It watches for bulky tool
output, repeated session history, huge logs, screenshots, and long transcripts.
When it sees something worth reducing, it keeps the original locally and gives
the agent a smaller version plus a way to expand the original if needed.

For most users:

1. Install Node.js 22 or newer.
2. Download or clone this repo.
3. Run `npm ci`.
4. Install MDZ into the project where you use your agent:

```bash
npm run mdz -- install codex --scope project --target "C:/path/to/your/project"
```

Use `antigravity`, `claude`, or `generic` instead of `codex` for another
agent platform.

After restarting your agent, ask it:

```text
Use MDZ Token Advisor. Check doctor, show_policy, latest_advice, and usage_report.
Tell me whether MDZ is working and what it has saved or could save.
```

MDZ starts in `enabled` mode. That means it recommends savings and asks before
applying reductions. It does not silently rewrite what you asked.

## Privacy And Safety

MDZ runs locally and does not send telemetry to an MDZ cloud service. When MDZ
stores bulky originals behind `mdz://context/...` handles, those originals stay
on your machine under `.mdz/store`. Treat `.mdz/` like sensitive local data if
your prompts, logs, or transcripts contain secrets.

Do not commit `.mdz/`, generated MCP configs, or local hook configs. The
included `.gitignore` excludes those files.

## What MDZ Does

- Measures likely token usage before and after reductions.
- Finds repeated, verbose, or low-signal context.
- Trims low-signal prompt phrasing while preserving constraints, file paths,
  code/config spans, quoted text, and negations.
- Preserves task intent, failures, file paths, commands, decisions, and other
  evidence needed for the next agent step.
- Filters noisy test output and logs deterministically.
- Proxies upstream MCP tools through a four-tool gateway and reduces eligible
  results before they reach the model.
- Compacts tool schemas while verifying that validation contracts are unchanged.
- Plans a small core toolset and deferred catalog, then searches deferred tools
  locally without model calls.
- Diagnoses prompt-prefix stability and probable cache cold starts without
  claiming provider-confirmed cache usage.
- Creates reversible handles for large originals stored locally.
- Produces session, usage, benchmark, comparison, and sufficiency reports.
- Starts in enabled mode so users see recommendations immediately; observe
  mode remains available for measurement-only audits.

## What MDZ Does Not Do

- It does not bypass provider billing with magic compression.
- It does not make all agent tasks cheaper.
- It does not silently rewrite user intent.
- It does not guarantee provider-bill savings; MDZ reports local estimates.
- It does not automatically shorten every final assistant answer. Output
  contracts and response compression require agent/client cooperation.
- It cannot reduce calls that bypass the gateway.
- It does not remove privacy risk if sensitive originals are stored locally.

Models are billed on the tokens they receive after the client/provider boundary.
MDZ saves tokens by deciding what should be sent, summarized, stored locally,
expanded only when needed, or answered more concisely.

## Platform Capability Matrix

| Capability | Codex | Antigravity | Claude Code | Generic MCP |
| --- | --- | --- | --- | --- |
| Observe, benchmark, reports | Yes | Yes | Yes | Yes |
| Gateway-proxied MCP result reduction | Yes | Yes | Yes | Yes |
| Native hook result replacement | Advisory only | Advisory only | Advisory only | Client-dependent |
| Reversible local handles | Yes | Yes | Yes | Yes |
| Automatic final-answer shortening | No guarantee | No guarantee | No guarantee | No guarantee |

The gateway is the universal automatic-reduction path. Native hooks add
visibility but remain advisory because block-style replacement can make a
successful tool appear to fail. Reports count gateway delivery as applied;
advisory hook actions remain potential savings.

## Install

Requirements:

- Node.js 22 or newer.
- A local checkout of this repository.

```bash
npm ci
npm test
```

Install into another project from this checkout with `--target`:

```bash
npm run mdz -- install codex --scope project --target "C:/path/to/project"
```

### Codex

Project install:

```bash
npm run mdz -- install codex --scope project
```

User install:

```bash
npm run mdz -- install codex --scope user
```

Restart Codex or open a new session, then trust the MDZ hooks when prompted.
Codex hooks observe eligible `PostToolUse` results. The gateway applies
automatic upstream MCP reductions consistently across platforms.

### Antigravity

Project install:

```bash
npm run mdz -- install antigravity --scope project
```

User install for all Antigravity workspaces:

```bash
npm run mdz -- install antigravity --scope user
```

The user install writes the plugin to:

```text
C:\Users\<you>\.gemini\config\plugins\mdz-plugin
```

It also writes or updates:

```text
C:\Users\<you>\.gemini\config\mcp_config.json
```

Restart or refresh Antigravity, then confirm the `mdz` MCP server is enabled.

### Claude Code

Project install:

```bash
npm run mdz -- install claude --scope project
```

User install:

```bash
npm run mdz -- install claude --scope user
```

Restart Claude Code or run `/reload-plugins`.

### Upgrade And Uninstall

Upgrade the checkout, dependencies, and generated platform files:

```bash
git pull --ff-only
npm ci
npm run mdz -- install codex --scope project --target "C:/path/to/project"
```

Uninstall MDZ while preserving `.mdz` reports, policy, ledger, gateway config,
and stored originals:

```bash
npm run mdz -- uninstall codex --scope project --target "C:/path/to/project"
```

Add `--purge-data` only when local MDZ history and stored context should also
be deleted. Installation merges MDZ-owned Codex config and hook entries; it
does not overwrite unrelated settings.

### Generic MCP Clients

```bash
npm run mdz -- install generic
```

Then add `adapters/generic/mcp_config.generated.json` to your MCP-capable
client.

### Route Existing MCP Servers Through MDZ

Installation adds `mdz_gateway`, but it does not silently move existing MCP
servers. Create a gateway catalog from a JSON MCP config:

```bash
npm run mdz -- gateway init --from path/to/mcp_config.json
npm run mdz -- gateway status
```

Then disable those direct upstream entries in the host so calls use
`mdz_search_tools` and `mdz_call_tool`. To have MDZ back up and rewrite a JSON
host config explicitly:

```bash
npm run mdz -- gateway init --from path/to/mcp_config.json --rewrite-host
```

## First Test

Run a local preflight:

```bash
npm run mdz -- doctor antigravity --format text --quick-benchmark
```

For Codex, Claude, or a generic MCP client, replace `antigravity` with
`codex`, `claude`, or `generic`.

In the agent, ask:

```text
Use MDZ Token Advisor in enabled mode. Call doctor, show_policy, latest_advice,
and usage_report. Report whether MDZ is ready, what mode it is in, and whether
there are any savings or downsides recorded.
```

## Modes

- `enabled`: standard default; recommend savings and ask before applying.
- `observe`: measure only; no prompt or tool output changes.
- `suggest`: recommend savings and ask before applying.
- `safe`: automatically apply low-risk deterministic reductions when savings
  justify wrapper overhead and the model-facing boundary supports replacement.
- `balanced`: allow medium-risk reductions with provenance and confirmation.
- `aggressive`: surface high-savings ideas that require explicit confirmation.

Start with enabled. Use observe only for audits. Move to safe only after
low-risk suggestions are repeatedly useful.

```bash
npm run mdz -- policy show
npm run mdz -- policy set --mode enabled
npm run mdz -- policy set --mode safe
```

## Visibility

MDZ is intentionally visible at first. Users should see what it would save,
what it actually saved, and what the downside was.

Visibility levels:

- `visible`: show recommendations and latest advice often. Best for first use.
- `digest`: keep working quietly, but show periodic savings digests.
- `quiet`: only report when asked or when risk requires attention.

Recommended trust path:

```bash
npm run mdz -- policy set --mode enabled --visibility-level visible
npm run mdz -- digest --format text
npm run mdz -- policy set --mode safe --visibility-level digest
```

Use `digest` any time to see what MDZ has saved or observed:

```bash
npm run mdz -- digest --format text --write-reports
```

## Common Commands

```bash
npm run mdz -- latest-advice
npm run mdz -- gateway status
npm run mdz -- digest --format text --write-reports
npm run mdz -- usage-report --format text --write-reports
npm run mdz -- find-sessions --platform all --format text
npm run mdz -- scan-session path/to/session.jsonl --format text
npm run mdz -- report-session path/to/session.jsonl --format text --write-reports
npm run mdz -- replay-session path/to/session.jsonl --format text
npm run mdz -- dashboard --write-reports
npm run mdz -- autopilot --target-reduction 0.3
npm run mdz -- cache inspect --format text
npm run mdz -- cost estimate --input-tokens 100000 --saved-input-tokens 30000
npm run mdz -- response-profile recommend --output-tokens 1200 --target-reduction 0.3
npm run mdz -- output-contract --text "fix failing auth test"
npm run mdz -- output-budget --text "review this pull request"
npm run mdz -- audit-response path/to/final-answer.txt --max-tokens 600
npm run mdz -- compress-response path/to/final-answer.txt --out .mdz/reports/final-short.txt
npm run mdz -- tool-schema path/to/tools.json
npm run mdz -- compact-tool-schema path/to/tools.json --out .mdz/reports/tools.compact.json
npm run mdz -- tool-deferral path/to/tools.json --max-core-tools 8
npm run mdz -- tool-search path/to/tools.json --query "find symbol references"
npm run mdz -- prefix-snapshot path/to/prefix-components.json --out .mdz/reports/prefix.json
npm run mdz -- cache-stability path/to/current-prefix.json --previous path/to/previous-prefix.json
npm run mdz -- feedback task-success --mode suggest --savings-percent 0.25
npm run mdz -- learning-report --format text
npm run mdz -- classify-task path/to/session.txt
npm run mdz -- budget path/to/session.txt
npm run mdz -- trim-prompt --text "Could you please help me fix the failing auth tests?"
npm run mdz -- contract path/to/prompt.txt --out .mdz/reports/task-contract.md
npm run mdz -- secret-scan path/to/context.txt
npm run mdz -- redact path/to/context.txt --out .mdz/reports/redacted.txt
npm run mdz -- semantic-cache put path/to/file.txt --summary "Reusable summary"
npm run mdz -- repo-map --out .mdz/reports/repo-map.json
npm run mdz -- tool-guardrails --text "inspect repo and read entire files"
npm run mdz -- compact-state path/to/session.txt --out .mdz/reports/compact-state.md
npm run mdz -- handoff path/to/session.txt --target antigravity --out .mdz/reports/handoff.md
npm run mdz -- diff-context path/to/diff.patch
npm run mdz -- quality-check original.txt reduced.txt --marker "ERROR database timeout"
npm run mdz -- compression-experiment path/to/session.txt
npm run mdz -- project-policy init --mode enabled
npm run mdz -- setup --platform antigravity
npm run mdz -- benchmark suite --mode suggest
npm run mdz -- benchmark custom --file path/to/session.txt --type session
npm run mdz -- compare path/to/original.txt path/to/reduced.txt --marker "important error"
npm run mdz -- profile path/to/session.txt
npm run mdz -- evidence path/to/session.txt
npm run mdz -- plan path/to/session.txt --mode suggest
npm run mdz -- sufficiency path/to/original.txt path/to/reduced.txt
```

`--write-reports` writes JSON, Markdown, and HTML files under `.mdz/reports`.

## MCP Tools

The local MCP server exposes:

- `doctor`
- `show_policy`
- `set_policy`
- `latest_advice`
- `savings_digest`
- `estimate_tokens`
- `advisor`
- `recommend_mdz`
- `filter_output`
- `store_context`
- `expand_context`
- `analyze_session`
- `scan_session`
- `find_sessions`
- `manage_cache`
- `estimate_cost`
- `policy_autopilot`
- `response_profile`
- `output_contract`
- `answer_contract`
- `output_budget`
- `audit_response`
- `compress_response`
- `analyze_tool_schema`
- `compact_tool_schemas`
- `plan_tool_deferral`
- `search_tool_catalog`
- `create_prefix_snapshot`
- `analyze_cache_stability`
- `replay_session`
- `dashboard`
- `record_feedback`
- `learning_report`
- `classify_task`
- `plan_budget`
- `trim_prompt`
- `create_task_contract`
- `scan_secrets`
- `redact_text`
- `semantic_cache`
- `repo_memory_map`
- `tool_guardrails`
- `compact_state`
- `create_handoff`
- `diff_context`
- `quality_check`
- `attribute_savings`
- `compression_experiment`
- `project_policy`
- `setup_wizard`
- `report_session`
- `usage_report`
- `compare_context`
- `profile_context`
- `extract_evidence`
- `plan_compression`
- `check_sufficiency`
- `list_benchmarks`
- `run_benchmark`
- `apply_once`
- `install_mdz`
- `report_usage`

## Reports And Downsides

MDZ reports savings together with costs and risks:

- estimated original tokens,
- estimated reduced tokens,
- estimated tokens saved,
- input/context savings from prompts, tool output, sessions, logs, and handles,
- assistant-output savings from final response auditing and compression,
- percent saved,
- added local latency,
- local CPU work,
- local disk/cache growth,
- extra MDZ tool calls,
- approval prompts,
- handle expansions,
- quality risk,
- privacy/cache impact.

Original content may be stored locally in `.mdz/store`. Treat that directory as
sensitive if your prompts, logs, or transcripts contain sensitive data.

`audit-response` records potential assistant-output savings. `compress-response`
records applied assistant-output savings when it produces the shortened answer.
The usage report keeps those separate from input/context savings so users can
see where reductions came from.

Usage reports also include up to five privacy-safe examples of how tokens were
saved. Examples show the technique, before/after sizes, actual versus potential
savings, and risk without copying raw prompts or logs into shareable reports.

Tool-deferral reports estimate savings from keeping full schemas out of the
upfront context. Those estimates become actual savings only when the host uses
an MDZ gateway or a native dynamic-tool-loading mechanism.

## Benchmarks

The built-in benchmark suite runs locally without model calls:

```bash
npm run mdz -- benchmarks
npm run mdz -- benchmark suite --mode suggest
```

Included scenarios:

- verbose test failure,
- large log root-cause analysis,
- repository exploration session.

Users can add their own workflow artifacts:

```bash
npm run mdz -- benchmark custom --file path/to/transcript.txt --type session
```

## Repository Layout

```text
packages/mdz-core/        Core token estimation, policy, reports, handles, benchmarks
packages/mdz-mcp-server/  stdio MCP server
adapters/codex/           Codex skill, hooks, and config
adapters/antigravity/     Antigravity skill, hooks, plugin template, config
adapters/claude/          Claude Code skill, hooks, plugin template
adapters/generic/         Generic MCP setup
benchmarks/               Local benchmark scenarios and fixtures
docs/                     Design, risk, benchmark, and adapter notes
plugins/mdz/              Portable plugin package scaffold
```

## Current Version

This is the first public-alpha MDZ version. The core engine, MCP server,
MCP gateway,
Codex adapter, Antigravity adapter, Claude adapter, generic MCP adapter,
benchmarks, reports, session discovery, sufficiency checks, policy autopilot,
cache management, cost estimates, response profiles, tool schema analysis,
turn-by-turn session replay, local dashboard output, feedback learning, task
classification, context budgets, task contracts, semantic cache, repo memory
maps, tool-call guardrails, compaction artifacts, cross-agent handoff artifacts,
diff-aware context, secret scanning/redaction, project policies, savings
attribution, quality harnesses, compression experiments, setup wizard, output
contracts, output budgets, final-response auditing, deterministic response
compression, verbosity feedback, privacy-safe top savings examples, savings
attribution, compatibility-checked tool-schema compaction, deterministic tool
deferral/search planning, prompt-prefix snapshots, cache-stability diagnostics,
and CI are implemented and covered by automated tests.

Known limitations:

- savings are estimates, not provider billing records;
- native hooks are advisory because block-style replacement can make successful
  tools appear to fail;
- only MCP calls routed through `mdz_gateway` receive automatic reduction;
- the gateway currently supports stdio upstream servers, not remote HTTP MCP;
- final-answer compression remains agent-directed;
- cache-stability results are estimates unless provider usage confirms them;
- semantic compression is intentionally conservative;
- sensitive originals remain on local disk when handles are enabled.
