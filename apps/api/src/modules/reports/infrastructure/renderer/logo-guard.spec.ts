import { isFarmOwnedKey, isSafeImageSize, readImageSize } from './logo-guard';

function png(w: number, h: number, len = 33): Buffer {
  const b = Buffer.alloc(len);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  if (len >= 24) {
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
  }
  return b;
}

function jpeg(w: number, h: number): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    h >> 8,
    h & 0xff,
    w >> 8,
    w & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ]);
}

describe('isFarmOwnedKey', () => {
  it('accepts only farms/<farmId>/...', () => {
    expect(isFarmOwnedKey('farms/f1/a/full.jpg', 'f1')).toBe(true);
    expect(isFarmOwnedKey('farms/f2/a/full.jpg', 'f1')).toBe(false);
    expect(isFarmOwnedKey('farms/f10/a.jpg', 'f1')).toBe(false);
    expect(isFarmOwnedKey('http://x/farms/f1/a.jpg', 'f1')).toBe(false);
    expect(isFarmOwnedKey('farms/f1/../f2/a.jpg', 'f1')).toBe(false);
    expect(isFarmOwnedKey('farms/f1/', 'f1')).toBe(false);
    expect(isFarmOwnedKey('farms/f1/a.jpg', null)).toBe(false);
    expect(isFarmOwnedKey('farms/f1/a.jpg', 'f1/../x')).toBe(false);
  });
});

describe('image size guard', () => {
  it('reads a valid PNG and JPEG', () => {
    expect(readImageSize(png(200, 100))).toEqual({ width: 200, height: 100 });
    expect(readImageSize(jpeg(640, 480))).toEqual({ width: 640, height: 480 });
    expect(isSafeImageSize(png(200, 100))).toBe(true);
    expect(isSafeImageSize(jpeg(640, 480))).toBe(true);
  });

  it('rejects huge dimensions and megapixel overflow', () => {
    expect(isSafeImageSize(png(60000, 60000))).toBe(false);
    expect(isSafeImageSize(png(4097, 10))).toBe(false);
    expect(isSafeImageSize(png(4096, 4096))).toBe(false);
    expect(isSafeImageSize(jpeg(65535, 65535))).toBe(false);
  });

  it('rejects truncated, zero-size and malformed headers', () => {
    expect(isSafeImageSize(png(10, 10, 20))).toBe(false);
    expect(isSafeImageSize(png(0, 10))).toBe(false);
    expect(isSafeImageSize(jpeg(10, 10).subarray(0, 14))).toBe(false);
    expect(isSafeImageSize(Buffer.from([0xff, 0xd8, 0x00, 0x00]))).toBe(false);
    expect(isSafeImageSize(Buffer.from('<svg></svg>'))).toBe(false);
  });
});
