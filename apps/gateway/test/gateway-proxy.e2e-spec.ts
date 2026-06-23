/**
 * gateway-proxy.e2e-spec.ts
 *
 * Boots the real gateway (same wiring as production via createGatewayApp) in
 * front of a controllable echo-upstream that stands in for the monolith. The
 * echo-upstream reflects back exactly what it received (method, url, headers,
 * raw body as base64), which lets us assert the gateway's proxy contract
 * precisely — something the real monolith could not report.
 *
 * Asserts:
 *  §1 A standard JSON request proxies correctly (method, path, body round-trip).
 *  §2 Trust headers (x-test-user-id, x-internal-*) are stripped; legitimate
 *     headers pass through; x-request-id and x-forwarded-* are added.
 *  §3 Raw and multipart bodies pass through byte-for-byte (proves bodyParser:false).
 *  §4 x-request-id is forwarded when supplied and generated when absent.
 *  §5 Management paths (/live) are served locally and never proxied.
 */

import * as http from 'http';
import type { AddressInfo } from 'net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createGatewayApp } from '../src/gateway.factory';

interface CapturedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  rawBodyBase64: string;
  rawBodyLength: number;
}

/** Echo-upstream: reflects every received request back as JSON. */
function startEchoUpstream(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        const payload: CapturedRequest = {
          method: req.method ?? '',
          url: req.url ?? '',
          headers: req.headers,
          rawBodyBase64: raw.toString('base64'),
          rawBodyLength: raw.length,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, port });
    });
  });
}

describe('Gateway reverse proxy (E2E)', () => {
  let upstream: http.Server;
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  beforeAll(async () => {
    const { server, port } = await startEchoUpstream();
    upstream = server;

    // Pass the stub target explicitly — deterministic and independent of when
    // @nestjs/config snapshots process.env.
    const built = await createGatewayApp({
      target: `http://127.0.0.1:${port}`,
      proxyTimeoutMs: 5_000,
    });
    app = built.app;
    await app.init();
    client = request(app.getHttpServer());
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §1 Standard JSON request proxies correctly
  // ──────────────────────────────────────────────────────────────────────────

  describe('§1 JSON proxy', () => {
    it('GW-01 forwards method, path, and JSON body to the upstream', async () => {
      const res = await client
        .post('/api/orders/echo')
        .send({ hello: 'world', n: 42 });

      expect(res.status).toBe(200);
      const captured = res.body as CapturedRequest;
      expect(captured.method).toBe('POST');
      expect(captured.url).toBe('/api/orders/echo');

      const decoded = JSON.parse(
        Buffer.from(captured.rawBodyBase64, 'base64').toString('utf8'),
      );
      expect(decoded).toEqual({ hello: 'world', n: 42 });
      expect(captured.headers['content-type']).toContain('application/json');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §2 Header stripping & forwarding
  // ──────────────────────────────────────────────────────────────────────────

  describe('§2 Header hygiene', () => {
    it('GW-02 strips client-supplied trust headers, keeps legitimate ones', async () => {
      const res = await client
        .get('/api/whoami')
        .set('x-test-user-id', 'attacker-uuid')
        .set('x-internal-jwt', 'forged.jwt.token')
        .set('x-internal-user', 'forged-user')
        .set('x-gateway-authenticated', 'true')
        .set('authorization', 'Bearer legitimate-token')
        .set('x-keep-me', 'yes');

      expect(res.status).toBe(200);
      const { headers } = res.body as CapturedRequest;

      // Stripped at the edge — the monolith must never see these from outside.
      expect(headers['x-test-user-id']).toBeUndefined();
      expect(headers['x-internal-jwt']).toBeUndefined();
      expect(headers['x-internal-user']).toBeUndefined();
      expect(headers['x-gateway-authenticated']).toBeUndefined();

      // Legitimate headers pass through unchanged.
      expect(headers['authorization']).toBe('Bearer legitimate-token');
      expect(headers['x-keep-me']).toBe('yes');

      // Edge-added correlation + forwarding metadata.
      expect(headers['x-request-id']).toBeDefined();
      expect(headers['x-forwarded-host']).toBeDefined();
      expect(headers['x-forwarded-proto']).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §3 Raw / multipart body passthrough (proves bodyParser:false)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§3 Raw body passthrough', () => {
    it('GW-03 forwards a binary octet-stream body byte-for-byte', async () => {
      const raw = Buffer.from([
        0x00, 0x01, 0x02, 0xff, 0xfe, 0x80, 0x7f, 0x10, 0x00, 0xab,
      ]);

      const res = await client
        .post('/api/images/upload')
        .set('Content-Type', 'application/octet-stream')
        .send(raw);

      expect(res.status).toBe(200);
      const captured = res.body as CapturedRequest;
      expect(captured.rawBodyLength).toBe(raw.length);
      expect(captured.rawBodyBase64).toBe(raw.toString('base64'));
      expect(captured.headers['content-type']).toBe('application/octet-stream');
    });

    it('GW-04 forwards a multipart/form-data body untouched (boundary preserved)', async () => {
      const boundary = '----GatewayE2EBoundary7M8N9';
      const body = Buffer.from(
        [
          `--${boundary}`,
          'Content-Disposition: form-data; name="field1"',
          '',
          'value1',
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="a.bin"',
          'Content-Type: application/octet-stream',
          '',
          'rawbytes\x00\x01\x02payload',
          `--${boundary}--`,
          '',
        ].join('\r\n'),
        'binary',
      );

      const res = await client
        .post('/api/images/upload-multipart')
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(body);

      expect(res.status).toBe(200);
      const captured = res.body as CapturedRequest;
      // The gateway must NOT parse/re-serialize multipart — bytes are identical.
      expect(captured.rawBodyBase64).toBe(body.toString('base64'));
      expect(captured.headers['content-type']).toBe(
        `multipart/form-data; boundary=${boundary}`,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §4 Request-id propagation
  // ──────────────────────────────────────────────────────────────────────────

  describe('§4 x-request-id', () => {
    it('GW-05 forwards a client-supplied x-request-id and echoes it', async () => {
      const res = await client
        .get('/api/ping')
        .set('x-request-id', 'client-supplied-id-123');

      expect(res.status).toBe(200);
      expect((res.body as CapturedRequest).headers['x-request-id']).toBe(
        'client-supplied-id-123',
      );
      expect(res.headers['x-request-id']).toBe('client-supplied-id-123');
    });

    it('GW-06 generates an x-request-id when the client omits it', async () => {
      const res = await client.get('/api/ping');

      expect(res.status).toBe(200);
      const upstreamId = (res.body as CapturedRequest).headers['x-request-id'];
      expect(upstreamId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-request-id']).toBe(upstreamId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §5 Management paths are local
  // ──────────────────────────────────────────────────────────────────────────

  describe('§5 Management paths', () => {
    it('GW-07 /live is served by the gateway and never proxied', async () => {
      const res = await client.get('/live');
      expect(res.status).toBe(200);
      // Gateway's own body — not the echo-upstream's CapturedRequest shape.
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
