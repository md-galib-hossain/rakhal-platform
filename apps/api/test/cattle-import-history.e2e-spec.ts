import { Workbook } from 'exceljs';
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-483: the xlsx import accepts the same "her history" columns as
 * `history[]` on POST /cattle (last_calving_*, last_breeding_*, months_pregnant,
 * last_vaccination_*), recorded as HISTORICAL events in each row's transaction.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle xlsx import: history columns (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  const run = Date.now();
  const auth = (): [string, string] => [
    'Authorization',
    `Bearer ${owner.token}`,
  ];
  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const HEADERS = [
    'tag',
    'gender',
    'date_of_birth',
    'last_calving_date',
    'last_calving_number',
    'last_breeding_date',
    'last_breeding_method',
    'months_pregnant',
    'last_vaccination_date',
    'last_vaccination_product',
  ];

  const buildXlsx = async (rows: (string | number)[][]) => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Cattle');
    sheet.addRow(HEADERS);
    for (const r of rows) sheet.addRow(r);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  };
  const preview = async (rows: (string | number)[][]) =>
    request(server())
      .post(api('/cattle/import/preview'))
      .set(...auth())
      .attach('file', await buildXlsx(rows), {
        filename: 'cattle.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('imports last calving, last AI, months pregnant and last vaccination as HISTORICAL events', async () => {
    const a = `E2E-483I-A-${run}`;
    const b = `E2E-483I-B-${run}`;
    const res = await preview([
      [
        a,
        'FEMALE',
        '2022-01-01',
        '2026-06-10',
        2,
        '',
        '',
        3,
        '2026-08-01',
        'FMD',
      ],
      [b, 'FEMALE', '2022-01-01', '', '', '2026-10-01', 'AI', '', '', ''],
    ]);
    expect(res.body.data.ready).toBe(2);
    await request(server())
      .post(api('/cattle/import/confirm'))
      .set(...auth())
      .send({ importSessionId: res.body.data.importSessionId })
      .expect(201);

    const cowA = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: a },
    });
    const eventsA = await prisma.animalEvent.findMany({
      where: { cattleId: cowA.id },
    });
    expect(eventsA.map((e) => e.type).sort()).toEqual([
      'CALVING',
      'PREG_CHECK',
      'VACCINATION',
    ]);
    expect(eventsA.every((e) => e.provenance === 'HISTORICAL')).toBe(true);
    expect(await prisma.expense.count({ where: { cattleId: cowA.id } })).toBe(
      0,
    );
    const profileA = await prisma.reproductionProfile.findUniqueOrThrow({
      where: { cattleId: cowA.id },
    });
    expect(profileA.reproductiveStatus).toBe('PREGNANT');

    const cowB = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: b },
    });
    const breeding = await prisma.animalEvent.findFirstOrThrow({
      where: { cattleId: cowB.id, type: 'BREEDING' },
    });
    expect(breeding.provenance).toBe('HISTORICAL');
    const profileB = await prisma.reproductionProfile.findUniqueOrThrow({
      where: { cattleId: cowB.id },
    });
    expect(profileB.reproductiveStatus).toBe('BRED_AWAITING_CONFIRMATION');
  });

  it('rejects a bad history cell with a row error', async () => {
    const res = await preview([
      [
        `E2E-483I-BAD-${run}`,
        'FEMALE',
        '2022-01-01',
        'not-a-date',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        `E2E-483I-BAD2-${run}`,
        'FEMALE',
        '2022-01-01',
        '',
        '',
        '2026-10-01',
        'LASER',
        '',
        '',
        '',
      ],
      [
        `E2E-483I-BAD3-${run}`,
        'FEMALE',
        '2022-01-01',
        '',
        '',
        '',
        '',
        12,
        '',
        '',
      ],
    ]);
    expect(res.body.data.errors).toBe(3);
    expect(res.body.data.ready).toBe(0);
  });
});
