/**
 * Repositórios de cadastros (clientes, fornecedores, materiais, serviços).
 * TODA consulta recebe companyId e filtra por ele — é a camada que garante o isolamento entre empresas.
 */
import { and, asc, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import type { ClientInput, MaterialInput, ServiceInput, SupplierInput } from '../../../src/schemas/entities';
import { clients, materialPriceHistory, materials, quotes, services, suppliers, users } from '../database/schema';
import { HttpError, nowIso, uid, type DB } from '../lib/context';

const esc = (q: string) => `%${q.replace(/[%_]/g, '')}%`;

/* ----------------------------- Clientes ----------------------------- */

export async function listClients(db: DB, companyId: string, q: string, archived: boolean) {
  const conds = [eq(clients.companyId, companyId), archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt)];
  if (q) conds.push(or(like(clients.name, esc(q)), like(clients.document, esc(q)), like(clients.phone, esc(q)), like(clients.email, esc(q)), like(clients.city, esc(q)))!);
  return db
    .select({
      client: clients,
      quoteCount: sql<number>`(select count(*) from quotes q where q.client_id = ${clients.id})`,
      approvedTotal: sql<number>`coalesce((select sum(q.total) from quotes q where q.client_id = ${clients.id} and q.status in ('aprovado','em_producao','concluido')),0)`,
    })
    .from(clients)
    .where(and(...conds))
    .orderBy(asc(clients.name))
    .limit(500)
    .then((rows) => rows.map((r) => ({ ...r.client, quoteCount: r.quoteCount, approvedTotal: r.approvedTotal })));
}

export async function getClient(db: DB, companyId: string, id: string) {
  const row = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).get();
  if (!row) throw new HttpError(404, 'Cliente não encontrado.');
  return row;
}

export async function createClient(db: DB, companyId: string, data: ClientInput) {
  const [row] = await db.insert(clients).values({ ...data, id: uid(), companyId }).returning();
  return row;
}

export async function updateClient(db: DB, companyId: string, id: string, data: ClientInput) {
  const [row] = await db
    .update(clients)
    .set({ ...data, updatedAt: nowIso() })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .returning();
  if (!row) throw new HttpError(404, 'Cliente não encontrado.');
  return row;
}

export async function setClientArchived(db: DB, companyId: string, id: string, archived: boolean) {
  const [row] = await db
    .update(clients)
    .set({ archivedAt: archived ? nowIso() : null, updatedAt: nowIso() })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .returning();
  if (!row) throw new HttpError(404, 'Cliente não encontrado.');
  return row;
}

/** Exclusão só é permitida sem orçamentos vinculados; caso contrário, use arquivar. */
export async function deleteClient(db: DB, companyId: string, id: string) {
  await getClient(db, companyId, id);
  const linked = await db.select({ n: sql<number>`count(*)` }).from(quotes).where(eq(quotes.clientId, id)).get();
  if ((linked?.n ?? 0) > 0) throw new HttpError(409, 'Cliente possui orçamentos vinculados. Arquive em vez de excluir.');
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId)));
}

/* ---------------------------- Fornecedores --------------------------- */

export async function listSuppliers(db: DB, companyId: string, q: string) {
  const conds = [eq(suppliers.companyId, companyId), isNull(suppliers.archivedAt)];
  if (q) conds.push(or(like(suppliers.name, esc(q)), like(suppliers.contact, esc(q)))!);
  return db
    .select({
      s: suppliers,
      materialCount: sql<number>`(select count(*) from materials m where m.supplier_id = ${suppliers.id})`,
    })
    .from(suppliers)
    .where(and(...conds))
    .orderBy(asc(suppliers.name))
    .then((rows) => rows.map((r) => ({ ...r.s, materialCount: r.materialCount })));
}

async function assertSupplier(db: DB, companyId: string, id: string | null) {
  if (!id) return;
  const s = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId))).get();
  if (!s) throw new HttpError(422, 'Fornecedor inválido.');
}

export async function createSupplier(db: DB, companyId: string, data: SupplierInput) {
  const [row] = await db.insert(suppliers).values({ ...data, id: uid(), companyId }).returning();
  return row;
}

export async function updateSupplier(db: DB, companyId: string, id: string, data: SupplierInput) {
  const [row] = await db
    .update(suppliers)
    .set({ ...data, updatedAt: nowIso() })
    .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)))
    .returning();
  if (!row) throw new HttpError(404, 'Fornecedor não encontrado.');
  return row;
}

export async function deleteSupplier(db: DB, companyId: string, id: string) {
  const linked = await db.select({ n: sql<number>`count(*)` }).from(materials).where(and(eq(materials.supplierId, id), eq(materials.companyId, companyId))).get();
  if ((linked?.n ?? 0) > 0) {
    await db.update(suppliers).set({ archivedAt: nowIso() }).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
    return { archived: true };
  }
  await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
  return { archived: false };
}

