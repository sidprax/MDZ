# Claude Code Adapter

MDZ (Modum Delta Zero) installs a Claude Code plugin containing its skill,
advisory hooks, the MDZ reporting MCP server, and the universal MCP gateway.

```bash
npm run mdz -- install claude --scope project
# or
npm run mdz -- install claude --scope user
```

Restart Claude Code or run `/reload-plugins`. Native hooks observe and report;
they do not claim actual result reduction. Route upstream MCP tools through
`mdz_gateway` for enforceable model-facing reductions and reversible handles.

```bash
npm run mdz -- gateway init --from path/to/mcp_config.json
npm run mdz -- doctor claude --format text
```

Final-answer compression remains agent-directed. Reports separate potential,
confirmed input/context, and assistant-output savings.
