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
    expect(redactString('ipAddr=127.0.0.1 token=abc')).toBe(
      'ipAddr=[REDACTED] token=[REDACTED]',
    );
  });

  it('preserves non-sensitive values', () => {
    expect(redactValue({ status: 'ok', count: 2 })).toEqual({
      status: 'ok',
      count: 2,
    });
  });
});
