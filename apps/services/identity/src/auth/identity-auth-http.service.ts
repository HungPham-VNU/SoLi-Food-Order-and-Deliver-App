import { Inject, Injectable } from '@nestjs/common';
import {
  identityHttpRequestSchema,
  type IdentityHttpRequest,
  type IdentityHttpResponse,
} from '@uitfood/contracts';
import { IDENTITY_AUTH, type IdentityAuth } from './auth.factory';

@Injectable()
export class IdentityAuthHttpService {
  constructor(@Inject(IDENTITY_AUTH) private readonly auth: IdentityAuth) {}

  async handle(input: IdentityHttpRequest): Promise<IdentityHttpResponse> {
    const request = identityHttpRequestSchema.parse(input);
    const response = await this.auth.handler(
      new Request(request.url, {
        method: request.method,
        headers: toHeaders(request.headers),
        body: bodyFor(request),
      }),
    );
    const body = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      headers: headersFrom(response.headers),
      bodyBase64: body.toString('base64'),
    };
  }
}

function bodyFor(request: IdentityHttpRequest): ArrayBuffer | undefined {
  if (!request.bodyBase64 || ['GET', 'HEAD'].includes(request.method)) {
    return undefined;
  }
  const buffer = Buffer.from(request.bodyBase64, 'base64');
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

function toHeaders(headers: IdentityHttpRequest['headers']): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
      continue;
    }
    result.set(key, value);
  }
  return result;
}

function headersFrom(headers: Headers): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue;
    result[key] = value;
  }
  const setCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  if (setCookie?.length) {
    result['set-cookie'] = setCookie;
  } else {
    const merged = headers.get('set-cookie');
    if (merged) result['set-cookie'] = merged;
  }
  return result;
}
