# Compression Strategies

## Strategy 1: Raw Text Compression

Examples: gzip, brotli, zstd, base64-encoded compressed payloads.

Useful for:

- local cache storage,
- network transfer,
- archived reports.

Usually not useful for:

- direct model context.

Reason: providers bill on model tokens, not bytes. If compressed text is sent as
prompt text, it is still tokenized and the model has poor access to the original
meaning.

## Strategy 2: Handle-Based Lossless Compression

Replace bulky content with a short handle:

```text
mdz://context/01JZ...#summary
```

The original content remains in local storage and can be expanded by slice,
query, line range, or full retrieval.

Benefits:

- lossless access to original content,
- large token savings,
- auditable,
- works across platforms through MCP tools.

Risks:

- agent may fail to expand when needed,
- local store must be reliable,
- handles require lifecycle and cleanup rules.

## Strategy 3: Deterministic Filtering

Remove or collapse low-signal content with rules:

- keep failing tests, collapse passing tests,
- keep stack roots, collapse repeated frames,
- keep matching log clusters, collapse duplicates,
- keep changed hunks, collapse unchanged context,
- keep top search results, collapse weak matches.

Benefits:

- low quality risk,
- explainable,
- does not require another model call.

Risks:

- rules may miss unusual signals,
- needs scenario-specific filters.

## Strategy 4: Extractive Summarization

Select important original spans and return them with provenance.

Benefits:

- safer than free-form summaries,
- source references remain clear.

Risks:

- can omit relevant spans,
- may require ranking heuristics or embeddings.

## Strategy 5: Semantic Summarization

Generate new compressed text that represents original content.

Benefits:

- largest savings for narrative content,
- useful for long conversations and documents.

Risks:

- not lossless,
- can introduce errors,
- may require model calls,
- should always include original handles.

## Strategy 6: Output Profiles

Ask the agent/model to produce less verbose responses:

- terse,
- standard,
- audit-grade,
- handle-backed full detail.

Benefits:

- directly reduces output tokens,
- user-controllable.

Risks:

- terse responses may omit useful explanation,
- platform support varies.

## Strategy 7: UI-Layer Output Storage

Store full responses locally and show compact responses in the active context.

Benefits:

- closest equivalent to lossless output compression,
- user can expand detail when needed.

Risks:

- requires UI or platform integration,
- not purely MCP unless the platform consumes handles naturally.
