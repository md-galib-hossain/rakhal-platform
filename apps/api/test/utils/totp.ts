import { AdminTotpService } from '../../src/modules/admin/application/services/admin-totp.service';

/** The demo platform-admin's fixed dev/test TOTP secret (mirrors `prisma/seed.ts`). */
export const DEMO_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

const totp = new AdminTotpService();

/** Computes a live 6-digit TOTP code for a secret — for e2e admin-login calls. */
export function currentTotpCode(
  secret: string = DEMO_ADMIN_TOTP_SECRET,
): string {
  return totp.currentCode(secret);
}
