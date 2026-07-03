# Existing Session Analysis

## Goal

Allow users to point MDZ at an existing agent session and estimate how much
token usage could have been reduced.

This is important because users may not have enough budget to repeatedly run
large live benchmarks. Session analysis gives them a lower-cost way to evaluate
MDZ against their real workflows.

## Inputs

Supported inputs should eventually include:

- Codex session logs or exported transcripts,
- Claude Code transcripts,
- Antigravity session artifacts,
- generic JSONL chat transcripts,
- terminal logs,
- tool call traces,
- manually pasted conversations,
- benchmark result folders.

## Outputs

MDZ should generate a local report:

- estimated total input tokens,
- estimated total output tokens,
- largest token contributors,
- repeated context,
- verbose tool outputs,
- prompt sections that could be extracted into skills,
- MCP/tool schema overhead where visible,
- suggested MDZ mode per turn,
- estimated savings per optimization,
- expected savings total,
- risk level per optimization,
- recommended next action.

## Analysis Types

### Retrospective Estimate

Analyze a completed session and estimate what MDZ could have saved.

### Replay Simulation

Replay a transcript through MDZ policies without calling an external model.

### Live Shadow Mode

Observe a current session and estimate reductions without modifying context.

### Policy Recommendation

Given a user's target reduction, recommend a policy:

```text
Target: 40% total token reduction
Recommended:
  - Safe filtering for tool outputs
  - Balanced summaries for logs over 8,000 tokens
  - Terse final response profile
  - Prompt compaction suggestions only
Expected:
  - 35-48% savings
  - low-medium quality risk
```

## Current Recommendation Command

MDZ Token Advisor can now recommend whether to use MDZ for an existing session:

```bash
npm run mdz -- recommend path/to/session.jsonl
```

For a user-friendly advisor report:

```bash
npm run mdz -- advisor path/to/session.jsonl --mode suggest --format text
npm run mdz -- advisor path/to/session.jsonl --mode suggest --write-reports
npm run mdz -- scan-session path/to/large-transcript.jsonl --format text
```

The advisor report returns:

- action: `observe`, `ask`, `apply`, or `skip`,
- recommendation: `use`, `ask`, or `skip`,
- expected savings,
- downsides,
- top reasons,
- suggested choices such as `Apply once`, `Always for this repo`, or `Skip`.

The recommendation is one of:

- `use`: expected savings are high enough and risk is acceptable.
- `ask`: savings may be worthwhile, but user confirmation is appropriate.
- `skip`: expected savings do not justify MDZ overhead.

For Codex JSONL sessions, MDZ parses events by kind:

- base instructions,
- environment context,
- user prompts,
- assistant messages,
- tool calls,
- tool outputs,
- reasoning,
- token-count events.

This allows MDZ to recommend targeted optimizations instead of treating the
whole session as one text blob.

## Privacy

Session analysis should be local by default. Reports may contain sensitive file
paths, prompts, command output, and code snippets. Cloud upload should not exist
in version 0.1.
