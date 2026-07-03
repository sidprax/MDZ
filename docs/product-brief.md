# Product Brief

## Name

MDZ: Modum Delta Zero

## Mission

Reduce the token cost of agentic workflows without changing user behavior.

Users should continue asking agents for work naturally. MDZ should observe,
recommend, and eventually apply context optimizations in the background once
the user trusts its behavior.

## Primary Users

- Individual developers paying for AI usage directly.
- Power users running long agentic coding sessions.
- Teams evaluating agent adoption but constrained by cost, latency, or context
  limits.
- Platform/plugin authors who need a reusable token governance layer.

## Core Promise

MDZ lowers token usage while preserving workflow quality by replacing expensive
context with compact, reversible representations:

- handles to original content
- deterministic filters
- extractive summaries
- risk-labeled semantic summaries
- response profiles
- local usage and savings reports

## Non-Goals For Version 0.1

- Replacing provider billing dashboards.
- Sending private telemetry to a cloud service.
- Requiring users to write prompts differently.
- Depending on a single vendor-specific API.
- Claiming lossless token compression where no decompression boundary exists.

## Success Criteria

- Users can run the same workflow with and without MDZ.
- MDZ reports estimated baseline usage, optimized usage, savings, and tradeoffs.
- MDZ can operate in enabled/observe/suggest mode before automatic application.
- At least 2-3 realistic benchmark scenarios show measurable savings without
  breaking task completion.
- Users can point MDZ at an existing session transcript/log and receive an
  optimization report.

## User Trust Model

MDZ should start conservative:

1. Observe usage.
2. Suggest optimizations and estimate savings.
3. Apply safe deterministic reductions with approval.
4. Allow automatic policy-based optimization after repeated successful use.

Every optimization should be auditable. Users should be able to see what MDZ
changed, what it stored, what it summarized, what it expanded, and what it
saved.

## User-Visible Downsides

MDZ must expose tradeoffs clearly:

- Latency: filtering, indexing, summarization, and token estimation add local
  processing time.
- CPU use: deterministic filtering is cheap, but embeddings and local
  summarization may use more resources.
- Disk usage: full artifacts, handles, metrics, and benchmark outputs require
  local storage.
- Quality risk: summaries can omit details; aggressive modes can harm agent
  performance.
- Complexity: hooks and MCP servers add moving parts that may need setup,
  updates, and troubleshooting.
- Privacy surface: local storage improves privacy versus cloud telemetry, but
  sensitive data still exists in MDZ's cache and must be managed safely.
