import type { CalcResult } from '../calculations/engine';
import { D, roundMoney } from '../calculations/money';
import type { QuoteDocument } from '../schemas/quote';
import { unitShort } from '../calculations/units';
import { formatNumber } from '../calculations/money';

export interface ClientLine {
  description: string;
  qty: string;
  value: number;
}

/**
 * Distribui o preço de venda entre os itens proporcionalmente ao custo de cada um.
 * O cliente vê apenas valores de venda — nunca custos, margens ou preços de fornecedores.
 * O último item absorve diferenças de centavos para que a soma feche com o total.
 */
export function allocateClientLines(doc: QuoteDocument, calc: CalcResult): ClientLine[] {
  const q = doc.project.quantity;
  const raw: Array<{ description: string; qty: string; weight: number }> = [
    ...doc.materials.map((m, i) => ({
      description: m.name,
      qty: `${formatNumber(m.qty * q, 3)} ${unitShort(m.unit)}`,
      weight: calc.materialLines[i]?.total ?? 0,
    })),
    ...doc.labor.map((l, i) => ({
      description: l.name,
      qty: l.mode === 'hour' ? 'Serviço' : `${formatNumber(l.qty * q, 2)} un`,
      weight: calc.laborLines[i] ?? 0,
    })),
    ...doc.extras
      .filter((e) => e.kind !== 'indireto')
      .map((e) => ({ description: e.description, qty: '1 vb', weight: e.amount })),
  ].filter((l) => l.weight > 0);

  const totalWeight = raw.reduce((s, l) => s + l.weight, 0);
  if (!totalWeight || raw.length === 0) return [{ description: doc.project.name, qty: `${formatNumber(q)} un`, value: calc.finalPrice }];

  let acc = D(0);
  return raw.map((l, i) => {
    let value: number;
    if (i === raw.length - 1) value = roundMoney(D(calc.finalPrice).minus(acc));
    else {
      value = roundMoney(D(calc.finalPrice).times(l.weight).div(totalWeight));
      acc = acc.plus(value);
    }
    return { description: l.description, qty: l.qty, value };
  });
}
