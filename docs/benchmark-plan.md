# Benchmark Plan

## Goal

Measure whether MDZ reduces token usage in realistic workflows without breaking
task quality.

Because users may have constrained model budgets, the version 0.1 benchmark
suite includes several scenarios but only requires 2-3 to run during local
validation.

## Benchmark Modes

### Baseline

Run the workflow normally without MDZ intervention.

### MDZ Observe

Run the workflow normally while MDZ estimates where savings would have been
possible.

### MDZ Suggest

MDZ recommends optimizations, but does not apply them automatically.

### MDZ Safe

MDZ applies deterministic filters and handle replacement.

### MDZ Balanced

MDZ applies safe mode plus provenance-backed summaries.

## Core Metrics

- Estimated input tokens.
- Estimated output tokens.
- Estimated total tokens.
- Tokens saved.
- Percent saved.
- Mode used.
- Optimization opportunities found.
- Optimizations accepted/rejected.
- Handles created.
- Handles expanded.
- Handle expansion rate.
- Local processing time.
- Added latency.
- Disk usage.
- Local CPU usage where measurable.
- Quality result.
- Workflow breakage.

## Tradeoff Metrics

Every benchmark report must estimate the downside of the selected MDZ option,
not just the savings:

- Added local processing latency.
- Added wall-clock latency where measurable.
- Local CPU work estimate.
- Local memory pressure where measurable.
- Local disk/cache growth.
- Number of extra MDZ tool calls.
- Number of user approval prompts.
- Number of handle expansions.
- Quality risk level.
- Privacy/cache sensitivity level.

These values should be shown next to savings so users can decide whether a mode
is worth it:

```text
Safe mode:
  Estimated savings: 4,800 tokens (62%)
  Added latency: 14 ms local processing
  Local disk: +82 KB cache
  CPU: low
  Quality risk: low
  Workflow interruptions: 0
```

## Quality Metrics

Each scenario should define a task-specific success check:

- tests pass,
- expected answer found,
- correct file modified,
- root cause identified,
- no important diagnostic omitted,
- user-facing output remains acceptable.

## Version 0.1 Scenarios To Run First

### 1. Verbose Test Failure

Task: run tests and fix one failing function.

Stressor:

- verbose test output,
- repeated stack traces,
- many passing tests.

Expected MDZ savings:

- high.

Why it is version 0.1-worthy:

- deterministic filtering is easy to validate,
- task quality is measurable by tests.

### 2. Large Log Root Cause

Task: inspect a large application log and identify the root cause.

Stressor:

- repeated errors,
- timestamps,
- noise,
- stack traces.

Expected MDZ savings:

- high.

Why it is version 0.1-worthy:

- common real-world agent workflow,
- validates clustering and handle expansion.

### 3. Repo Exploration

Task: understand a small repo and modify one endpoint/function.

Stressor:

- broad file search,
- unnecessary file reads,
- repeated context.

Expected MDZ savings:

- medium.

Why it is version 0.1-worthy:

- closest to everyday Codex/Claude usage.

## Additional Scenarios To Develop

- MCP tool overload with simulated many-tool server.
- Large document or spreadsheet inspection.
- Long-running multi-turn session.
- Large dependency documentation lookup.
- Multi-agent/subagent summary handoff.
- Final response verbosity reduction.

## Custom User Benchmarks

Users should be able to provide:

- a session transcript,
- a command log,
- a directory of tool outputs,
- a workflow script,
- expected success criteria,
- a target token reduction.

MDZ should output:

- current token profile,
- recommended modes,
- expected savings,
- risks,
- suggested policy settings.

## Current Local Commands

List built-in scenarios:

```bash
npm run mdz -- benchmarks
```

Run the built-in suite:

```bash
npm run mdz -- benchmark suite --mode safe
```

Run one scenario:

```bash
npm run mdz -- benchmark verbose-test-failure --mode safe
npm run mdz -- benchmark large-log-root-cause --mode safe
npm run mdz -- benchmark repo-exploration --mode observe
```

Run a custom file:

```bash
npm run mdz -- benchmark custom --file path/to/session.txt --type session
npm run mdz -- benchmark custom --file path/to/test-output.txt --type test-output --marker "AssertionError"
npm run mdz -- benchmark custom --file path/to/app.log --type log-output --marker "database timeout"
```

Write a report to disk:

```bash
npm run mdz -- benchmark suite --mode safe --out .mdz/reports/suite-safe.json
```

The current runner is deterministic and does not call external models. It
estimates savings by comparing baseline artifact size against MDZ filtered or
handle-backed context, then reports local processing tradeoffs.

Codex JSONL session files are parsed by event type before reduction. This gives
more realistic estimates for long Codex sessions because MDZ can identify tool
outputs, repeated stable instructions, environment context, and verbose
assistant messages separately.
