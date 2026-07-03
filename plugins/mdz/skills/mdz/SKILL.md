---
name: mdz
description: MDZ Token Advisor checks prompts, tool output, and sessions for token savings, then recommends apply, ask, or skip with downsides. Use when the user asks to optimize tokens, reduce costs, benchmark savings, analyze session usage, or run MDZ.
---

# MDZ Token Advisor

Use MDZ Token Advisor to reduce token usage without changing the user's workflow.

## Default Behavior

Start in enabled mode unless the user explicitly requests observe, suggest,
safe, balanced, or aggressive mode. Enabled mode recommends savings and asks
before applying; observe mode is for measurement-only audits.

Start with visible recommendations. After the user trusts MDZ, suggest digest
visibility so MDZ periodically reports savings and downsides without
interrupting every turn.

Do not rewrite user intent silently. If a user prompt is long, create a compact
task contract only when the original prompt is stored behind an MDZ handle and
the user approves or policy allows it.

## Core Workflow

1. Estimate token usage for large prompts, files, command outputs, tool results,
   or session transcripts.
2. Profile context into intent, evidence, tool output, errors, decisions, and
   repeated/noisy blocks.
3. Extract evidence that must survive reduction.
4. Create a policy-aware compression plan.
5. Store bulky original content behind MDZ handles.
6. Return compact artifacts with provenance, evidence, risk labels, and
   expansion instructions.
7. Check sufficiency before relying on reduced context.
8. Report estimated savings and visible tradeoffs.

## Benchmark Workflow

When the user asks to benchmark MDZ, use:

- `list_benchmarks` to discover scenarios,
- `run_benchmark` to run one scenario or the suite,
- report savings and downsides together,
- call out quality markers and possible workflow breakage.

## Recommendation Workflow

When deciding whether to use MDZ, prefer the `recommend_mdz` MCP tool when
available. Otherwise run `npm run mdz -- recommend <session-file>`.

Use `show_policy` or `npm run mdz -- policy show` to explain the current mode.
Use `set_policy` or `npm run mdz -- policy set --mode suggest` only when the
user wants MDZ to move beyond observe mode.
Use `usage_report` and `savings_digest` to summarize accumulated savings,
distinguishing input/context savings from assistant-output savings.
`find_sessions` to locate
existing sessions, `report_session` to review a selected session,
`replay_session` for turn-by-turn savings, `dashboard` for a local product
view, `manage_cache` for cache size/retention, `estimate_cost` for dollar
estimates, `policy_autopilot` for target savings, `response_profile` for
output-token reduction, `output_contract`, `answer_contract`, `output_budget`,
`audit_response`, and `compress_response` for final-answer token savings,
`analyze_tool_schema` and `compact_tool_schemas` for tool overhead,
`plan_tool_deferral` and `search_tool_catalog` for deferred tools,
`create_prefix_snapshot` and `analyze_cache_stability` for probable cache reuse,
`record_feedback` and `learning_report` for local learning, `classify_task` and
`plan_budget` for task-aware budgets, `create_task_contract` for compact
prompts, `scan_secrets` and `redact_text` before storing sensitive context,
`semantic_cache` and `repo_memory_map` to avoid repeated exploration,
`tool_guardrails` before expensive tools, `compact_state` before compaction,
`create_handoff` for cross-agent transfer, `diff_context` for changed files,
`quality_check` before trusting reductions, `attribute_savings` for savings
breakdowns, `compression_experiment` for compression tests, `project_policy`
for repo defaults, `setup_wizard` for installation guidance, and
`compare_context` before trusting a reduced artifact.

Report one of:

- `use`
- `ask`
- `skip`

Include expected savings, downside estimates, quality risk, and privacy/cache
sensitivity.

To show the latest local hook result, use `latest_advice` when MCP is available
or `npm run mdz -- latest-advice` from the repo. Use `profile_context`,
`extract_evidence`, `plan_compression`, and `check_sufficiency` for MDZ context
engineering.

## Risk Rules

- Low risk: deterministic filtering with original handle retained.
- Medium risk: extractive summary with source spans and handle retained.
- High risk: semantic summary or prompt rewrite.
- Avoid irreversible transformations.

## User Communication

When MDZ changes context, explain briefly:

- what was reduced,
- estimated tokens saved,
- what risk level applies,
- how original content can be expanded.
