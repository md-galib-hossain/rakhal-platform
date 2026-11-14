import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * One-off dev-DB fixup (RAKHAL-399 verification): `manager@demo.rakhal.test`/
 * `worker@demo.rakhal.test`'s real password hashes in this shared dev DB no
 * longer matched `ManagerPass123`/`WorkerPass123` — `prisma/seed.ts`'s
 * `seedDemoMember()` intentionally never updates `passwordHash` on an
 * existing user (`update: {}`), so a normal reseed can't fix this. Resets
 * just these two accounts back to their documented demo passwords so e2e/
 * live smoke can log in. Not part of the seed script itself — this is a
 * targeted repair, not standard idempotent seeding behavior.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const accounts = [
    { email: 'owner@demo.rakhal.test', password: 'DemoPass123' },
    { email: 'manager@demo.rakhal.test', password: 'ManagerPass123' },
    { email: 'worker@demo.rakhal.test', password: 'WorkerPass123' },
  ];
  for (const { email, password } of accounts) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await prisma.user.updateMany({
      where: { email },
      data: {
        passwordHash,
        // RAKHAL-399 verification: this session's repeated e2e attempts against
        // the stale password hash tripped the account-lockout guard
        // (`AuthService.isLockActive`) — clear it too, or a reset password
        // alone still gets rejected with the same generic invalid-credentials
        // message.
        isBlocked: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`${email}: ${result.count} row(s) updated`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
