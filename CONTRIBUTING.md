# Contributing

MDZ is a public alpha. Keep changes narrow, deterministic, and measurable.

```bash
npm ci
npm test
npm run validate:real-mcp
npm run mdz -- doctor all --format text --quick-benchmark
```

Requirements:

- Never count advisory recommendations as applied savings.
- Preserve originals for every automatic reduction.
- Include wrapper overhead in savings estimates.
- Report latency, CPU, disk, privacy, and quality tradeoffs.
- Add focused tests for changed behavior.
- Do not commit `.mdz` data or machine-specific generated configuration.

Open pull requests against `main` and describe behavioral risk plus validation.
