import { safeCostPerUsageUnit } from '../calculations/units';
import { roundMoney, roundUnit } from '../calculations/money';
import { emptyTravel, type QuoteDocument } from '../schemas/quote';
import type { TemplateInput } from '../schemas/templates';
import type { Material, Service } from '../types/domain';
import { newKey } from './format';

export const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Custo atual por unidade de uso de um material do cadastro (0 se sem preço ou conversão inválida). */
export function materialUnitCost(m: Material): number {
  const c = safeCostPerUsageUnit({ purchasePrice: m.purchasePrice, packQty: m.packQty, packUnit: m.packUnit, usageUnit: m.usageUnit, packWeightKg: m.weightKg });
  return c.value != null ? roundUnit(c.value) : 0;
}

export interface ApplyContext {
  materials: Material[];
  services: Service[];
  defaultWastePct: number;
  defaultHourlyCost: number;
}

export interface ApplyResult {
  materials: number;
  labor: number;
  extras: number;
  /** Itens que entraram sem preço (sem vínculo com o cadastro ou cadastro com preço 0). */
  missingPrices: string[];
}

/**
 * Adiciona as linhas de um modelo/kit ao orçamento (no TOPO das listas, na ordem do modelo).
 * - multiplier: quantidade de kits (ex.: 4 holofotes) — multiplica materiais, horas e despesas.
 * - asProject: também preenche nome, tipo, descrição, especificações e acabamento quando estiverem vazios.
 * Custos vêm SEMPRE do cadastro atual (pelo vínculo ou pelo nome); sem cadastro, ficam em 0 para preencher.
 */
export function applyTemplate(doc: QuoteDocument, t: TemplateInput, ctx: ApplyContext, opts: { multiplier?: number; asProject?: boolean } = {}): ApplyResult {
  const k = opts.multiplier && opts.multiplier > 0 ? opts.multiplier : 1;
  const missing: string[] = [];
  const byId = new Map(ctx.materials.map((m) => [m.id, m]));
  const byName = new Map(ctx.materials.filter((m) => m.status === 'ativo').map((m) => [normName(m.name), m]));
  const svcById = new Map(ctx.services.map((s) => [s.id, s]));
  const svcByName = new Map(ctx.services.filter((s) => s.status === 'ativo').map((s) => [normName(s.name), s]));

  if (opts.asProject) {
    const p = doc.project;
    if (!p.name.trim()) p.name = t.name;
    if (!p.serviceType && t.serviceType) p.serviceType = t.serviceType;
    if (!p.description.trim() && t.description) p.description = t.description;
    if (!p.specifications.trim() && t.specifications) p.specifications = t.specifications;
    if (!p.finish.trim() && t.finish) p.finish = t.finish;
  }

  const mats = t.materials.map((l) => {
    const m = (l.materialId && byId.get(l.materialId)) || byName.get(normName(l.name)) || null;
    const unitCost = m ? materialUnitCost(m) : 0;
    if (!unitCost) missing.push(l.name);
    return {
      key: newKey(),
      materialId: m?.id ?? null,
      code: m?.code ?? '',
      name: m?.name ?? l.name,
      unit: m?.usageUnit ?? l.unit,
      qty: Math.round(l.qty * k * 10_000) / 10_000,
      unitCost,
      wastePct: l.wastePct ?? ctx.defaultWastePct,
    };
  });

  const labor = t.labor.map((l) => {
    const s = (l.serviceId && svcById.get(l.serviceId)) || svcByName.get(normName(l.name)) || null;
    const mode = l.mode;
    const catalogRate = s ? (s.mode === 'hour' ? s.hourlyCost : s.fixedPrice) : 0;
    let rate = l.rate || catalogRate || (mode === 'hour' ? ctx.defaultHourlyCost : 0);
    if (mode === 'fixed') rate = roundMoney(rate * k);
    if (!rate) missing.push(l.name);
    return {
      key: newKey(),
      serviceId: s?.id ?? null,
      name: s?.name ?? l.name,
      mode,
      qty: mode === 'hour' ? Math.round(l.qty * k * 10_000) / 10_000 : 1,
      workers: mode === 'hour' ? l.workers : 1,
      rate,
    };
  });

  const extras = t.extras.map((e) => ({ key: newKey(), description: e.description, kind: e.kind, amount: roundMoney(e.amount * k) }));

  doc.materials.unshift(...mats);
  doc.labor.unshift(...labor);
  doc.extras.unshift(...extras);
  return { materials: mats.length, labor: labor.length, extras: extras.length, missingPrices: missing };
}

/**
 * Ajusta documentos salvos antes das mudanças (equipe na mão de obra, preço fixo sem quantidade,
 * deslocamento). Não altera o valor calculado: preço fixo com quantidade vira valor × quantidade.
 */
export function normalizeDocument(doc: QuoteDocument): QuoteDocument {
  return {
    ...doc,
    labor: doc.labor.map((l) =>
      l.mode === 'fixed'
        ? { ...l, rate: l.qty === 1 ? l.rate : roundMoney(l.rate * l.qty), qty: 1, workers: 1 }
        : { ...l, workers: l.workers && l.workers > 0 ? l.workers : 1 },
    ),
    travel: { ...emptyTravel(), ...(doc.travel ?? {}) },
  };
}

/** Converte um orçamento em modelo (para "Salvar como modelo"). */
export function documentToTemplate(doc: QuoteDocument, name: string): TemplateInput {
  return {
    name,
    kind: 'projeto',
    serviceType: doc.project.serviceType,
    description: doc.project.description,
    specifications: doc.project.specifications,
    finish: doc.project.finish,
    notes: '',
    materials: doc.materials.map((m) => ({ materialId: m.materialId, name: m.name, unit: m.unit, qty: m.qty, wastePct: m.wastePct })),
    labor: doc.labor.map((l) => ({ serviceId: l.serviceId, name: l.name, mode: l.mode, qty: l.qty, workers: l.workers ?? 1, rate: l.serviceId ? 0 : l.rate })),
    extras: doc.extras.map((e) => ({ description: e.description, kind: e.kind, amount: e.amount })),
  };
}
