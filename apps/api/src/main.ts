import { shutdownTelemetry } from './telemetry';
import { recordException } from './observability/errors';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { auth } from './lib/auth';
import { AppModule } from './app.module';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { join } from 'path';
import * as expressStatic from 'express';
import { createCorsOptions } from './observability/cors';
import { JsonLogger } from './observability/json-logger';
import { requestContextMiddleware } from './observability/request-context';

function installShutdownHandler(app: INestApplication): void {
  let shutdownStarted = false;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      if (shutdownStarted) return;
      shutdownStarted = true;

      void (async () => {
        try {
          await app.close();
          await shutdownTelemetry(signal);
          process.exit(0);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: 'error',
              timestamp: new Date().toISOString(),
              event: 'app.shutdown_failed',
              signal,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
          await shutdownTelemetry(`${signal}:failed`);
          process.exit(1);
        }
      })();
    });
  }
}

function installUncaughtHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    recordException(error, { source: 'uncaughtException' });
    console.error(
      JSON.stringify({
        level: 'fatal',
        timestamp: new Date().toISOString(),
        event: 'process.uncaught_exception',
        message: error.message,
        stack: error.stack,
      }),
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    recordException(error, { source: 'unhandledRejection' });
    console.error(
      JSON.stringify({
        level: 'fatal',
        timestamp: new Date().toISOString(),
        event: 'process.unhandled_rejection',
        message: error.message,
        stack: error.stack,
      }),
    );
    process.exit(1);
  });
}

async function bootstrap() {
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(logger);
  app.use(requestContextMiddleware);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix('api');

  app.enableCors(createCorsOptions());

  // Serve static development assets (FCM test page, service worker, etc.)
  // from the apps/api/public/ directory.
  //
  // express.static middleware is intentionally registered WITHOUT a path prefix
  // so that:
  //  1. /fcm-test.html is accessible at http://localhost:3000/fcm-test.html
  //  2. /firebase-messaging-sw.js is accessible at http://localhost:3000/firebase-messaging-sw.js
  //     (Service workers MUST be served from the origin root, not from /api/*)
  //
  // Note: app.setGlobalPrefix('api') only applies to NestJS route handlers,
  // not to express middleware, so these static files remain at the root path.
  //
  // __dirname resolves to src/ (dev) or dist/ (prod) — both one level above public/.
  app.use(expressStatic.static(join(__dirname, '..', 'public')));
  const config = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const nestDoc = SwaggerModule.createDocument(app, config);
  const betterAuthDoc = await (
    auth.api.generateOpenAPISchema() as Promise<Partial<OpenAPIObject>>
  ).catch((): Partial<OpenAPIObject> => ({ paths: {}, components: {} }));
  const prefixedAuthPaths = Object.fromEntries(
    Object.entries(betterAuthDoc.paths ?? {}).map(([path, value]) => [
      `/api/auth${path}`,
      value,
    ]),
  );
  const mergedDoc = {
    ...nestDoc,
    paths: {
      ...nestDoc.paths,
      ...(prefixedAuthPaths ?? {}),
    },
    components: {
      ...nestDoc.components,
      schemas: {
        ...nestDoc.components?.schemas,
        ...(betterAuthDoc.components?.schemas ?? {}),
      },
      securitySchemes: {
        ...nestDoc.components?.securitySchemes,
        ...(betterAuthDoc.components?.securitySchemes ?? {}),
      },
    },
    tags: [...(nestDoc.tags ?? []), ...(betterAuthDoc.tags ?? [])],
  };

  app.use('/api-spec.json', (_req: Request, res: Response) => {
    res.json(mergedDoc);
  });

  app.use(
    '/docs',
    apiReference({
      url: '/api-spec.json',
      theme: 'default', // 'default' | 'moon' | 'purple' | 'solarized' etc.
      layout: 'modern',
    }),
  );

  installShutdownHandler(app);

  await app.listen(process.env.PORT ?? 3000);
}

installUncaughtHandlers();
// eslint-disable-next-line
bootstrap();
