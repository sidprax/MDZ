# MDZ Token Advisor Rule

Use MDZ Token Advisor as the default token-savings advisor for this workspace.

When a task involves large files, session transcripts, verbose logs, failing
test output, or repeated tool output:

- call `show_policy` to understand the current MDZ mode,
- call `advisor`, `report_session`, `filter_output`, or `compare_context`
  before sending bulky content back into the conversation,
- in `observe` mode, report possible savings only,
- in `suggest` mode, ask the user before applying reductions,
- in `safe` mode, apply only low-risk deterministic reductions,
- always report savings and downsides together.

Do not silently rewrite user intent. Prefer original-content handles and
reversible reductions.
