# Risk Model

## Risk Categories

### Quality Risk

MDZ may remove, summarize, or delay context that the agent needed.

Mitigations:

- keep original handles,
- prefer deterministic filters,
- label risk per optimization,
- measure handle expansion rate,
- compare reduced context to original context,
- require approval for aggressive policies.

### Latency Risk

MDZ may slow down workflows.

Sources:

- token estimation,
- file scanning,
- log clustering,
- summarization,
- embeddings,
- local storage reads/writes.

Mitigations:

- cache token estimates,
- stream large file processing,
- keep safe filters cheap,
- make expensive analysis opt-in,
- show added latency in reports.

### Resource Risk

MDZ may consume local CPU, memory, or disk.

Mitigations:

- expose resource usage,
- set cache limits,
- allow no-embedding/no-model modes,
- compress local storage,
- provide cleanup commands.

### Privacy Risk

MDZ stores sensitive context locally.

Mitigations:

- local-only default,
- clear cache controls,
- configurable retention,
- redact reports by default where possible,
- avoid cloud telemetry in version 0.1.

### Workflow Risk

MDZ may add setup complexity or require platform-specific configuration.

Mitigations:

- start in enabled mode, with observe available for audits,
- provide plugin packaging where possible,
- degrade gracefully,
- keep user prompts unchanged,
- provide clear diagnostics.

### Measurement Risk

Token estimates may differ from provider billing.

Mitigations:

- label estimates clearly,
- support provider-specific tokenizers where available,
- report confidence,
- allow users to import actual usage data when available.

## Risk Levels

### Low

Deterministic reduction with original handle retained.

Example: collapse repeated identical log lines.

### Medium

Extractive summary with source spans and handle retained.

Example: return top 20 relevant log windows from a 10,000-line file.

### High

Semantic summary or prompt rewriting.

Example: rewrite a long user prompt into a compact task contract.

### Critical

Irreversible deletion or transformation of context.

MDZ should avoid this by design.
