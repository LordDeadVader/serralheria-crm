/**
 * Predefinições inseridas na criação de cada empresa (e disponíveis em "Importar lista padrão"):
 *  - lista de materiais/insumos e de serviços/mão de obra, SEM preço (aparecem como "sem preço");
 *  - modelos de serviço e kits de insumos (editáveis em "Modelos e kits").
 * Nenhum preço é inventado: cada empresa informa os seus.
 */
import { getTableColumns, sql } from 'drizzle-orm';
import { MATERIAL_PRESETS, SERVICE_PRESETS, TEMPLATE_PRESETS } from '../../../src/data/presets';
import type { Unit } from '../../../src/calculations/units';
import { materials, services, templates } from './schema';
import { uid, type DB } from '../lib/context';

type M = typeof materials.$inferInsert;
type S = typeof services.$inferInsert;
type T = typeof templates.$inferInsert;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Divide inserções para respeitar o limite de 100 parâmetros por consulta do D1. */
function chunk<X>(rows: X[], columns: number): X[][] {
  const size = Math.max(1, Math.floor(99 / columns));
  const out: X[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function presetRows(companyId: string, skip: { materials: Set<string>; services: Set<string>; templates: Set<string> }) {
  const mats: M[] = MATERIAL_PRESETS.filter((m) => !skip.materials.has(norm(m.name))).map((m) => ({
    id: uid(),
    companyId,
    name: m.name,
    category: m.category,
    purchaseUnit: m.purchaseUnit,
    packQty: m.packQty,
    packUnit: m.packUnit as Unit,
    usageUnit: m.usageUnit as Unit,
    purchasePrice: 0,
  }));
  const svcs: S[] = SERVICE_PRESETS.filter((s) => !skip.services.has(norm(s.name))).map((s) => ({
    id: uid(),
    companyId,
    name: s.name,
    category: s.category,
    mode: s.mode,
    unit: s.unit,
    hourlyCost: 0,
    fixedPrice: 0,
    estimatedHours: 0,
  }));
  const tpls: T[] = TEMPLATE_PRESETS.filter((t) => !skip.templates.has(norm(t.name))).map(({ name, kind, ...data }) => ({
    id: uid(),
    companyId,
    name,
    kind,
    data: JSON.stringify(data),
    isDemo: true,
  }));
  return { mats, svcs, tpls };
}

function statements(db: DB, rows: ReturnType<typeof presetRows>) {
  return [
    // O Drizzle envia todas as colunas da tabela como parâmetros: o lote é calculado por elas.
    ...chunk(rows.mats, Object.keys(getTableColumns(materials)).length).map((r) => db.insert(materials).values(r)),
    ...chunk(rows.svcs, Object.keys(getTableColumns(services)).length).map((r) => db.insert(services).values(r)),
    ...rows.tpls.map((r) => db.insert(templates).values(r)),
  ];
}

/** Para uma empresa nova (lote atômico do cadastro). */
export function seedStatements(db: DB, companyId: string) {
  return statements(db, presetRows(companyId, { materials: new Set(), services: new Set(), templates: new Set() }));
}

/** Para empresas existentes: insere só o que ainda não existe (pelo nome). */
export async function importPresets(db: DB, companyId: string) {
  const names = async (table: typeof materials | typeof services | typeof templates) =>
    new Set(
      (await db.select({ name: table.name }).from(table).where(sql`${table.companyId} = ${companyId}`)).map((r) => norm(r.name)),
    );
  const rows = presetRows(companyId, { materials: await names(materials), services: await names(services), templates: await names(templates) });
  const st = statements(db, rows);
  if (st.length) await db.batch(st as [(typeof st)[number], ...(typeof st)[number][]]);
  return { materials: rows.mats.length, services: rows.svcs.length, templates: rows.tpls.length };
}
