# Roadmap

## Version 0.1: Public Alpha

Status: implemented and release-gated as an experimental public alpha.

Shipped:

- portable `mdz-core`,
- stdio `mdz-mcp-server`,
- stdio `mdz-mcp-gateway` with real filesystem-MCP validation,
- Codex skill, MCP config, and hooks,
- Antigravity skill, MCP config, plugin, rules, and hooks,
- Claude Code skill, MCP config, plugin, and hooks,
- generic MCP config,
- enabled, observe, suggest, safe, balanced, and aggressive policies,
- deterministic test-output and log filtering,
- reversible local handles,
- context profiling,
- evidence extraction,
- compression planning,
- sufficiency checks,
- session discovery,
- benchmark suite and custom benchmark support,
- usage ledger,
- session, usage, comparison, and benchmark reports,
- Markdown, JSON, and HTML report output,
- cache inspection and pruning,
- configurable token cost estimates,
- policy autopilot for target savings,
- response profile recommendations,
- output contracts and answer-length contracts,
- output budget recommendations,
- final response auditing and deterministic compression,
- verbosity feedback learning signals,
- tool schema overhead analysis,
- turn-by-turn session replay,
- local dashboard output,
- local feedback learning profile,
- task type classification,
- context budget planner,
- task contract generation,
- semantic cache,
- repo memory map,
- tool-call guardrails,
- compaction state artifacts,
- cross-agent handoff artifacts,
- diff-aware context analysis,
- secret scanning and redaction,
- project policy files,
- savings attribution,
- privacy-safe top savings examples,
- compatibility-checked tool-schema compaction,
- deterministic core/deferred tool planning and catalog search,
- prompt-prefix snapshots and cache-stability diagnostics,
- quality regression harness,
- compression experiment harness,
- setup wizard,
- cross-project install and reversible uninstall,
- GitHub Actions CI.

Validation criteria:

- `npm test` passes,
- `doctor <platform> --quick-benchmark` passes,
- each adapter can connect to the MCP server,
- users can start in observe mode,
- users can move to suggest mode after seeing a report,
- skipped optimizations report zero applied savings,
- reports include downsides as well as savings.

## Version 0.2 Candidates

- remote HTTP MCP gateway transport,
- provider usage import for confirmed cached, input, and output tokens,
- cache cold-start notifications based on platform lifecycle events,
- clearer platform-native popups where hooks support them,
- more benchmark fixtures from real sessions,
- package release automation beyond CI,
- deeper report redaction presets,
- platform-specific UI controls for applying MDZ once or changing modes.

## Design Principles

- Do not require users to change how they ask agents for work.
- Preserve intent and evidence before reducing context.
- Prefer deterministic reductions before summaries.
- Keep original content locally expandable through handles.
- Report latency, CPU, disk/cache, privacy, prompt, and quality tradeoffs with
  every savings estimate.
