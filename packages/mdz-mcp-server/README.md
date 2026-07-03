# mdz-mcp-server

Portable stdio MCP server for MDZ Token Advisor (Modum Delta Zero).

Run locally:

```bash
npm run mdz:mcp
```

The server can be configured in MCP-compatible clients such as Codex,
Antigravity, Claude Code, and generic local MCP clients.

This server provides analysis, policy, reports, and explicit transformations.
For automatic upstream result reduction, also configure `mdz_gateway`; an MCP
server cannot intercept calls made directly to another MCP server.

## Tool Groups

Setup and policy:

- `doctor`
- `install_mdz`
- `show_policy`
- `set_policy`
- `policy_autopilot`
- `savings_digest`
- `project_policy`
- `setup_wizard`

Token and cost analysis:

- `estimate_tokens`
- `estimate_cost`
- `recommend_mdz`
- `advisor`
- `response_profile`
- `output_contract`
- `answer_contract`
- `output_budget`
- `audit_response`
- `compress_response`
- `classify_task`
- `plan_budget`
- `scan_secrets`
- `redact_text`

Context engineering:

- `profile_context`
- `extract_evidence`
- `plan_compression`
- `check_sufficiency`
- `compare_context`
- `filter_output`
- `store_context`
- `expand_context`
- `apply_once`
- `create_task_contract`
- `semantic_cache`
- `repo_memory_map`
- `tool_guardrails`
- `compact_state`
- `create_handoff`
- `diff_context`
- `quality_check`
- `compression_experiment`

Session and reporting:

- `find_sessions`
- `analyze_session`
- `report_session`
- `replay_session`
- `usage_report`
- `report_usage`
- `dashboard`
- `record_feedback`
- `learning_report`
- `attribute_savings`

Benchmarks and platform overhead:

- `list_benchmarks`
- `run_benchmark`
- `analyze_tool_schema`
- `compact_tool_schemas`
- `plan_tool_deferral`
- `search_tool_catalog`
- `create_prefix_snapshot`
- `analyze_cache_stability`

Maintenance:

- `latest_advice`
- `manage_cache`

## Output Reporting

`audit_response` records potential assistant-output savings. `compress_response`
records applied assistant-output savings when the shortened answer is produced.
`usage_report` and `savings_digest` split totals between input/context savings
and assistant-output savings. They also show privacy-safe top savings examples
and technique attribution.
