/* eslint-disable no-console */
import { argValue, loadTarget, printTarget, run } from './lib/db-target';

/**
 * DESTRUCTIVE: drops every table, replays `prisma/migrations`, then reseeds.
 *
 *   pnpm db:reset                                        # local (.env)
 *   pnpm db:reset:staging --confirm rakhal_staging       # staging (.env.staging)
 *
 * Guard: when DATABASE_URL is not localhost, the reset refuses to run unless
 * CONFIRM_RESET (env var or `--confirm <db>`) exactly matches the target
 * database name. This is the only thing between a typo'd env file and a wiped
 * production DB — do not remove it.
 */
const argv = process.argv.slice(2);
const target = loadTarget(argv);
printTarget(target);

const confirm = argValue(argv, '--confirm') ?? process.env.CONFIRM_RESET;
if (!target.isLocal && confirm !== target.dbName) {
  console.error(
    `\nRefusing to reset a remote database without confirmation.\n` +
      `Re-run with:  pnpm db:reset --env-file ${target.envFile} --confirm ${target.dbName}\n`,
  );
  process.exit(1);
}

// Prisma 7 dropped `--skip-seed`: `migrate reset` always runs the seed command
// declared in prisma.config.ts. That seed subprocess inherits this process's
// env, so the env file's SEED_* overrides apply.
run('pnpm', [
  'exec',
  'prisma',
  'migrate',
  'reset',
  '--force',
  '--config',
  'prisma.config.ts',
]);

console.log('\nReset + seed complete.');
