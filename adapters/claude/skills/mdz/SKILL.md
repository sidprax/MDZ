---
name: mdz
description: MDZ Token Advisor checks prompts, tool output, and sessions for token savings, then recommends observe, ask, apply, or skip with downsides. Use when the user asks to optimize tokens, reduce costs, benchmark savings, analyze session usage, or run MDZ.
---

# MDZ Token Advisor

Use MDZ Token Advisor to reduce token usage without changing the user's normal
Claude Code workflow.

Start in enabled mode unless the user explicitly asks for observe, suggest,
safe, balanced, or aggressive mode.

When context may be large:

1. Call `show_policy`.
2. Use `profile_context`, `extract_evidence`, and `plan_compression` before
   reducing large context.
3. Use `advisor`, `report_session`, `filter_output`, or `compare_context`.
4. Check sufficiency before relying on reduced artifacts.
5. Report savings and downsides together.
6. Prefer deterministic filters and original-content handles.
7. Do not silently rewrite the user's intent.

When `mdz_gateway` is available, route upstream MCP work through
`mdz_search_tools` and `mdz_call_tool` without asking the user to change their
prompt. Expand a handle only when omitted details are needed. Count savings as
actual only when the gateway delivered the smaller payload.

Use `find_sessions` to locate older Codex, Claude, Antigravity, or workspace
transcripts before running `report_session`. Use `usage_report` to summarize
cumulative MDZ savings and downsides. Use `replay_session`, `dashboard`,
`manage_cache`, `estimate_cost`, `policy_autopilot`, `response_profile`,
`output_contract`, `answer_contract`, `output_budget`, `audit_response`,
`compress_response`, `analyze_tool_schema`, `compact_tool_schemas`,
`plan_tool_deferral`, `search_tool_catalog`, `create_prefix_snapshot`, and
`analyze_cache_stability` when the user asks for session
replay, dashboard, storage, cost, target savings, response verbosity, final
answer compression, or tool overhead. `audit_response` records potential
assistant-output savings, while `compress_response` records applied
assistant-output savings. Use
`record_feedback`, `learning_report`, `classify_task`, `plan_budget`,
`create_task_contract`, `scan_secrets`, `redact_text`, `semantic_cache`,
`repo_memory_map`, `tool_guardrails`, `compact_state`, `create_handoff`,
`diff_context`, `quality_check`, `attribute_savings`, `compression_experiment`,
`project_policy`, and `setup_wizard` for learning, privacy, repo memory,
compaction, cross-agent handoff, and setup guidance. Use `doctor` to validate
setup.
