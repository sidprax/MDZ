# MDZ Hooks

Planned Codex hook implementations:

- `UserPromptSubmit`: estimate prompt size and suggest compact task contracts.
- `PreToolUse`: detect commands likely to produce verbose output.
- `PostToolUse`: store large outputs and return summaries with handles.
- `PreCompact` / `PostCompact`: preserve handles and decision ledgers.
- `Stop`: write local usage reports.

Hooks should default to observe mode while MDZ is in early validation.

The first hook scripts live under:

```text
adapters/codex/hooks
```

They are observation-only prototypes that write local reports under `.mdz/hooks`.
