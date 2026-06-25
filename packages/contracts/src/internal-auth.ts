import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { z } from 'zod';

export const INTERNAL_AUTH_ALGORITHM = 'HS256' as const;

export const internalAuthClaimsSchema = z.object({
  iss: z.string().min(1),
  sub: z.string().min(1),
  aud: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().uuid(),
  correlationId: z.string().min(1),
  roles: z.array(z.string().min(1)).default([]),
  email: z.string().email().optional(),
  sessionId: z.string().optional(),
});

export type InternalAuthClaims = z.infer<typeof internalAuthClaimsSchema>;

export interface SignInternalJwtInput {
  issuer: string;
  subject: string;
  audience: string;
  secret: string;
  correlationId: string;
  roles?: string[];
  email?: string | null;
  sessionId?: string | null;
  ttlSeconds?: number;
  now?: Date;
  jwtId?: string;
}

export interface VerifyInternalJwtInput {
  secret: string;
  audience: string;
  issuers?: readonly string[];
  now?: Date;
}

export class InternalJwtError extends Error {
  constructor(
    public readonly code:
      | 'malformed'
      | 'unsupported_alg'
      | 'invalid_signature'
      | 'invalid_claims'
      | 'expired'
      | 'wrong_audience'
      | 'wrong_issuer',
    message: string,
  ) {
    super(message);
    this.name = 'InternalJwtError';
  }
}

export function signInternalJwt(input: SignInternalJwtInput): string {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const claims: InternalAuthClaims = {
    iss: input.issuer,
    sub: input.subject,
    aud: input.audience,
    iat: nowSeconds,
    exp: nowSeconds + (input.ttlSeconds ?? 60),
    jti: input.jwtId ?? randomUUID(),
    correlationId: input.correlationId,
    roles: input.roles ?? [],
    ...(input.email ? { email: input.email } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
  const header = { alg: INTERNAL_AUTH_ALGORITHM, typ: 'JWT' };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  return `${unsigned}.${sign(unsigned, input.secret)}`;
}

export function verifyInternalJwt(
  token: string,
  input: VerifyInternalJwtInput,
): InternalAuthClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InternalJwtError('malformed', 'Internal JWT is malformed.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseBase64UrlJson(encodedHeader);
  if (
    !header ||
    typeof header !== 'object' ||
    (header as Record<string, unknown>).alg !== INTERNAL_AUTH_ALGORITHM
  ) {
    throw new InternalJwtError(
      'unsupported_alg',
      'Internal JWT uses an unsupported algorithm.',
    );
  }

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsigned, input.secret);
  if (!safeEqual(encodedSignature, expected)) {
    throw new InternalJwtError(
      'invalid_signature',
      'Internal JWT signature is invalid.',
    );
  }

  const parsed = internalAuthClaimsSchema.safeParse(
    parseBase64UrlJson(encodedPayload),
  );
  if (!parsed.success) {
    throw new InternalJwtError(
      'invalid_claims',
      'Internal JWT claims are invalid.',
    );
  }

  const claims = parsed.data;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (claims.exp <= nowSeconds) {
    throw new InternalJwtError('expired', 'Internal JWT is expired.');
  }
  if (claims.aud !== input.audience) {
    throw new InternalJwtError(
      'wrong_audience',
      'Internal JWT audience is not accepted by this service.',
    );
  }
  if (input.issuers?.length && !input.issuers.includes(claims.iss)) {
    throw new InternalJwtError(
      'wrong_issuer',
      'Internal JWT issuer is not trusted by this service.',
    );
  }

  return claims;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function parseBase64UrlJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new InternalJwtError('malformed', 'Internal JWT JSON is malformed.');
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
