import type { QuoteDocument } from '../schemas/quote';
import { calculateQuote, type CalcResult } from './engine';
import { travelExtraLines } from './travel';

/** Horas cobradas da linha: por hora = horas × funcionários; preço fixo = 1. */
export const laborUnits = (l: { mode: 'hour' | 'fixed'; qty: number; workers?: number }) => (l.mode === 'hour' ? l.qty * (l.workers ?? 1) : l.qty);

/** Adapta o documento do orçamento ao motor financeiro. */
export function calculateDocument(doc: QuoteDocument): CalcResult {
  return calculateQuote({
    quantity: doc.project.quantity,
    materials: doc.materials.map((m) => ({ qty: m.qty, unitCost: m.unitCost, wastePct: m.wastePct })),
    labor: doc.labor.map((l) => ({ mode: l.mode, qty: laborUnits(l), rate: l.rate })),
    extras: [
      ...doc.extras.map((e) => ({ kind: e.kind, amount: e.amount })),
      ...travelExtraLines(doc.travel).map((e) => ({ kind: 'transporte' as const, amount: e.amount })),
    ],
    pricing: doc.pricing,
  });
}
