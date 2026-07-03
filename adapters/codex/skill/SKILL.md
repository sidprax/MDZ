---
name: mdz
description: Reduce token usage in agentic workflows by measuring context, replacing bulky content with handles, filtering low-signal output, and reporting savings. Use when the user asks to optimize tokens, benchmark agent costs, analyze session usage, or run MDZ.
---

# MDZ Skill

Use MDZ to reduce token usage without changing the user's workflow.

## Default Behavior

Start in enabled mode unless the user explicitly requests observe, suggest,
safe, balanced, or aggressive mode. Enabled mode recommends savings and asks
before applying; observe mode is for measurement-only audits.

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

Use `find_sessions` before asking the user to locate older transcript files.
For long final answers, use output contracts or response compression before
responding. Usage reports distinguish input/context savings from
assistant-output savings.
Use schema compaction and deterministic tool deferral for large MCP catalogs.
Use prefix snapshots and cache-stability analysis for probable cache behavior,
but do not present estimates as provider-confirmed savings.

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
