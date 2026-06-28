import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  STRIPPED_INBOUND_HEADERS,
} from '../proxy/proxy.constants';

/**
 * Edge request-context middleware. Runs before the proxy so that:
 *
 *  1. Client-supplied internal/trust headers are stripped — a request can never
 *     forge internal identity or the dev test-user bypass from outside.
 *  2. Every request carries an x-request-id (generated if absent), forwarded
 *     upstream and echoed back so a single id correlates client → gateway →
 *     services. W3C `traceparent`, if present, is left intact and forwarded.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  for (const header of STRIPPED_INBOUND_HEADERS) {
    delete req.headers[header];
  }

  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
