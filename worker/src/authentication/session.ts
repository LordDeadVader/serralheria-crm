import { and, eq, gt, lt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { loginAttempts, sessions, users } from '../database/schema';
import { HttpError, nowIso, type AppEnv, type DB } from '../lib/context';
import { randomToken, sha256 } from './crypto';

const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function createSession(db: DB, userId: string, companyId: string, userAgent: string) {
  const token = randomToken(32);
  const id = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await db.insert(sessions).values({ id, userId, companyId, expiresAt, userAgent: userAgent.slice(0, 200) });
  // Limpeza oportunista de sessões expiradas deste usuário.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, nowIso())));
  return { token, expiresAt };
}

/** Exige header Authorization: Bearer <token>. Define c.var.auth com company_id da sessão. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 100) throw new HttpError(401, 'Sessão inválida. Entre novamente.');
  const id = await sha256(token);
  const db = c.var.db;
  const row = await db
    .select({ userId: sessions.userId, companyId: sessions.companyId, userName: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, nowIso())))
    .get();
  if (!row) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  c.set('auth', { ...row, sessionId: id });
  await next();
};

/** Limite de tentativas de login por chave (e-mail / IP). */
export async function checkRateLimit(db: DB, key: string) {
  const now = Date.now();
  const row = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  if (row && row.resetAt > now && row.count >= MAX_ATTEMPTS) {
    const min = Math.ceil((row.resetAt - now) / 60000);
    throw new HttpError(429, `Muitas tentativas. Tente novamente em ${min} min.`);
  }
}

export async function registerFailure(db: DB, key: string) {
  const now = Date.now();
  const row = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  if (!row || row.resetAt <= now) {
    await db
      .insert(loginAttempts)
      .values({ key, count: 1, resetAt: now + WINDOW_MS })
      .onConflictDoUpdate({ target: loginAttempts.key, set: { count: 1, resetAt: now + WINDOW_MS } });
  } else {
    await db.update(loginAttempts).set({ count: row.count + 1 }).where(eq(loginAttempts.key, key));
  }
}

export async function clearFailures(db: DB, key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
