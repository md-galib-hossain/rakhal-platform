/** Pure logo safety helpers (RPT-11c): tenant-prefix check and image-dimension bomb guard. */

export const LOGO_MAX_DIMENSION = 4096;
export const LOGO_MAX_PIXELS = 16_000_000;

/**
 * Farm-owned object keys are `farms/<farmId>/...` (media module convention, RAKHAL-009).
 * Anything else (other tenant, URL, traversal, odd characters) is not a usable logo key.
 */
export function isFarmOwnedKey(
  key: string | null | undefined,
  farmId: string | null | undefined,
): boolean {
  if (!key || !farmId) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(farmId)) return false;
  if (key.length > 300 || key.includes('..') || key.includes('//')) {
    return false;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9/_\-.]*$/.test(key)) return false;
  const prefix = `farms/${farmId}/`;
  return key.startsWith(prefix) && key.length > prefix.length;
}

/** Reads width/height from a PNG IHDR or JPEG SOF header; null when malformed or unknown. */
export function readImageSize(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    // 8-byte signature, then IHDR chunk: length(4) 'IHDR'(4) width(4) height(4)
    if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (
        marker === 0xd8 ||
        (marker >= 0xd0 && marker <= 0xd7) ||
        marker === 0x01
      ) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        if (i + 9 > buf.length) return null;
        return {
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** True when the image header parses and the size is within the caps. */
export function isSafeImageSize(buf: Buffer): boolean {
  const s = readImageSize(buf);
  if (!s || s.width < 1 || s.height < 1) return false;
  return (
    s.width <= LOGO_MAX_DIMENSION &&
    s.height <= LOGO_MAX_DIMENSION &&
    s.width * s.height <= LOGO_MAX_PIXELS
  );
}
