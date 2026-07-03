# MDZ MCP Gateway

The MDZ gateway is the portable enforcement boundary for Modum Delta Zero. It
connects to upstream stdio MCP servers, exposes a small search-and-call surface,
and can replace verbose text results before an MCP client sends them to its
model. Originals are stored locally behind reversible `mdz://context/...`
handles.

Configure it from an existing JSON MCP configuration:

```bash
npm run mdz -- gateway init --from path/to/mcp_config.json
```

Review `.mdz/gateway.json`, then either update the host manually or explicitly
request a backup and rewrite:

```bash
npm run mdz -- gateway init --from path/to/mcp_config.json --rewrite-host
```

The host should expose `mdz` and `mdz_gateway`, not the same upstream servers
directly. Otherwise the agent can bypass MDZ and no actual gateway savings can
be claimed.
