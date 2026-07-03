# mdz-core

Shared implementation library for MDZ.

Current capabilities:

- approximate token estimation,
- local content-addressed context storage,
- MDZ handle generation and expansion,
- deterministic filters for test output and logs,
- shared model-facing reduction with net-savings and risk gates,
- gateway configuration, backup-based migration, and diagnostics,
- session transcript analysis,
- confirmed-versus-potential accounting and tradeoff estimates.

Run locally:

```bash
npm run mdz -- estimate README.md
npm run mdz -- filter-output --kind test path/to/output.txt
npm run mdz -- analyze-session path/to/session.txt
npm run mdz -- gateway status
```

The estimator is intentionally approximate in this first version. Provider-
specific tokenizers can be added behind the same API later.
