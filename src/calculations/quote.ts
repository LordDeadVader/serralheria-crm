import type { QuoteDocument } from '../schemas/quote';
import { calculateQuote, type CalcResult } from './engine';

/** Adapta o documento do orçamento ao motor financeiro. */
export function calculateDocument(doc: QuoteDocument): CalcResult {
  return calculateQuote({
    quantity: doc.project.quantity,
    materials: doc.materials.map((m) => ({ qty: m.qty, unitCost: m.unitCost, wastePct: m.wastePct })),
    labor: doc.labor.map((l) => ({ mode: l.mode, qty: l.qty, rate: l.rate })),
    extras: doc.extras.map((e) => ({ kind: e.kind, amount: e.amount })),
    pricing: doc.pricing,
  });
}
