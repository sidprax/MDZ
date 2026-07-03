# Codex Plugin

Planned packaging for MDZ on Codex.

The plugin should bundle:

- MDZ skill,
- MDZ MCP server configuration,
- optional hooks,
- marketplace metadata,
- local reporting commands or docs.

This is a logical packaging layer over the skill and MCP server, not a separate
product path.

Current repo-local plugin path:

```text
plugins/mdz
```

The plugin currently points its MCP config at the local workspace server:

```text
packages/mdz-mcp-server/bin/mdz-mcp-server.mjs
```
