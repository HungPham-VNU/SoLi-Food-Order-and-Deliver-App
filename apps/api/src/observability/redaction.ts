const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|secret|password|pass|hash|signature|api[_-]?key|fcm|smtp|cloudinary|vnpay/i;

const STRING_REDACTIONS: Array<[RegExp, string]> = [
  [/(authorization=|authorization:|bearer\s+)[^\s,;"]+/gi, `$1${REDACTED}`],
  [/(cookie=|cookie:)[^\n"]+/gi, `$1${REDACTED}`],
  [/(token=)[^\s,;"]+/gi, `$1${REDACTED}`],
  [/(secret=)[^\s,;"]+/gi, `$1${REDACTED}`],
  [/(hash=)[^\s,;"]+/gi, `$1${REDACTED}`],
  [/(ipAddr=)[^\s,;"]+/gi, `$1${REDACTED}`],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, REDACTED],
];

export function redactString(value: string): string {
  return STRING_REDACTIONS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry),
    ]),
  );
}

export function redactHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!headers) return undefined;
  return redactValue(headers) as Record<string, unknown>;
}
