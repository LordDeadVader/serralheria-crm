/** Modelos de serviço e kits. Toda consulta filtra pelo companyId da sessão. */
import { and, asc, eq } from 'drizzle-orm';
import { templateSchema, type TemplateInput } from '../../../src/schemas/templates';
import { templates } from '../database/schema';
import { HttpError, nowIso, uid, type DB } from '../lib/context';

type Row = typeof templates.$inferSelect;

function toDto(r: Row) {
  let data: Partial<TemplateInput> = {};
  try {
    data = JSON.parse(r.data);
  } catch {
    /* dado corrompido: devolve vazio */
  }
  const parsed = templateSchema.safeParse({ ...data, name: r.name, kind: r.kind });
  const t = parsed.success ? parsed.data : templateSchema.parse({ name: r.name, kind: r.kind });
  return { id: r.id, isDemo: r.isDemo, updatedAt: r.updatedAt, ...t };
}

const split = ({ name, kind, ...data }: TemplateInput) => ({ name, kind, data: JSON.stringify(data) });

export async function listTemplates(db: DB, companyId: string) {
  const rows = await db.select().from(templates).where(eq(templates.companyId, companyId)).orderBy(asc(templates.kind), asc(templates.name)).limit(500);
  return rows.map(toDto);
}

export async function createTemplate(db: DB, companyId: string, input: TemplateInput) {
  const [row] = await db.insert(templates).values({ id: uid(), companyId, ...split(input) }).returning();
  return toDto(row);
}

export async function updateTemplate(db: DB, companyId: string, id: string, input: TemplateInput) {
  const [row] = await db
    .update(templates)
    .set({ ...split(input), isDemo: false, updatedAt: nowIso() })
    .where(and(eq(templates.id, id), eq(templates.companyId, companyId)))
    .returning();
  if (!row) throw new HttpError(404, 'Modelo não encontrado.');
  return toDto(row);
}

export async function deleteTemplate(db: DB, companyId: string, id: string) {
  const [row] = await db.delete(templates).where(and(eq(templates.id, id), eq(templates.companyId, companyId))).returning({ id: templates.id });
  if (!row) throw new HttpError(404, 'Modelo não encontrado.');
  return { ok: true };
}
