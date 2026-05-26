const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|secret|password|pass|hash|signature|api[_-]?key|fcm|smtp|cloudinary|vnpay|ipaddr|ipaddress|clientip|remoteip|remoteaddress|x-forwarded-for|x-real-ip|cf-connecting-ip|(^|[-_])ip($|[-_])/i;

type RedactionRule = {
  pattern: RegExp;
  replacement: (match: RegExpExecArray) => string;
};

type RedactionMatch = {
  start: number;
  end: number;
  replacement: string;
};

const prefixRedaction = (match: RegExpExecArray) =>
  `${match[1] ?? ''}${REDACTED}`;

const STRING_REDACTIONS: RedactionRule[] = [
  {
    pattern: /\b(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;"]+/gi,
    replacement: prefixRedaction,
  },
  {
    pattern: /\b(bearer\s+)[^\s,;"]+/gi,
    replacement: prefixRedaction,
  },
  {
    pattern: /\b(cookie\s*[:=]\s*)[^\n"]+/gi,
    replacement: prefixRedaction,
  },
  {
    pattern:
      /\b((?:token|secret|hash|signature|api[_-]?key|password|pass|fcm|smtp|cloudinary|vnpay)\s*[:=]\s*)[^\s,;"]+/gi,
    replacement: prefixRedaction,
  },
  {
    pattern:
      /\b((?:ipaddr|ip|clientip|remoteip|remoteaddress|x-forwarded-for|x-real-ip|cf-connecting-ip)\s*[:=]\s*)[^\s,;"]+/gi,
    replacement: prefixRedaction,
  },
];

export function redactString(value: string): string {
  const matches = STRING_REDACTIONS.flatMap(({ pattern, replacement }) => {
    pattern.lastIndex = 0;
    const ruleMatches: RedactionMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value))) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }

      ruleMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: replacement(match),
      });
    }

    return ruleMatches;
  });

  matches.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    return right.end - left.end;
  });

  let redacted = '';
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue;
    redacted += value.slice(cursor, match.start);
    redacted += match.replacement;
    cursor = match.end;
  }

  return redacted + value.slice(cursor);
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
