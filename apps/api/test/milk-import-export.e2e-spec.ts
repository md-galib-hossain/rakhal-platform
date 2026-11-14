import request from 'supertest';
import { Workbook } from 'exceljs';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * Milk log UX overhaul (no ticket #, 2026-08-02): covers the 3 new behaviors —
 * (1) editing an already-`submitted` entry now reconciles the tank balance
 * instead of silently drifting (`MilkService.saveLog`'s reconciliation block),
 * (2) Excel (.xlsx) import preview → confirm, (3) Excel export. Requires the
 * dev stack up + `pnpm seed`.
 */
describe('Milk log — edit reconciliation + Excel import/export (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let cattleId: string;
  let tag: string;
  let tankId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const futureDate = (offsetDays: number): string =>
    new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const probeDate = futureDate(6000 + Math.floor(Math.random() * 500));
    const logTable = await request(server())
      .get(api(`/milk/log?date=${probeDate}`))
      .set(...bearer(owner))
      .expect(200);
    const eligible = (
      logTable.body.data.entries as Array<{
        cattleId: string;
        tag: string;
        withholding: boolean;
      }>
    ).find((e) => !e.withholding);
    if (!eligible) {
      throw new Error(
        'No non-withheld milking cow found in demo data — did you run `pnpm seed`?',
      );
    }
    cattleId = eligible.cattleId;
    tag = eligible.tag;

    const created = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...bearer(owner))
      .send({
        name: `E2E-MILK-XLSX-${Date.now()}`,
        tankType: 'SELLABLE',
        totalCapacityL: 5000,
      })
      .expect(201);
    tankId = created.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('submitted-entry edit reconciles the tank balance', () => {
    it('reverses the old delta and applies the new one', async () => {
      const testDate = futureDate(6100 + Math.floor(Math.random() * 500));
      const session = 'MORNING';

      await request(server())
        .post(api('/milk/log'))
        .set(...bearer(owner))
        .send({
          date: testDate,
          session,
          entries: [{ cattleId, yieldL: 5, tankId }],
        })
        .expect(201);
      await request(server())
        .post(api('/milk/submit'))
        .set(...bearer(owner))
        .send({ date: testDate, session })
        .expect(201);

      const before = await request(server())
        .get(api(`/inventory/milk-tanks/${tankId}`))
        .set(...bearer(owner))
        .expect(200);

      await request(server())
        .post(api('/milk/log'))
        .set(...bearer(owner))
        .send({
          date: testDate,
          session,
          entries: [
            { cattleId, yieldL: 8, tankId, editReason: 'corrected misread' },
          ],
        })
        .expect(201);

      const after = await request(server())
        .get(api(`/inventory/milk-tanks/${tankId}`))
        .set(...bearer(owner))
        .expect(200);
      // +5 at submit, then a +3 net reconciliation (reverse -5, apply +8).
      expect(after.body.data.currentVolumeL).toBeCloseTo(
        before.body.data.currentVolumeL + 3,
        1,
      );

      const logTable = await request(server())
        .get(api(`/milk/log?date=${testDate}`))
        .set(...bearer(owner))
        .expect(200);
      const row = (
        logTable.body.data.entries as Array<{
          cattleId: string;
          log: { morningL: number | null };
        }>
      ).find((e) => e.cattleId === cattleId);
      expect(row?.log.morningL).toBe(8);
    });
  });

  describe('Excel import (preview → confirm)', () => {
    const buildWorkbook = async (rows: string[][]): Promise<Buffer> => {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Milk');
      sheet.addRow([
        'Date',
        'Cow Tag',
        'Morning',
        'Noon',
        'Evening',
        'Night',
        'Tank',
      ]);
      for (const row of rows) sheet.addRow(row);
      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    };

    it('previews valid + invalid rows, then confirms the ready ones', async () => {
      const importDate = futureDate(6200 + Math.floor(Math.random() * 500));
      const buffer = await buildWorkbook([
        [importDate, tag, '6', '', '', '', ''],
        [importDate, 'NOT-A-REAL-TAG', '5', '', '', '', ''],
      ]);

      const preview = await request(server())
        .post(api('/milk/import/preview'))
        .set(...bearer(owner))
        .attach('file', buffer, {
          filename: 'milk.xlsx',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(preview.body.data.total).toBe(2);
      expect(preview.body.data.ready).toBe(1);
      expect(preview.body.data.errors).toBe(1);
      const errorRow = (
        preview.body.data.rows as Array<{ status: string; error?: string }>
      ).find((r) => r.status === 'error');
      expect(errorRow?.error).toMatch(/Unknown cow tag/);

      await request(server())
        .post(api('/milk/import/confirm'))
        .set(...bearer(owner))
        .send({ importSessionId: preview.body.data.importSessionId })
        .expect(400);

      const confirm = await request(server())
        .post(api('/milk/import/confirm'))
        .set(...bearer(owner))
        .send({
          importSessionId: preview.body.data.importSessionId,
          skipErrors: true,
        })
        .expect(201);
      expect(confirm.body.data.imported).toBe(1);
      expect(confirm.body.data.skipped).toBe(1);

      const logTable = await request(server())
        .get(api(`/milk/log?date=${importDate}`))
        .set(...bearer(owner))
        .expect(200);
      const row = (
        logTable.body.data.entries as Array<{
          cattleId: string;
          log: { morningL: number | null };
        }>
      ).find((e) => e.cattleId === cattleId);
      expect(row?.log.morningL).toBe(6);
    });

    it('400s confirming an unknown/expired import session', async () => {
      await request(server())
        .post(api('/milk/import/confirm'))
        .set(...bearer(owner))
        .send({ importSessionId: 'not-a-real-session' })
        .expect(400);
    });
  });

  describe('Excel export', () => {
    it('returns a workbook with the expected wide-format row', async () => {
      const exportDate = futureDate(6300 + Math.floor(Math.random() * 500));
      await request(server())
        .post(api('/milk/log'))
        .set(...bearer(owner))
        .send({
          date: exportDate,
          session: 'MORNING',
          entries: [{ cattleId, yieldL: 7 }],
        })
        .expect(201);

      const res = await request(server())
        .post(api('/milk/export'))
        .set(...bearer(owner))
        .send({ from: exportDate, to: exportDate, cattleIds: [cattleId] })
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

      const workbook = new Workbook();
      await workbook.xlsx.load(res.body);
      const sheet = workbook.worksheets[0];
      const dataRow = sheet.getRow(2);
      expect(dataRow.getCell(1).text).toBe(exportDate);
      expect(dataRow.getCell(2).text).toBe(tag);
      expect(Number(dataRow.getCell(4).value)).toBe(7);
    });
  });
});
