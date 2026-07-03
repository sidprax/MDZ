---
name: mdz
description: MDZ Token Advisor checks prompts, tool output, and sessions for token savings, then recommends apply, ask, or skip with downsides. Use when the user asks to optimize tokens, reduce costs, benchmark savings, analyze session usage, or run MDZ.
---

# MDZ Token Advisor

Use MDZ Token Advisor to reduce token usage without changing the user's workflow.

## Default Behavior

Start in enabled mode unless the user explicitly requests observe, suggest,
safe, balanced, or aggressive mode. Enabled mode actively recommends savings
and asks before applying changes; observe mode is for measurement-only audits.

Start with `visible` policy visibility. Once the user trusts MDZ, suggest
`digest` visibility so MDZ periodically reports savings and downsides without
interrupting every turn. Use `quiet` only when explicitly requested.

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

When `mdz_gateway` is available, use `mdz_search_tools` and `mdz_call_tool` for
upstream MCP work instead of bypassing the gateway. This does not require the
user to change their prompt. Expand a handle only when omitted details are
needed. Count a reduction as actual only when the gateway delivered the smaller
payload; native hooks are advisory and otherwise report potential savings.

## Benchmark Workflow

When the user asks to benchmark MDZ, use:

- `npm run mdz -- benchmarks` to list local scenarios.
- `npm run mdz -- benchmark suite --mode safe` to run the built-in benchmark suite.
- `npm run mdz -- benchmark custom --file <path> --type session` for custom artifacts.
- report savings and downsides together.
- call out quality markers and possible workflow breakage.

## Advisor Workflow

When the user asks whether MDZ should be used, or when a session/log/tool output
may be expensive, use:

- `npm run mdz -- recommend <session-file>` for existing sessions.
- `npm run mdz -- advisor <session-file> --mode suggest --format text` for a readable recommendation.
- `npm run mdz -- policy show` to see whether MDZ is observing, suggesting, or applying.
- `npm run mdz -- policy set --mode enabled` when the user wants MDZ to ask before applying.
- `npm run mdz -- policy set --mode suggest --visibility-level digest` when the user wants fewer interruptions.
- `npm run mdz -- report-session <session-file> --format text` for a readable session report.
- `npm run mdz -- scan-session <session-file> --format text` for large Codex,
  Antigravity/Gemini, Claude, or generic transcripts that should be streamed
  instead of loaded fully into context.
- `npm run mdz -- replay-session <session-file> --format text` for turn-by-turn savings.
- `npm run mdz -- usage-report --format text` for cumulative savings and downsides.
- `npm run mdz -- digest --format text` for periodic savings updates.
- `npm run mdz -- dashboard --write-reports` for a local dashboard.
- `npm run mdz -- autopilot --target-reduction 0.3` for a policy recommendation.
- `npm run mdz -- cache inspect --format text` before discussing cache size or retention.
- `npm run mdz -- cost estimate ...` when the user asks for dollar estimates.
- `npm run mdz -- response-profile recommend ...` for output-token reduction.
- `npm run mdz -- output-contract ...`, `output-budget ...`,
  `audit-response ...`, and `compress-response ...` for final/output token
  savings. `audit-response` records potential assistant-output savings;
  `compress-response` records applied assistant-output savings.
- `npm run mdz -- tool-schema <file>` to analyze MCP/tool schema overhead.
- `npm run mdz -- compact-tool-schema <file>` to produce a compatibility-checked compact schema catalog.
- `npm run mdz -- tool-deferral <file>` and `tool-search <file> --query ...`
  to plan and test deterministic deferred-tool routing.
- `npm run mdz -- prefix-snapshot <file>` and `cache-stability <file>` to
  diagnose probable prompt-cache reuse or cold starts.
- `npm run mdz -- feedback <event>` and `learning-report` when the user wants MDZ to learn from outcomes.
- `npm run mdz -- classify-task <file>` and `budget <file>` before large tasks.
- `npm run mdz -- contract <file>` to create a compact task contract.
- `npm run mdz -- secret-scan <file>` or `redact <file>` before caching/reporting sensitive text.
- `npm run mdz -- repo-map` and `semantic-cache` to avoid repeated repo/file exploration.
- `npm run mdz -- tool-guardrails --text ...` before expensive tool calls.
- `npm run mdz -- compact-state <session>` before context compaction.
- `npm run mdz -- handoff <session> --target <agent>` before moving work across agents.
- `npm run mdz -- diff-context <diff>` for changed-file context planning.
- `npm run mdz -- quality-check <original> <reduced>` before trusting reduced context.
- `npm run mdz -- compression-experiment <file>` to test prompt-level compression ideas.
- `npm run mdz -- setup --platform <platform>` for guided install checks.
- `npm run mdz -- compare <original-file> <reduced-file>` before trusting a reduction.
- `npm run mdz -- find-sessions --format text` to discover existing sessions.
- `npm run mdz -- profile <file>`, `evidence <file>`, `plan <file>`, and
  `sufficiency <original> <reduced>` for MDZ context engineering.
- `npm run mdz -- doctor antigravity --format text` before an Antigravity validation run.
- `recommend_mdz` when the MCP server is available.
- `advisor` when the MCP server is available and the user needs an apply/ask/skip decision.
- `doctor`, `profile_context`, `extract_evidence`, `plan_compression`,
  `check_sufficiency`, `report_session`, `usage_report`, `savings_digest`, `replay_session`,
  `dashboard`, `manage_cache`, `estimate_cost`, `policy_autopilot`, `scan_session`,
  `response_profile`, `output_contract`, `answer_contract`, `output_budget`,
  `audit_response`, `compress_response`, `analyze_tool_schema`,
  `compact_tool_schemas`, `plan_tool_deferral`, `search_tool_catalog`,
  `create_prefix_snapshot`, `analyze_cache_stability`,
  `record_feedback`, `learning_report`, `classify_task`, `plan_budget`, `create_task_contract`,
  `scan_secrets`, `redact_text`, `semantic_cache`, `repo_memory_map`,
  `tool_guardrails`, `compact_state`, `create_handoff`, `diff_context`,
  `quality_check`, `attribute_savings`, `compression_experiment`,
  `project_policy`, `setup_wizard`, and `compare_context` when the MCP server
  is available.
- `npm run mdz -- latest-advice` or `latest_advice` to show the most recent hook advice.

Report an advisor action:

- `apply`: safe to optimize under the selected policy.
- `ask`: worthwhile, but the user should choose.
- `skip`: expected savings do not justify MDZ overhead.
- `observe`: measure only.

Always include the reason, estimated savings, and downsides.
When reporting accumulated savings, distinguish input/context savings from
assistant-output savings.
Show the top savings examples when available. Treat tool-deferral and cache
diagnostics as estimates unless host/provider usage confirms them.

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
- what downsides were estimated,
- how original content can be expanded.
