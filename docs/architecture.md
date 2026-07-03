# Architecture

## High-Level Flow

```text
User asks normally
        |
Agent/platform receives request
        |
MDZ hooks observe prompts and native tool output
        |
Upstream MCP calls optionally route through mdz_gateway
        |
MDZ applies policy:
  enabled | observe | suggest | safe | balanced | aggressive
        |
Large or low-signal content becomes:
  summary + metadata + local handle
        |
Agent expands only what it needs
        |
MDZ records usage, savings, expansions, and risks
```

## Components

### mdz-core

Shared library used by all adapters.

Responsibilities:

- Token estimation.
- Local object store.
- Handle creation and expansion.
- Deterministic filters.
- Summary generation interfaces.
- Metrics collection.
- Benchmark execution primitives.
- Risk labeling.
- Context profiling.
- Evidence extraction.
- Compression planning.
- Sufficiency checking.
- Explainable savings examples and mechanism attribution.
- Tool-schema compaction with compatibility validation.
- Deterministic tool deferral and catalog search planning.
- Prompt-prefix fingerprinting and cache-stability diagnostics.

### mdz-mcp-server

Portable runtime exposed to agentic platforms.

Implemented tools include:

- `estimate_tokens`: estimate tokens for text, files, command output, or stored
  handles.
- `store_context`: store large content locally and return an MDZ handle.
- `expand_context`: retrieve original content or selected slices from a handle.
- `filter_output`: reduce logs, test output, traces, and command output.
- `analyze_session`: estimate optimization opportunities from an existing
  session transcript or log.
- `run_benchmark`: run baseline and MDZ versions of benchmark scenarios where
  supported.
- `report_usage`: generate local reports of savings, risk, and mode usage.
- `show_policy` and `set_policy`: inspect or change enabled/observe/suggest/safe modes.
- `apply_once`: apply a deterministic reduction and record it in the ledger.
- `report_session`: create a readable session savings report.
- `usage_report`: summarize recorded MDZ events from the usage ledger.
- `compare_context`: compare original and reduced context for possible loss.
- `install_mdz`: install Codex setup or generate Antigravity setup files.
- `doctor`: validate local adapter readiness.
- `profile_context`: classify context and token contributors.
- `extract_evidence`: identify spans that must survive compression.
- `plan_compression`: choose keep/trim/collapse/handle/summarize actions.
- `check_sufficiency`: decide whether reduced context is enough to proceed.
- `compact_tool_schemas`: remove documentation-only overhead while preserving
  tool validation contracts.
- `plan_tool_deferral`: choose core and deferred tools and estimate upfront
  schema savings.
- `search_tool_catalog`: find deferred tools locally and return only matching
  schemas.
- `create_prefix_snapshot` and `analyze_cache_stability`: diagnose probable
  prompt-prefix reuse and cold starts without claiming provider confirmation.

### mdz-mcp-gateway

The gateway is MDZ's automatic model-facing reduction boundary. It:

- connects to configured upstream stdio MCP servers,
- exposes four stable search, call, status, and expansion tools,
- defers upstream schemas until searched,
- filters eligible text and exactly mirrored structured text,
- stores originals behind local handles,
- records applied savings only when the compact response is returned.

Independent structured content is preserved unchanged. One failed upstream is
reported in gateway status without preventing healthy upstreams from loading.

Planned tools:

- `summarize_context`: generate compact summaries with provenance metadata.

### Agent Skill

The skill teaches the agent:

- when to invoke MDZ,
- how to prefer handles over bulk context,
- when to expand original content,
- how to communicate risk to users,
- how to keep normal workflows intact.

### Plugin

The plugin packages:

- skill instructions,
- MCP server configuration,
- optional hooks,
- icon/metadata,
- installation docs.

MDZ currently generates platform packages for Codex, Claude Code, Antigravity,
and generic MCP clients from the same core.

### Hooks

Hooks are platform-specific. Where available, MDZ should use them to intercept:

- user prompt submission,
- pre-tool execution,
- post-tool output,
- compaction,
- final response generation.

Hooks are advisory. Automatic reduction uses the gateway because native
block-style hook replacement can make a successful tool appear to fail.

## Policy Modes

### Observe

No changes. MDZ only estimates and records usage.

### Suggest

MDZ recommends optimizations and estimated savings, but asks before applying.

### Safe

MDZ applies deterministic reductions only, such as trimming duplicate logs,
collapsing passing tests, and replacing large outputs with handles.

### Balanced

MDZ adds extractive or low-risk summaries with provenance and original handles.

### Aggressive

MDZ applies semantic summaries, terse response profiles, and stricter expansion
budgets. This mode has the highest quality risk and should require explicit
user opt-in.

## Why Not Raw Compression Alone?

Raw compression reduces bytes, not necessarily model tokens. If compressed text
is placed directly into model context, the model sees opaque encoded text and
the provider still tokenizes it. This usually harms quality and can increase
token count.

MDZ should still explore compression at valid boundaries:

- local storage compression,
- network compression where a proxy is involved,
- provider-supported file/artifact compression,
- UI-layer output compression,
- handle-based lossless references.

The universal approach is handle-based compression: MDZ stores the original
content locally and sends compact references into context. The original remains
available on demand.
