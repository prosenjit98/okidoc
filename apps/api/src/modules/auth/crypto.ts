import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const hashSecret = (plain: string) => hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifySecret = async (hashed: string | null | undefined, plain: string) => {
  if (!hashed) return false;
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
};
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
/** Human-friendly backup code, e.g. "K7QF-2MXD-9P". */
export const backupCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from({ length: 10 }, () => alphabet[randomInt(0, alphabet.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
};
export const normalizeBackupCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hmacHex = (secret: string, data: string | Buffer) => createHmac('sha256', secret).update(data).digest('hex');
export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};
export const maskPhone = (p: string) => `+91 ${p.slice(0, 2)}XXXXXX${p.slice(-2)}`;
