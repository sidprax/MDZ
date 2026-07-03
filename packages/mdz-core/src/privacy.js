const SECRET_PATTERNS = [
  { type: "openai-key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { type: "generic-api-key", pattern: /\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{12,})/gi },
  { type: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/g },
  { type: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g }
];

export function scanSecrets(text, options = {}) {
  const content = String(text ?? "");
  const findings = [];
  for (const item of SECRET_PATTERNS) {
    for (const match of content.matchAll(item.pattern)) {
      findings.push({
        type: item.type,
        start: match.index,
        end: match.index + match[0].length,
        preview: maskSecret(match[0]),
        severity: item.type === "private-key" ? "high" : "medium"
      });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    findingCount: findings.length,
    highestSeverity: findings.some((item) => item.severity === "high") ? "high" : findings.length ? "medium" : "none",
    findings: findings.slice(0, Number(options.limit ?? 20))
  };
}

export function redactText(text) {
  let redacted = String(text ?? "");
  const findings = [];
  for (const item of SECRET_PATTERNS) {
    redacted = redacted.replace(item.pattern, (match, ...args) => {
      const index = typeof args.at(-2) === "number" ? args.at(-2) : undefined;
      findings.push({ type: item.type, start: index, preview: maskSecret(match) });
      return `[REDACTED:${item.type}]`;
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    redacted,
    findingCount: findings.length,
    findings
  };
}

function maskSecret(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}
