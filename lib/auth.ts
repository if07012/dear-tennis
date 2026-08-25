// ===================================
// PASSWORD HASHING (scrypt)
// ===================================
// Uses Node's built-in scrypt so we don't add a native dependency.
// Each user gets a unique 16-byte salt. Hashes are stored as hex.

import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LEN = 64;
const SALT_LEN = 16;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const derived = await scryptAsync(password, Buffer.from(salt, 'hex'), KEY_LEN);
  return { hash: derived.toString('hex'), salt };
}

export async function verifyPassword(
  password: string,
  hashHex: string,
  saltHex: string
): Promise<boolean> {
  if (!hashHex || !saltHex) return false;
  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
    salt = Buffer.from(saltHex, 'hex');
  } catch {
    return false;
  }
  const derived = await scryptAsync(password, salt, expected.length || KEY_LEN);
  if (derived.length !== expected.length) return false;
  // timingSafeEqual requires equal-length buffers.
  return timingSafeEqual(derived, expected);
}