/* ----------------------------- Materiais ----------------------------- */

export async function listMaterials(db: DB, companyId: string, q: string) {
  const conds = [eq(materials.companyId, companyId)];
  if (q) conds.push(or(like(materials.name, esc(q)), like(materials.code, esc(q)), like(materials.category, esc(q)))!);
  const rows = await db
    .select({ m: materials, supplierName: suppliers.name })
    .from(materials)
    .leftJoin(suppliers, eq(suppliers.id, materials.supplierId))
    .where(and(...conds))
    .orderBy(asc(materials.category), asc(materials.name))
    .limit(1000);
  return rows.map((r) => ({ ...r.m, supplierName: r.supplierName }));
}

export async function createMaterial(db: DB, companyId: string, userId: string, data: MaterialInput) {
  await assertSupplier(db, companyId, data.supplierId);
  const id = uid();
  const [row] = await db.batch([
    db.insert(materials).values({ ...data, id, companyId }).returning(),
    db.insert(materialPriceHistory).values({ id: uid(), companyId, materialId: id, price: data.purchasePrice, packQty: data.packQty, packUnit: data.packUnit, userId }),
  ]);
  return row[0];
}

/** Atualiza material; se preço/embalagem mudarem, registra histórico. Orçamentos guardam o custo da época. */
export async function updateMaterial(db: DB, companyId: string, userId: string, id: string, data: MaterialInput) {
  await assertSupplier(db, companyId, data.supplierId);
  const cur = await db.select().from(materials).where(and(eq(materials.id, id), eq(materials.companyId, companyId))).get();
  if (!cur) throw new HttpError(404, 'Material não encontrado.');
  const priceChanged = cur.purchasePrice !== data.purchasePrice || cur.packQty !== data.packQty || cur.packUnit !== data.packUnit;
  const ts = nowIso();
  const [row] = await db
    .update(materials)
    .set({ ...data, updatedAt: ts, ...(priceChanged ? { priceUpdatedAt: ts } : {}) })
    .where(and(eq(materials.id, id), eq(materials.companyId, companyId)))
    .returning();
  if (priceChanged) {
    await db.insert(materialPriceHistory).values({ id: uid(), companyId, materialId: id, price: data.purchasePrice, packQty: data.packQty, packUnit: data.packUnit, userId });
  }
  return row;
}

export async function deleteMaterial(db: DB, companyId: string, id: string) {
  const cur = await db.select({ id: materials.id }).from(materials).where(and(eq(materials.id, id), eq(materials.companyId, companyId))).get();
  if (!cur) throw new HttpError(404, 'Material não encontrado.');
  await db.batch([
    db.delete(materialPriceHistory).where(and(eq(materialPriceHistory.materialId, id), eq(materialPriceHistory.companyId, companyId))),
    db.delete(materials).where(and(eq(materials.id, id), eq(materials.companyId, companyId))),
  ]);
}

export async function materialHistory(db: DB, companyId: string, id: string) {
  return db
    .select({
      id: materialPriceHistory.id,
      price: materialPriceHistory.price,
      packQty: materialPriceHistory.packQty,
      packUnit: materialPriceHistory.packUnit,
      changedAt: materialPriceHistory.changedAt,
      userName: users.name,
    })
    .from(materialPriceHistory)
    .leftJoin(users, eq(users.id, materialPriceHistory.userId))
    .where(and(eq(materialPriceHistory.materialId, id), eq(materialPriceHistory.companyId, companyId)))
    .orderBy(desc(materialPriceHistory.changedAt));
}

/* ----------------------------- Serviços ------------------------------ */

export async function listServices(db: DB, companyId: string) {
  return db.select().from(services).where(eq(services.companyId, companyId)).orderBy(asc(services.category), asc(services.name));
}

export async function createService(db: DB, companyId: string, data: ServiceInput) {
  const [row] = await db.insert(services).values({ ...data, id: uid(), companyId }).returning();
  return row;
}

export async function updateService(db: DB, companyId: string, id: string, data: ServiceInput) {
  const [row] = await db
    .update(services)
    .set({ ...data, updatedAt: nowIso() })
    .where(and(eq(services.id, id), eq(services.companyId, companyId)))
    .returning();
  if (!row) throw new HttpError(404, 'Serviço não encontrado.');
  return row;
}

export async function deleteService(db: DB, companyId: string, id: string) {
  const res = await db.delete(services).where(and(eq(services.id, id), eq(services.companyId, companyId))).returning({ id: services.id });
  if (res.length === 0) throw new HttpError(404, 'Serviço não encontrado.');
}
