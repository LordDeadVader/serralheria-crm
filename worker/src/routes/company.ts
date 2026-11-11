import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { companySchema } from '../../../src/schemas/entities';
import { companySettingsSchema } from '../../../src/schemas/settings';
import { companies } from '../database/schema';
import { HttpError, nowIso, type AppEnv } from '../lib/context';
import { body } from '../lib/validate';

export function parseSettings(raw: string) {
  try {
    return companySettingsSchema.parse(JSON.parse(raw));
  } catch {
    return companySettingsSchema.parse({});
  }
}

export function companyDto(c: typeof companies.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName,
    cnpj: c.cnpj,
    address: c.address,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    logo: c.logo,
    settings: parseSettings(c.settings),
  };
}

export const companyRoutes = new Hono<AppEnv>();

companyRoutes.get('/', async (c) => {
  const row = await c.var.db.select().from(companies).where(eq(companies.id, c.var.auth.companyId)).get();
  if (!row) throw new HttpError(404, 'Empresa não encontrada.');
  return c.json(companyDto(row));
});

companyRoutes.put('/', async (c) => {
  const data = await body(c, companySchema);
  const { settings, ...rest } = data;
  const [row] = await c.var.db
    .update(companies)
    .set({ ...rest, settings: JSON.stringify(settings), updatedAt: nowIso() })
    .where(eq(companies.id, c.var.auth.companyId))
    .returning();
  return c.json(companyDto(row));
});
