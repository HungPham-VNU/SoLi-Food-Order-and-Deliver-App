import { redactHeaders, redactString, redactValue } from './redaction';

describe('observability redaction', () => {
  it('redacts sensitive headers and nested fields', () => {
    expect(
      redactHeaders({
        authorization: 'Bearer abc',
        cookie: 'sid=123',
        nested: { smtpPass: 'secret', safe: 'value' },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      nested: { smtpPass: '[REDACTED]', safe: 'value' },
    });
  });

  it('redacts sensitive strings', () => {
    expect(redactString('ipAddr=127.0.0.1 token=abc secret: def')).toBe(
      'ipAddr=[REDACTED] token=[REDACTED] secret: [REDACTED]',
    );
  });

  it('does not redact version-shaped strings as IP addresses', () => {
    expect(redactString('release=1.2.3.4 version 10.20.30.40')).toBe(
      'release=1.2.3.4 version 10.20.30.40',
    );
  });

  it('redacts bearer credentials without leaking the token suffix', () => {
    expect(redactString('authorization=Bearer abc123')).toBe(
      'authorization=[REDACTED]',
    );
  });

  it('does not partially re-redact overlapping sensitive strings', () => {
    expect(redactString('authorization=Bearer token=abc')).toBe(
      'authorization=[REDACTED]',
    );
  });

  it('preserves non-sensitive values', () => {
    expect(redactValue({ status: 'ok', count: 2 })).toEqual({
      status: 'ok',
      count: 2,
    });
  });

  it('redacts explicit IP fields while preserving app versions', () => {
    expect(redactValue({ ipAddr: '127.0.0.1', appVersion: '1.2.3.4' })).toEqual(
      {
        ipAddr: '[REDACTED]',
        appVersion: '1.2.3.4',
      },
    );
  });
});
