import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt:v1";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function isPasswordHash(value: string) {
  return value.startsWith(`${HASH_PREFIX}:`);
}

export async function hashPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalıdır.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_PREFIX}:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  if (!isPasswordHash(storedHash)) {
    return false;
  }

  const [, version, saltValue, hashValue] = storedHash.split(":");
  if (version !== "v1" || !saltValue || !hashValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
