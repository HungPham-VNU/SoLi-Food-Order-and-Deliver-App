/**
 * export-openapi.ts
 *
 * Generates the merged public OpenAPI document (NestJS controllers + Better
 * Auth paths) WITHOUT starting an HTTP listener, and writes it to disk.
 *
 * It mirrors the document assembled in src/main.ts exactly (same global prefix,
 * same DocumentBuilder, same Better Auth merge) so the frozen baseline is byte-
 * comparable to what `/api-spec.json` serves at runtime.
 *
 * Usage:
 *   tsx scripts/export-openapi.ts [outputPath]
 *     outputPath defaults to openapi/api-spec.baseline.json
 *
 * Requires the same environment as booting the app (DATABASE_URL etc.), because
 * NestFactory instantiates the DI container. In CI run it after the DB is up.
 *
 * Phase 0: used to (1) freeze the public API baseline and (2) produce the
 * current spec that the CI breaking-change gate (oasdiff) compares against it.
 */
import 'reflect-metadata';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { auth } from '../src/lib/auth';

async function main(): Promise<void> {
  const outputPath = resolve(
    process.argv[2] ?? 'openapi/api-spec.baseline.json',
  );

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: true,
  });
  app.setGlobalPrefix('api');

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

  const mergedDoc: OpenAPIObject = {
    ...nestDoc,
    paths: {
      ...nestDoc.paths,
      ...prefixedAuthPaths,
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

  mkdirSync(dirname(outputPath), { recursive: true });
  // Stable 2-space JSON with trailing newline so diffs are minimal and the file
  // is git-friendly.
  writeFileSync(outputPath, JSON.stringify(mergedDoc, null, 2) + '\n', 'utf-8');

  // eslint-disable-next-line no-console
  console.log(
    `OpenAPI written to ${outputPath} ` +
      `(${Object.keys(mergedDoc.paths ?? {}).length} paths).`,
  );

  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to export OpenAPI:', err);
    process.exit(1);
  });
