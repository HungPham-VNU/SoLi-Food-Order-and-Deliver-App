/**
 * security-phase0.e2e-spec.ts — Phase 0 security-regression E2E
 *
 * Proves the fail-closed environment gating added in Phase 0 at the HTTP layer:
 *
 *  §A  DevOnlyGuard — /api/notifications/test/{push,email}
 *      - production NODE_ENV  → 404 (route fenced off, no existence leak)
 *      - test NODE_ENV        → reaches the handler (NOT 404)
 *
 *  §B  x-test-user-id is inert on session-guarded routes
 *      - Even in production, supplying x-test-user-id without a real Bearer
 *        token must NOT grant access to a @Session()-protected route.
 *      (The precise fail-closed gate on the synthetic-user middleware itself is
 *       unit-tested in src/lib/dev-test-user.middleware.spec.ts, because the
 *       Better Auth session guard masks req.user over HTTP and a black-box
 *       request cannot isolate the middleware's effect.)
 *
 * Mechanism:
 *  ConfigModule captures NODE_ENV at module-compile time, so we boot one app
 *  with NODE_ENV='production' and one with NODE_ENV='test' by toggling the env
 *  var around Test.createTestingModule(...).compile(). The apps connect to the
 *  same E2E database but these tests never read or mutate domain tables.
 *
 * Phase: 0 — Baseline, security fixes, and ADRs
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { requestContextMiddleware } from '../../src/observability/request-context';

/**
 * Boots a fully-initialised Nest app with a specific NODE_ENV baked into its
 * ConfigService. NODE_ENV is restored immediately after compile so it does not
 * leak into other suites running in the same worker.
 */
async function createAppWithNodeEnv(nodeEnv: string): Promise<INestApplication> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.use(requestContextMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
    return app;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

const VALID_TEST_PUSH_BODY = {
  token: 'fake-fcm-token-for-e2e',
  title: 'E2E Test',
  body: 'hello',
};
const VALID_TEST_EMAIL_BODY = {
  to: 'dev@example.com',
  subject: 'E2E Test',
  body: 'hello',
};

describe('Phase 0 security regression (E2E)', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // §A  DevOnlyGuard fences off the notification test endpoints
  // ──────────────────────────────────────────────────────────────────────────

  describe('§A DevOnlyGuard on /notifications/test/*', () => {
    describe('NODE_ENV=production', () => {
      let app: INestApplication;
      let http: ReturnType<typeof request>;

      beforeAll(async () => {
        app = await createAppWithNodeEnv('production');
        http = request(app.getHttpServer());
      }, 60_000);

      afterAll(async () => {
        await app.close();
      });

      it('SEC-01 POST /notifications/test/push returns 404 in production', async () => {
        const res = await http
          .post('/api/notifications/test/push')
          .send(VALID_TEST_PUSH_BODY);
        expect(res.status).toBe(404);
      });

      it('SEC-02 POST /notifications/test/email returns 404 in production', async () => {
        const res = await http
          .post('/api/notifications/test/email')
          .send(VALID_TEST_EMAIL_BODY);
        expect(res.status).toBe(404);
      });
    });

    describe('NODE_ENV=test', () => {
      let app: INestApplication;
      let http: ReturnType<typeof request>;

      beforeAll(async () => {
        app = await createAppWithNodeEnv('test');
        http = request(app.getHttpServer());
      }, 60_000);

      afterAll(async () => {
        await app.close();
      });

      it('SEC-03 POST /notifications/test/push reaches the handler (not 404) in test', async () => {
        const res = await http
          .post('/api/notifications/test/push')
          .send(VALID_TEST_PUSH_BODY);
        // The guard allows the request through in dev/test; the handler (stub
        // FCM provider) responds 200/201, or validation responds 400/422 — any
        // of these proves the route was NOT fenced off.
        expect(res.status).not.toBe(404);
      });

      it('SEC-04 POST /notifications/test/email reaches the handler (not 404) in test', async () => {
        const res = await http
          .post('/api/notifications/test/email')
          .send(VALID_TEST_EMAIL_BODY);
        expect(res.status).not.toBe(404);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §B  x-test-user-id never substitutes for a real session
  // ──────────────────────────────────────────────────────────────────────────

  describe('§B x-test-user-id is inert on session-guarded routes', () => {
    let app: INestApplication;
    let http: ReturnType<typeof request>;

    beforeAll(async () => {
      app = await createAppWithNodeEnv('production');
      http = request(app.getHttpServer());
    }, 60_000);

    afterAll(async () => {
      await app.close();
    });

    it('SEC-05 GET /notifications/my with x-test-user-id but no token returns 401 in production', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set('x-test-user-id', '11111111-1111-4111-8111-111111111111');
      expect(res.status).toBe(401);
    });
  });
});
