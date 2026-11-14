/**
 * Writes the OpenAPI documents the monorepo generates typed clients from.
 *
 *   pnpm gen:openapi         regenerate openapi/*.json
 *   pnpm gen:openapi:check   fail (exit 1) if the committed files are stale (CI drift check)
 *
 * Runs from the BUILT output (`nest build` first) on purpose: the @nestjs/swagger compiler plugin that
 * turns DTO classes into schemas only runs during `nest build`, so a ts-node run would emit empty schemas.
 *
 * Uses Nest's `preview` mode: the module graph is scanned for controller metadata but no provider is
 * instantiated, so this needs no database, Redis or network. It still needs the validated environment
 * variables to be present (src/core/config/env/env.ts runs at import time), the same dummy set CI uses.
 *
 * Two files, split by surface (ADR-016): customer-api and admin-api. Both carry the full
 * `components.schemas` so every `$ref` resolves; clients only emit what their paths reference.
 */
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module';

// Keep in sync with src/main.ts (`setGlobalPrefix`). These stay un-prefixed there.
const UNPREFIXED = ['health', 'ready', 'live', 'metrics'];

const OUT_DIR = join(process.cwd(), 'openapi');

/** Deep key sort so output does not depend on module discovery order. Arrays keep their order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(src)
        .sort()
        .map((k) => [k, sortKeys(src[k])]),
    );
  }
  return value;
}

function serialize(doc: OpenAPIObject): string {
  return JSON.stringify(sortKeys(doc), null, 2) + '\n';
}

function pick(
  doc: OpenAPIObject,
  keep: (path: string) => boolean,
  title: string,
): OpenAPIObject {
  return {
    ...doc,
    info: { ...doc.info, title },
    paths: Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => keep(path)),
    ),
  };
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string };

  const app = await NestFactory.create(AppModule, {
    preview: true,
    abortOnError: false,
    logger: ['error'],
  });
  app.setGlobalPrefix(apiPrefix, {
    exclude: UNPREFIXED.map((path) => ({ path, method: RequestMethod.GET })),
  });

  const config = new DocumentBuilder()
    .setTitle('Rakhal API')
    .setDescription('Rakhal dairy-farm operations backend')
    // Fixed (package.json) rather than APP_VERSION so the output does not change with the environment.
    .setVersion(pkg.version)
    .addBearerAuth()
    .build();
  const full = SwaggerModule.createDocument(app, config);

  const adminPrefix = `/${apiPrefix}/admin`;
  const isAdmin = (p: string) =>
    p === adminPrefix || p.startsWith(`${adminPrefix}/`);

  const outputs: Record<string, string> = {
    'customer-api.json': serialize(
      pick(full, (p) => !isAdmin(p), 'Rakhal customer API'),
    ),
    'admin-api.json': serialize(pick(full, isAdmin, 'Rakhal admin API')),
  };

  const counts = Object.fromEntries(
    Object.entries(outputs).map(([name, text]) => [
      name,
      Object.keys((JSON.parse(text) as OpenAPIObject).paths).length,
    ]),
  );

  if (check) {
    const stale = Object.entries(outputs)
      .filter(([name, text]) => {
        const file = join(OUT_DIR, name);
        if (!existsSync(file)) return true;
        return readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text;
      })
      .map(([name]) => name);
    if (stale.length > 0) {
      console.error(
        `OpenAPI drift: ${stale.join(', ')} out of date. Run "pnpm gen:openapi" and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`OpenAPI up to date (${JSON.stringify(counts)} paths).`);
    process.exit(0);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, text] of Object.entries(outputs)) {
    writeFileSync(join(OUT_DIR, name), text, 'utf8');
  }
  console.log(`Wrote openapi/*.json (${JSON.stringify(counts)} paths).`);
  // Preview mode holds no connections; exit explicitly so nothing keeps the process alive.
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
