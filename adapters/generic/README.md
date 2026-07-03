# Generic MCP Adapter

Use this adapter for any agentic platform that can connect to a local stdio MCP
server but does not have a dedicated MDZ plugin. MDZ means Modum Delta Zero.
The advisor server measures and reports; the gateway can reduce upstream MCP
results before they reach the model.

## MCP Config

Generate the configuration containing both `mdz` and `mdz_gateway`:

```bash
npm run mdz -- install generic
```

Use `gateway init --from <config>` to migrate upstream JSON MCP entries. Calls
that bypass the gateway are measured as potential savings, not actual savings.

## First Prompt

```text
Use MDZ Token Advisor in enabled mode. Call doctor, show_policy, and
usage_report. Report whether MDZ is ready and what mode it is in.
```

## Minimum Tool Set

- `doctor`
- `show_policy`
- `estimate_tokens`
- `advisor`
- `find_sessions`
- `report_session`
- `usage_report`
- `compare_context`
- `run_benchmark`
