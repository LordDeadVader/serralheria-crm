import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { changePasswordSchema, loginSchema, signupSchema } from '../../../src/schemas/entities';
import { defaultCompanySettings } from '../../../src/schemas/settings';
import { DUMMY_HASH, hashPassword, sha256, verifyPassword } from '../authentication/crypto';
import { checkRateLimit, clearFailures, createSession, registerFailure, requireAuth } from '../authentication/session';
import { companies, invites, sessions, users } from '../database/schema';
import { seedStatements } from '../database/seed';
import { HttpError, nowIso, uid, type AppEnv } from '../lib/context';
import { body } from '../lib/validate';
import { companyDto } from './company';

export const authRoutes = new Hono<AppEnv>();

const ip = (h: (n: string) => string | undefined) => h('CF-Connecting-IP') ?? 'local';

/**
 * Cadastro protegido por convite: cada código (gerado pelo administrador via script)
 * é de uso único, expira e cria uma nova empresa isolada com o usuário como proprietário.
 */
authRoutes.post('/signup', async (c) => {
  const db = c.var.db;
  const ipKey = `signup:${ip(c.req.header.bind(c.req))}`;
  await checkRateLimit(db, ipKey);
  const data = await body(c, signupSchema);
  const codeHash = await sha256(data.inviteCode);
  const invite = await db
    .select()
    .from(invites)
    .where(and(eq(invites.codeHash, codeHash), isNull(invites.usedAt), gt(invites.expiresAt, nowIso())))
    .get();
  if (!invite) {
    await registerFailure(db, ipKey);
    throw new HttpError(403, 'Código de convite inválido, expirado ou já utilizado.');
  }
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get();
  if (exists) throw new HttpError(409, 'Já existe uma conta com este e-mail.');

  const companyId = uid();
  const userId = uid();
  const passwordHash = await hashPassword(data.password);
  const settings = defaultCompanySettings();
  settings.quote.responsible = data.name;
  // Marca o convite como usado de forma condicional (evita corrida com uso simultâneo).
  const claimed = await db
    .update(invites)
    .set({ usedAt: nowIso(), usedByUserId: userId })
    .where(and(eq(invites.id, invite.id), isNull(invites.usedAt)))
    .returning({ id: invites.id });
  if (claimed.length === 0) throw new HttpError(403, 'Convite já utilizado.');

  try {
    await db.batch([
      db.insert(companies).values({ id: companyId, name: data.companyName, settings: JSON.stringify(settings) }),
      db.insert(users).values({ id: userId, companyId, name: data.name, email: data.email, passwordHash, role: 'owner' }),
      ...seedStatements(db, companyId),
    ]);
  } catch (e) {
    // Lote é atômico: se falhar, devolve o convite para uso.
    await db.update(invites).set({ usedAt: null, usedByUserId: null }).where(eq(invites.id, invite.id));
    throw e;
  }
  await clearFailures(db, ipKey);
  const session = await createSession(db, userId, companyId, c.req.header('User-Agent') ?? '');
  return c.json({ token: session.token, expiresAt: session.expiresAt }, 201);
});

authRoutes.post('/login', async (c) => {
  const db = c.var.db;
  const data = await body(c, loginSchema);
  const key = `login:${data.email}`;
  const ipKey = `loginip:${ip(c.req.header.bind(c.req))}`;
  await checkRateLimit(db, key);
  await checkRateLimit(db, ipKey);
  const user = await db.select().from(users).where(eq(users.email, data.email)).get();
  const ok = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await registerFailure(db, key);
    await registerFailure(db, ipKey);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  await clearFailures(db, key);
  const session = await createSession(db, user.id, user.companyId, c.req.header('User-Agent') ?? '');
  return c.json({ token: session.token, expiresAt: session.expiresAt });
});

authRoutes.use('/me', requireAuth);
authRoutes.use('/logout', requireAuth);
authRoutes.use('/password', requireAuth);

authRoutes.get('/me', async (c) => {
  const { userId, companyId } = c.var.auth;
  const db = c.var.db;
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  const company = await db.select().from(companies).where(eq(companies.id, companyId)).get();
  if (!user || !company) throw new HttpError(401, 'Sessão inválida.');
  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: companyDto(company),
  });
});

authRoutes.post('/logout', async (c) => {
  await c.var.db.delete(sessions).where(eq(sessions.id, c.var.auth.sessionId));
  return c.json({ ok: true });
});

/** Troca de senha (encerra as demais sessões do usuário). */
authRoutes.post('/password', async (c) => {
  const db = c.var.db;
  const { userId, sessionId } = c.var.auth;
  const data = await body(c, changePasswordSchema);
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new HttpError(403, 'Senha atual incorreta.');
  }
  await db.update(users).set({ passwordHash: await hashPassword(data.newPassword) }).where(eq(users.id, userId));
  const all = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const s of all) if (s.id !== sessionId) await db.delete(sessions).where(eq(sessions.id, s.id));
  return c.json({ ok: true });
});
