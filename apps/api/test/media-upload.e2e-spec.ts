import request from 'supertest';
import sharp from 'sharp';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';

/**
 * RAKHAL-009 — image upload service (cattle profile photo consumer). Proves the
 * production-grade guarantees: **auth required** (401 unauth, 403 without the
 * entity permission), Sharp **validation** (a non-image is 400), a real image is
 * processed + attached + presigned-URL served, embedded in the cattle detail, and
 * removable. Runs against the **in-memory** storage adapter (`NODE_ENV=test`), so
 * it never touches the real R2 bucket.
 */
interface MediaUrls {
  asset_id: string;
  thumb_url: string;
  full_url: string | null;
  width: number | null;
  height: number | null;
}

describe('Media / image upload (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let cattleId: string;
  let uploadedAssetId: string;
  let png: Buffer;

  const photoPath = () => `${ctx.prefix}/cattle/${cattleId}/photo`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    // A tall PNG so we can prove Sharp downscales it to the 1600px policy box.
    png = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 20, g: 130, b: 90 },
      },
    })
      .png()
      .toBuffer();

    const cattle = await prisma.cattle.findFirst({
      where: { farmId: owner.farmId, herdStatus: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!cattle) throw new Error('no demo cattle — run `pnpm seed`');
    cattleId = cattle.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.cattle.updateMany({
      where: { farmId: owner.farmId },
      data: { profilePhotoAssetId: null },
    });
    await prisma.mediaAsset.deleteMany({ where: { farmId: owner.farmId } });
    await ctx.app.close();
  });

  it('rejects an unauthenticated upload (401)', async () => {
    await request(ctx.app.getHttpServer())
      .post(photoPath())
      .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
      .expect(401);
  });

  it('a worker cannot set a cattle photo — lacks cattle.update (403)', async () => {
    await request(ctx.app.getHttpServer())
      .post(photoPath())
      .set(...bearer(worker))
      .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
      .expect(403);
  });

  it('rejects a non-image file (400) — Sharp validates by decoding', async () => {
    await request(ctx.app.getHttpServer())
      .post(photoPath())
      .set(...bearer(owner))
      .attach('file', Buffer.from('this is definitely not an image'), {
        filename: 'evil.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('owner uploads a photo → processed, downscaled, attached (201)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(photoPath())
      .set(...bearer(owner))
      .attach('file', png, { filename: 'cow.png', contentType: 'image/png' })
      .expect(201);

    const data = (res.body as { data: MediaUrls }).data;
    expect(data.asset_id).toBeTruthy();
    expect(data.thumb_url).toBeTruthy();
    expect(data.full_url).toBeTruthy();
    // Downscaled into the 1600px box (2400×1800 → 1600×1200).
    expect(data.width).toBe(1600);
    expect(data.height).toBe(1200);
    uploadedAssetId = data.asset_id;

    // The asset landed READY and JPEG (re-encoded from the PNG input).
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: uploadedAssetId },
    });
    expect(asset?.status).toBe('READY');
    expect(asset?.contentType).toBe('image/jpeg');
    expect(asset?.detectedFormat).toBe('png');
  });

  it('cattle detail embeds the profile photo', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/cattle/${cattleId}`)
      .set(...bearer(owner))
      .expect(200);
    const data = (res.body as { data: { profile_photo: MediaUrls | null } })
      .data;
    expect(data.profile_photo?.asset_id).toBe(uploadedAssetId);
    expect(data.profile_photo?.thumb_url).toBeTruthy();
  });

  it('GET /media/:id/url returns a fresh presigned URL (media.read)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/media/${uploadedAssetId}/url`)
      .set(...bearer(owner))
      .expect(200);
    const data = (res.body as { data: MediaUrls }).data;
    expect(data.thumb_url).toBeTruthy();
    expect(data.full_url).toBeTruthy();
  });

  it('replacing the photo soft-deletes the previous asset', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(photoPath())
      .set(...bearer(owner))
      .attach('file', png, { filename: 'cow2.png', contentType: 'image/png' })
      .expect(201);
    const newId = (res.body as { data: MediaUrls }).data.asset_id;
    expect(newId).not.toBe(uploadedAssetId);

    const previous = await prisma.mediaAsset.findUnique({
      where: { id: uploadedAssetId },
    });
    expect(previous?.status).toBe('DELETED');
    uploadedAssetId = newId;
  });

  it('DELETE /cattle/:id/photo removes it (404 afterwards)', async () => {
    await request(ctx.app.getHttpServer())
      .delete(photoPath())
      .set(...bearer(owner))
      .expect(200);

    await request(ctx.app.getHttpServer())
      .get(photoPath())
      .set(...bearer(owner))
      .expect(404);
  });
});
