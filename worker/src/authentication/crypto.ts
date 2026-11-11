/**
 * Primitivas criptográficas (Web Crypto, nativo do Workers).
 * Senhas: PBKDF2-HMAC-SHA256, 100.000 iterações (limite do runtime), sal aleatório de 16 bytes.
 * Formato armazenado: pbkdf2$sha256$<iter>$<salt b64url>$<hash b64url>
 */
const ITERATIONS = 100_000;
const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(input: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, algo, iter, saltS, hashS] = stored.split('$');
  if (scheme !== 'pbkdf2' || algo !== 'sha256') return false;
  const hash = await derive(password, fromB64url(saltS), Number(iter));
  return timingSafeEqual(hash, fromB64url(hashS));
}

/** Hash fictício para equalizar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_HASH = 'pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
