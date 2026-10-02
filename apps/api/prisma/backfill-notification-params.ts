/**
 * One-off backfill for `Notification.params` (2026-10-02). Rows emitted before that column existed
 * hold only the title/message text rendered in the recipient's language at emit time, so the bell
 * feed can't re-render them when the UI language differs. This reverse-parses each such row's
 * `message` against its event's bn/en catalogue template (`{{token}}` -> capture group), recovers the
 * params, and stores them. Rows that match neither template are left untouched. Idempotent — only
 * touches rows whose `params` is still null.
 *
 * Run: `npx ts-node -r tsconfig-paths/register prisma/backfill-notification-params.ts`
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { notificationBn } from '../src/common/i18n/translations/notification.bn';
import { notificationEn } from '../src/common/i18n/translations/notification.en';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Catalogue = Record<string, { title: string; message: string }>;
const CATALOGUES: Catalogue[] = [
  notificationBn as unknown as Catalogue,
  notificationEn as unknown as Catalogue,
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `{{token}}` placeholders -> lazy capture groups; everything else matched literally. */
function templateToRegex(template: string): { re: RegExp; tokens: string[] } {
  const tokens: string[] = [];
  const source = template
    .split(/(\{\{\w+\}\})/)
    .map((part) => {
      const m = /^\{\{(\w+)\}\}$/.exec(part);
      if (!m) return escapeRe(part);
      tokens.push(m[1]);
      return '(.+?)';
    })
    .join('');
  return { re: new RegExp(`^${source}$`), tokens };
}

function extract(
  eventKey: string,
  message: string,
): Record<string, string | number> | null {
  for (const catalogue of CATALOGUES) {
    const entry = catalogue[eventKey];
    if (!entry) continue;
    const { re, tokens } = templateToRegex(entry.message);
    const match = re.exec(message);
    if (!match) continue;
    const params: Record<string, string | number> = {};
    tokens.forEach((token, i) => {
      const raw = match[i + 1];
      params[token] = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    });
    return params;
  }
  return null;
}

async function main() {
  const rows = await prisma.notification.findMany({
    where: { params: { equals: Prisma.DbNull } },
    select: { id: true, eventKey: true, message: true },
  });
  console.log(`Found ${rows.length} notification(s) without params.`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const params = extract(row.eventKey, row.message);
    if (!params) {
      skipped++;
      continue;
    }
    await prisma.notification.update({
      where: { id: row.id },
      data: { params },
    });
    updated++;
  }
  console.log(`Backfilled ${updated}; left ${skipped} (no template match).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
