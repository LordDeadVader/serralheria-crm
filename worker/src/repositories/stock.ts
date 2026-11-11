/**
 * Estoque: itens e movimentações. Toda consulta filtra pelo companyId da sessão.
 * O saldo só muda por movimentação, e a atualização do saldo é atômica (UPDATE ... RETURNING),
 * então duas saídas simultâneas não deixam o estoque negativo.
 */
import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import type { StockItemInput, StockMovementInput } from '../../../src/schemas/entities';
import { materials, stockItems, stockMovements, users } from '../database/schema';
import { HttpError, nowIso, uid, type DB } from '../lib/context';

const esc = (q: string) => `%${q.replace(/[%_]/g, '')}%`;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

export async function listStock(db: DB, companyId: string, f: { q?: string; kind?: string }) {
  const conds = [eq(stockItems.companyId, companyId), isNull(stockItems.archivedAt)];
  if (f.q) conds.push(or(like(stockItems.name, esc(f.q)), like(stockItems.category, esc(f.q)), like(stockItems.location, esc(f.q)))!);
  if (f.kind) conds.push(eq(stockItems.kind, f.kind as (typeof stockItems.kind.enumValues)[number]));
  return db
    .select({
      item: stockItems,
      materialName: materials.name,
      lastMovementAt: sql<string | null>`(select max(m.created_at) from stock_movements m where m.item_id = ${stockItems.id})`,
    })
    .from(stockItems)
    .leftJoin(materials, and(eq(materials.id, stockItems.materialId), eq(materials.companyId, companyId)))
    .where(and(...conds))
    .orderBy(asc(stockItems.name))
    .limit(1000)
    .then((rows) => rows.map((r) => ({ ...r.item, materialName: r.materialName, lastMovementAt: r.lastMovementAt })));
}

async function assertMaterial(db: DB, companyId: string, id: string | null) {
  if (!id) return;
  const m = await db.select({ id: materials.id }).from(materials).where(and(eq(materials.id, id), eq(materials.companyId, companyId))).get();
  if (!m) throw new HttpError(422, 'Material vinculado não encontrado.', { fields: { materialId: 'Material não encontrado' } });
}

async function getItem(db: DB, companyId: string, id: string) {
  const row = await db.select().from(stockItems).where(and(eq(stockItems.id, id), eq(stockItems.companyId, companyId))).get();
  if (!row || row.archivedAt) throw new HttpError(404, 'Item de estoque não encontrado.');
  return row;
}

export async function createStockItem(db: DB, companyId: string, userId: string, data: StockItemInput) {
  const { initialQuantity, ...fields } = data;
  await assertMaterial(db, companyId, fields.materialId);
  const id = uid();
  const qty = r4(initialQuantity ?? 0);
  const [row] = await db.insert(stockItems).values({ ...fields, id, companyId, quantity: qty }).returning();
  if (qty > 0) {
    await db.insert(stockMovements).values({ id: uid(), companyId, itemId: id, type: 'entrada', qty, balanceAfter: qty, note: 'Saldo inicial', userId });
  }
  return row;
}

export async function updateStockItem(db: DB, companyId: string, id: string, data: StockItemInput) {
  const { initialQuantity: _ignored, ...fields } = data;
  await assertMaterial(db, companyId, fields.materialId);
  const [row] = await db
    .update(stockItems)
    .set({ ...fields, updatedAt: nowIso() })
    .where(and(eq(stockItems.id, id), eq(stockItems.companyId, companyId), isNull(stockItems.archivedAt)))
    .returning();
  if (!row) throw new HttpError(404, 'Item de estoque não encontrado.');
  return row;
}

/** Itens com histórico são arquivados (o histórico é preservado); sem histórico, excluídos. */
export async function deleteStockItem(db: DB, companyId: string, id: string) {
  await getItem(db, companyId, id);
  const n = await db.select({ n: sql<number>`count(*)` }).from(stockMovements).where(and(eq(stockMovements.itemId, id), eq(stockMovements.companyId, companyId))).get();
  if ((n?.n ?? 0) > 0) {
    await db.update(stockItems).set({ archivedAt: nowIso() }).where(and(eq(stockItems.id, id), eq(stockItems.companyId, companyId)));
    return { archived: true };
  }
  await db.delete(stockItems).where(and(eq(stockItems.id, id), eq(stockItems.companyId, companyId)));
  return { archived: false };
}

export async function addMovement(db: DB, companyId: string, userId: string, id: string, m: StockMovementInput) {
  const item = await getItem(db, companyId, id);
  const qty = r4(m.qty);
  const where = and(eq(stockItems.id, id), eq(stockItems.companyId, companyId), isNull(stockItems.archivedAt));
  let updated: { quantity: number } | undefined;
  let applied = qty;

  if (m.type === 'entrada') {
    [updated] = await db.update(stockItems).set({ quantity: sql`round(${stockItems.quantity} + ${qty}, 4)`, updatedAt: nowIso() }).where(where).returning({ quantity: stockItems.quantity });
  } else if (m.type === 'saida') {
    // Só baixa se houver saldo suficiente — verificado na mesma instrução (atômico).
    [updated] = await db
      .update(stockItems)
      .set({ quantity: sql`round(${stockItems.quantity} - ${qty}, 4)`, updatedAt: nowIso() })
      .where(and(where, sql`${stockItems.quantity} >= ${qty} - 0.00001`))
      .returning({ quantity: stockItems.quantity });
    if (!updated) {
      const cur = await getItem(db, companyId, id);
      throw new HttpError(409, `Saída maior que o saldo disponível (${cur.quantity} ${cur.unit}).`, { fields: { qty: 'Maior que o saldo' } });
    }
  } else {
    // Ajuste (inventário): define o saldo contado; registra a diferença.
    [updated] = await db.update(stockItems).set({ quantity: qty, updatedAt: nowIso() }).where(where).returning({ quantity: stockItems.quantity });
    applied = r4(qty - item.quantity);
  }
  if (!updated) throw new HttpError(404, 'Item de estoque não encontrado.');

  const [mov] = await db
    .insert(stockMovements)
    .values({ id: uid(), companyId, itemId: id, type: m.type, qty: applied, balanceAfter: updated.quantity, reference: m.reference, note: m.note, userId })
    .returning();
  return { item: { ...item, quantity: updated.quantity }, movement: mov };
}

export async function listMovements(db: DB, companyId: string, id: string) {
  await getItem(db, companyId, id);
  return db
    .select({ m: stockMovements, userName: users.name })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(and(eq(stockMovements.itemId, id), eq(stockMovements.companyId, companyId)))
    .orderBy(desc(stockMovements.createdAt))
    .limit(300)
    .then((rows) => rows.map((r) => ({ ...r.m, userName: r.userName })));
}
