import * as Crypto from "expo-crypto";

/**
 * Local sign-in for shared school phones: a salted SHA-256 of the password,
 * stored as "salt:hash". This guards against casual access between students on
 * one device; real authentication is the backend's job (POST /student/login).
 */
export async function hashPassword(password: string, salt = Crypto.randomUUID()): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt] = stored.split(":");
  return (await hashPassword(password, salt)) === stored;
}

export const newId = () => Crypto.randomUUID();
