/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';

/** Shared plumbing for the DB ops scripts (db-reset.ts / db-deploy.ts). */
export interface DbTarget {
  envFile: string;
  host: string;
  dbName: string;
  isLocal: boolean;
}

export function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

/**
 * Loads `--env-file` (default `.env`) with override, then parses DATABASE_URL.
 * `override: true` matters: a staging run must win over whatever the deploy
 * shell already exported.
 */
export function loadTarget(argv: string[]): DbTarget {
  const envFile = argValue(argv, '--env-file') ?? process.env.SEED_ENV_FILE ?? '.env';
  if (!existsSync(envFile)) {
    console.error(`Env file not found: ${envFile}`);
    process.exit(1);
  }
  dotenv.config({ path: envFile, override: true });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`DATABASE_URL is not set in ${envFile}`);
    process.exit(1);
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    console.error('DATABASE_URL is not a valid URL');
    process.exit(1);
  }

  const dbName = url.pathname.replace(/^\//, '');
  return {
    envFile,
    host: url.host,
    dbName,
    isLocal: ['localhost', '127.0.0.1', '::1'].includes(url.hostname),
  };
}

export function printTarget(target: DbTarget): void {
  console.log(`Target  : ${target.host}/${target.dbName}  (env: ${target.envFile})`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(
    `Demo data: ${
      process.env.SEED_DEMO_DATA ??
      (process.env.NODE_ENV === 'production' ? 'false (NODE_ENV=production default)' : 'true (default)')
    }`,
  );
}

export function run(command: string, args: string[]): void {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\nStep failed (exit ${String(result.status)}). Aborting.`);
    process.exit(result.status ?? 1);
  }
}

export const SEED_ARGS = [
  'exec',
  'ts-node',
  '-r',
  'tsconfig-paths/register',
  'prisma/seed.ts',
];
