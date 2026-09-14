import { Workbook } from 'exceljs';
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-308 — xlsx import: real-state columns. `POST /cattle/import/preview`
 * → `/confirm` now accepts 12 additional columns (production_status,
 * lactation_start_date, estimated_days_in_milk, estimated_lactation_number,
 * is_pregnant, conception_date, expected_calving_date, bcs, weight_kg,
 * source_type, mother_tag, father_tag), mirroring RAKHAL-307's single-intake
 * fields for bulk import. Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle — xlsx import real-state columns (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (prefix: string) =>
    `E2E-308-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const HEADERS = [
    'tag',
    'name',
    'gender',
    'production_status',
    'lactation_start_date',
    'estimated_days_in_milk',
    'estimated_lactation_number',
    'is_pregnant',
    'conception_date',
    'expected_calving_date',
    'bcs',
    'weight_kg',
    'source_type',
    'prior_calvings',
    'mother_tag',
    'father_tag',
  ];

  const buildWorkbook = async (
    rows: (string | number)[][],
  ): Promise<Buffer> => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Cattle');
    sheet.addRow(HEADERS);
    for (const row of rows) sheet.addRow(row);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  };

  const attach = (buffer: Buffer) =>
    request(server())
      .post(api('/cattle/import/preview'))
      .set(...auth(owner))
      .attach('file', buffer, {
        filename: 'cattle.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('imports a milking + pregnant cow with bcs/weight/source_type', async () => {
    const milkTag = tag('MILK');
    const buffer = await buildWorkbook([
      [
        milkTag,
        'Laxmi',
        'FEMALE',
        'MILKING',
        '',
        '30',
        '2',
        'false',
        '',
        '',
        '3.5',
        '380',
        'PURCHASED',
        '2',
        '',
        '',
      ],
    ]);

    const preview = await attach(buffer).expect(201);
    expect(preview.body.data.ready).toBe(1);
    expect(preview.body.data.errors).toBe(0);

    const confirm = await request(server())
      .post(api('/cattle/import/confirm'))
      .set(...auth(owner))
      .send({ importSessionId: preview.body.data.importSessionId })
      .expect(201);
    expect(confirm.body.data.imported).toBe(1);

    const cattle = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: milkTag },
    });
    expect(cattle.productionStatus).toBe('MILKING');
    expect(cattle.sourceType).toBe('PURCHASED');
    expect(Number(cattle.lastBcs)).toBe(3.5);
    expect(Number(cattle.lastWeightKg)).toBe(380);

    const lactation = await prisma.lactation.findFirstOrThrow({
      where: { cattleId: cattle.id },
    });
    expect(lactation.startReason).toBe('PURCHASED_LACTATING');
    expect(lactation.lactationNumber).toBe(2);

    // RD-055 (fixed): `refreshDerivedState`'s `refreshReproductionProfile`
    // now takes MAX(real CalvingEvent count, existing profile value), so the
    // `prior_calvings` seed survives the post-commit recompute instead of
    // being reset to 0.
    const profile = await prisma.reproductionProfile.findFirstOrThrow({
      where: { cattleId: cattle.id },
    });
    expect(profile.totalCalvings).toBe(2);
  });

  it('imports a pregnant (not milking) cow via is_pregnant + expected_calving_date', async () => {
    const pregTag = tag('PREG');
    const expectedCalvingDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const buffer = await buildWorkbook([
      [
        pregTag,
        'Ganga',
        'FEMALE',
        '',
        '',
        '',
        '',
        'true',
        '',
        expectedCalvingDate,
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ]);

    const preview = await attach(buffer).expect(201);
    expect(preview.body.data.ready).toBe(1);

    await request(server())
      .post(api('/cattle/import/confirm'))
      .set(...auth(owner))
      .send({ importSessionId: preview.body.data.importSessionId })
      .expect(201);

    const cattle = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: pregTag },
    });
    const diagnosis = await prisma.pregnancyDiagnosis.findFirstOrThrow({
      where: { cattleId: cattle.id },
    });
    expect(diagnosis.diagnosisMethod).toBe('PURCHASE_INTAKE');
    const pregnancy = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cattle.id },
    });
    expect(pregnancy.status).toBe('ACTIVE');
  });

  it('resolves mother_tag/father_tag in a second pass, forward references included', async () => {
    const motherTag = tag('MOTHER');
    const fatherTag = tag('FATHER');
    const calfTag = tag('CALF');

    // Calf row (references mother/father) is listed BEFORE its parents, to
    // prove the second pass handles forward references.
    const buffer = await buildWorkbook([
      [
        calfTag,
        'Calf',
        'FEMALE',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        motherTag,
        fatherTag,
      ],
      [
        motherTag,
        'Mother',
        'FEMALE',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        fatherTag,
        'Father',
        'MALE',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ]);

    const preview = await attach(buffer).expect(201);
    expect(preview.body.data.ready).toBe(3);

    await request(server())
      .post(api('/cattle/import/confirm'))
      .set(...auth(owner))
      .send({ importSessionId: preview.body.data.importSessionId })
      .expect(201);

    const calf = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: calfTag },
    });
    const mother = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: motherTag },
    });
    const father = await prisma.cattle.findFirstOrThrow({
      where: { tagNumber: fatherTag },
    });
    expect(calf.motherId).toBe(mother.id);
    expect(calf.fatherId).toBe(father.id);
  });

  it('names the column and row number on an invalid real-state value, and one bad row does not abort the rest', async () => {
    const goodTag = tag('GOOD');
    const badTag = tag('BAD');
    const buffer = await buildWorkbook([
      [
        goodTag,
        'Good',
        'FEMALE',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        badTag,
        'Bad',
        'FEMALE',
        'NOT_A_STATUS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ]);

    const preview = await attach(buffer).expect(201);
    expect(preview.body.data.ready).toBe(1);
    expect(preview.body.data.errors).toBe(1);
    const badRow = preview.body.data.rows.find(
      (r: { tag: string }) => r.tag === badTag,
    );
    expect(badRow.status).toBe('error');
    // `row` numbers data rows (1 = first row after the header), not the
    // sheet's own row index — same pre-existing convention `prior_calvings`
    // and every other column already used before this ticket.
    expect(badRow.row).toBe(2);
    expect(badRow.error).toContain('production_status');

    const confirm = await request(server())
      .post(api('/cattle/import/confirm'))
      .set(...auth(owner))
      .send({
        importSessionId: preview.body.data.importSessionId,
        skipErrors: true,
      })
      .expect(201);
    expect(confirm.body.data.imported).toBe(1);
    expect(confirm.body.data.skipped).toBe(1);

    const good = await prisma.cattle.findFirst({
      where: { tagNumber: goodTag },
    });
    expect(good).not.toBeNull();
    const bad = await prisma.cattle.findFirst({ where: { tagNumber: badTag } });
    expect(bad).toBeNull();
  });

  it('downloads the import template as a valid xlsx', async () => {
    const res = await request(server())
      .get(api('/cattle/import/template'))
      .set(...auth(owner))
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');

    const workbook = new Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    expect(headerRow.getCell(1).text).toBe('tag');
  });
});
