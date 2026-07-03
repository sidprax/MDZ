# Security Policy

## Public Alpha

MDZ is experimental local developer tooling. Do not route production secrets or
regulated data through MDZ until its storage and retention behavior has been
reviewed for that environment.

## Data Handling

- MDZ has no cloud telemetry.
- Reversible handles store original content under the target project's
  `.mdz/store` directory.
- Reports and ledgers may contain metadata, paths, excerpts, and token estimates.
- Gateway environment variables are stored in `.mdz/gateway.json`; avoid
  committing this file and prefer environment-variable references supported by
  the upstream MCP server.
- `.mdz/` is ignored by this repository, but consuming projects must also keep
  it out of version control.

Use `npm run mdz -- cache inspect` before sharing a workspace. Uninstall with
`--purge-data` only when reports, ledger history, gateway configuration, and
stored originals should be permanently removed.

## Reporting A Vulnerability

Use GitHub's private Security Advisory reporting for the repository. Do not
open a public issue containing credentials, sensitive transcripts, or an
unredacted exploit. Include the affected version, platform, reproduction steps,
impact, and suggested mitigation when possible.

## Supported Versions

Only the latest public-alpha release receives security fixes.
