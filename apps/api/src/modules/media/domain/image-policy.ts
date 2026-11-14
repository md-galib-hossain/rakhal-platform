/**
 * Image processing policy (RAKHAL-009). Rakhal accepts only real raster photos
 * and re-encodes everything to JPEG — universal (works in our pdfkit PDF
 * renderer, every browser/webview, and email) and strips any embedded payload.
 */

/** Input formats we accept — validated by *decoding* with Sharp, not by MIME. */
export const ALLOWED_INPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type AllowedFormat = (typeof ALLOWED_INPUT_FORMATS)[number];

export const IMAGE_POLICY = {
  /** Decompression-bomb guard: reject inputs that decode past this pixel count. */
  limitInputPixels: 25_000_000,
  /** Full variant: fit inside a 1600px box, never upscale. */
  full: { maxEdge: 1600, quality: 82 },
  /** Thumb variant: 320px square crop. */
  thumb: { edge: 320, quality: 70 },
  outputFormat: 'jpeg' as const,
  outputContentType: 'image/jpeg',
} as const;

export function isAllowedFormat(format?: string): format is AllowedFormat {
  return (
    typeof format === 'string' &&
    (ALLOWED_INPUT_FORMATS as readonly string[]).includes(format)
  );
}
