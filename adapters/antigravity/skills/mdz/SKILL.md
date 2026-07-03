---
name: mdz
description: MDZ Token Advisor checks Antigravity prompts, tool output, and sessions for token savings, then recommends apply, ask, or skip with downsides. Use when the user asks to optimize tokens, reduce costs, analyze session usage, benchmark savings, or run MDZ.
---

# MDZ Token Advisor For Antigravity

Use MDZ to reduce token usage without changing how the user asks Antigravity to
work.

## Default Mode

Start in enabled mode unless the user explicitly asks for observe, suggest,
safe, balanced, or aggressive mode. Enabled mode recommends savings and asks
before applying; observe mode is for measurement-only audits.

Start with visible recommendations. After the user trusts MDZ, suggest digest
visibility so Antigravity periodically reports savings and downsides without
interrupting every turn.

Do not silently rewrite user intent. If a prompt or tool result is large, store
the original behind an MDZ handle before using a compact task contract,
filtered output, or summary.

## When To Use MDZ

Use MDZ when:

- tool output is large,
- test or log output is verbose,
- the user asks about token usage, cost, savings, or optimization,
- the user asks to analyze an existing session,
- the workflow is likely to accumulate large context.

## MCP Tools

Prefer the MDZ MCP server for deterministic work:

When `mdz_gateway` is available, route upstream MCP work through
`mdz_search_tools` and `mdz_call_tool` without asking the user to change their
prompt. Expand a handle only when omitted details are needed. Count savings as
actual only when the gateway delivered the smaller payload.

- `estimate_tokens`
- `doctor`
- `profile_context`
- `extract_evidence`
- `plan_compression`
- `check_sufficiency`
- `store_context`
- `expand_context`
- `filter_output`
- `analyze_session`
- `find_sessions`
- `replay_session`
- `dashboard`
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
- `record_feedback`
- `learning_report`
- `classify_task`
- `plan_budget`
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
- `list_benchmarks`
- `run_benchmark`
- `recommend_mdz`
- `show_policy`
- `set_policy`
- `apply_once`
- `latest_advice`
- `savings_digest`
- `report_session`
- `usage_report`
- `compare_context`
- `report_usage`

## Recommendation Behavior

When Antigravity is about to process a large prompt, session, log, or tool
output, use MDZ to recommend:

- `use` when savings are high and risk is acceptable,
- `ask` when savings are plausible but user confirmation is appropriate,
- `skip` when savings do not justify overhead.

Present the recommendation with estimated savings and downsides.

For long final answers, use `output_contract` or `output_budget` before
responding. If a drafted response is too long, use `audit_response` and
`compress_response`, then report estimated output-token savings. Usage reports
separate input/context savings from assistant-output savings.
When available, show the top savings examples. Do not describe probable cache
reuse or planned tool deferral as actual savings without host/provider evidence.

When the user asks about an older session, call `find_sessions` first unless
the user already provided a transcript path. Then call `report_session` on the
selected file and summarize savings, risk, and next recommended mode.

## Risk Rules

- Low risk: deterministic filtering with original handle retained.
- Medium risk: extractive summary with source spans and handle retained.
- High risk: semantic summary or prompt rewriting.

Always report downsides with savings:

- added latency,
- local CPU work,
- local disk/cache growth,
- quality risk,
- workflow interruptions.
