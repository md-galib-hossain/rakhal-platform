import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Hand-rolled RFC 6238 TOTP (30s step, 6 digits, HMAC-SHA1) — no `otplib`
 * dependency, matching the codebase's preference for zero-dep crypto (see the
 * FCM push JWT + i18n service). RAKHAL-225: mandatory platform-admin 2FA.
 */
@Injectable()
export class AdminTotpService {
  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  buildOtpAuthUrl(email: string, secretBase32: string): string {
    const label = encodeURIComponent(`Rakhal Admin:${email}`);
    const issuer = encodeURIComponent('Rakhal');
    return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
  }

  /** Computes the current live code for a secret — used by tests/dev tooling only. */
  currentCode(secretBase32: string): string {
    return this.hotp(
      secretBase32,
      Math.floor(Date.now() / 1000 / STEP_SECONDS),
    );
  }

  private hotp(secretBase32: string, counter: number): string {
    const key = base32Decode(secretBase32);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const code = (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
    return code;
  }

  /** Verifies a 6-digit code against a ±1 step window (90s clock drift tolerance). */
  verify(secretBase32: string, token: string, window = 1): boolean {
    if (!/^\d{6}$/.test(token)) return false;
    const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
    const tokenBuffer = Buffer.from(token);
    for (let offset = -window; offset <= window; offset++) {
      const expected = Buffer.from(this.hotp(secretBase32, counter + offset));
      if (
        expected.length === tokenBuffer.length &&
        timingSafeEqual(expected, tokenBuffer)
      ) {
        return true;
      }
    }
    return false;
  }
}
