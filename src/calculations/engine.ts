/**
 * Motor financeiro — independente da interface e do banco.
 *
 * Modelo de custo:
 *   Materiais (por unidade do produto)  × quantidade do projeto
 * + Desperdício (% sobre cada linha de material)
 * + Mão de obra (por unidade do produto) × quantidade do projeto
 * = Custo direto
 * + Custos indiretos (% sobre o custo direto + despesas indiretas lançadas)
 * + Transporte e outras despesas (por obra)
 * = Custo total
 *
 * Preço de venda = Custo total / (1 − impostos − taxas − comissão − margem)
 *
 * Os custos indiretos entram SOMENTE no custo (nunca no divisor), evitando dupla contagem.
 * Impostos, taxas e comissão incidem sobre o preço de venda (por isso ficam no divisor).
 */
import { D, Decimal, roundMoney, roundPct } from './money';

export interface MaterialLineInput {
  qty: number;
  unitCost: number;
  wastePct: number;
}

export interface LaborLineInput {
  /** hour: qty = horas × rate (custo/hora). fixed: qty = quantidade × rate (preço fixo). */
  mode: 'hour' | 'fixed';
  qty: number;
  rate: number;
}

export type ExtraKind = 'indireto' | 'transporte' | 'outro';

export interface ExtraLineInput {
  kind: ExtraKind;
  amount: number;
}

export interface PricingInput {
  overheadPct: number;
  taxPct: number;
  feePct: number;
  commissionPct: number;
  marginPct: number;
  /** Preço final informado manualmente (substitui o sugerido). */
  manualPrice?: number | null;
}

export interface CalcInput {
  quantity: number;
  materials: MaterialLineInput[];
  labor: LaborLineInput[];
  extras: ExtraLineInput[];
  pricing: PricingInput;
}

export interface LineResult {
  base: number;
  waste: number;
  total: number;
}

export interface CalcResult {
  valid: boolean;
  errors: string[];
  materialLines: LineResult[];
  laborLines: number[];
  materialsCost: number;
  wasteCost: number;
  laborCost: number;
  directCost: number;
  overheadPctCost: number;
  indirectExpenses: number;
  overheadCost: number;
  transportCost: number;
  otherCost: number;
  totalCost: number;
  variablePct: number;
  suggestedPrice: number;
  finalPrice: number;
  isManualPrice: boolean;
  taxes: number;
  fees: number;
  commission: number;
  profit: number;
  effectiveMarginPct: number;
  unitPrice: number;
}

const PCT_FIELDS: Array<[keyof PricingInput, string]> = [
  ['overheadPct', 'Custos indiretos'],
  ['taxPct', 'Impostos'],
  ['feePct', 'Taxas'],
  ['commissionPct', 'Comissão'],
  ['marginPct', 'Margem'],
];

export function validatePricing(p: PricingInput): string[] {
  const errors: string[] = [];
  for (const [k, label] of PCT_FIELDS) {
    const v = p[k] as number;
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${label}: valor inválido.`);
    else if (v < 0) errors.push(`${label}: não pode ser negativo.`);
    else if (v >= 100) errors.push(`${label}: deve ser menor que 100%.`);
  }
  const variable = D(p.taxPct).plus(p.feePct).plus(p.commissionPct).plus(p.marginPct);
  if (variable.gte(100)) {
    errors.push(
      `A soma de impostos, taxas, comissão e margem (${roundPct(variable)}%) deve ser menor que 100%.`,
    );
  }
  if (p.manualPrice != null && (!Number.isFinite(p.manualPrice) || p.manualPrice < 0)) {
    errors.push('Preço manual inválido.');
  }
  return errors;
}

/** Fórmula padrão de formação de preço (markup divisor). */
export function salePriceFromCost(totalCost: number, variablePct: number): number {
  if (variablePct >= 100) throw new Error('Percentuais variáveis devem somar menos de 100%.');
  return roundMoney(D(totalCost).div(D(1).minus(D(variablePct).div(100))));
}

export function calculateQuote(input: CalcInput): CalcResult {
  const errors = validatePricing(input.pricing);
  const qty = D(input.quantity > 0 ? input.quantity : 0);
  if (!(input.quantity > 0)) errors.push('A quantidade do projeto deve ser maior que zero.');

  let materials = new Decimal(0);
  let waste = new Decimal(0);
  const materialLines: LineResult[] = input.materials.map((m, i) => {
    if (m.qty < 0 || m.unitCost < 0) errors.push(`Material ${i + 1}: quantidade e custo não podem ser negativos.`);
    if (m.wastePct < 0 || m.wastePct >= 100) errors.push(`Material ${i + 1}: desperdício deve estar entre 0% e 99,99%.`);
    const base = D(m.qty).times(m.unitCost).times(qty);
    const w = base.times(D(m.wastePct).div(100));
    materials = materials.plus(base);
    waste = waste.plus(w);
    return { base: roundMoney(base), waste: roundMoney(w), total: roundMoney(base.plus(w)) };
  });

  let labor = new Decimal(0);
  const laborLines = input.labor.map((l, i) => {
    if (l.qty < 0 || l.rate < 0) errors.push(`Serviço ${i + 1}: quantidade e valor não podem ser negativos.`);
    const v = D(l.qty).times(l.rate).times(qty);
    labor = labor.plus(v);
    return roundMoney(v);
  });

  let indirect = new Decimal(0);
  let transport = new Decimal(0);
  let other = new Decimal(0);
  for (const e of input.extras) {
    if (e.amount < 0) errors.push('Despesas não podem ser negativas.');
    if (e.kind === 'indireto') indirect = indirect.plus(e.amount);
    else if (e.kind === 'transporte') transport = transport.plus(e.amount);
    else other = other.plus(e.amount);
  }

  const direct = materials.plus(waste).plus(labor);
  const overheadPctCost = direct.times(D(input.pricing.overheadPct).div(100));
  const overhead = overheadPctCost.plus(indirect);
  const total = direct.plus(overhead).plus(transport).plus(other);
  const totalCost = roundMoney(total);

  const p = input.pricing;
  const variablePct = D(p.taxPct).plus(p.feePct).plus(p.commissionPct).plus(p.marginPct).toNumber();
  const valid = errors.length === 0;
  const suggestedPrice = valid ? salePriceFromCost(totalCost, variablePct) : 0;
  const isManualPrice = p.manualPrice != null && p.manualPrice > 0;
  const finalPrice = isManualPrice ? roundMoney(p.manualPrice as number) : suggestedPrice;

  const fp = D(finalPrice);
  const taxes = roundMoney(fp.times(D(p.taxPct).div(100)));
  const fees = roundMoney(fp.times(D(p.feePct).div(100)));
  const commission = roundMoney(fp.times(D(p.commissionPct).div(100)));
  const profit = roundMoney(fp.minus(totalCost).minus(taxes).minus(fees).minus(commission));
  const effectiveMarginPct = finalPrice > 0 ? roundPct(D(profit).div(finalPrice).times(100)) : 0;

  return {
    valid,
    errors,
    materialLines,
    laborLines,
    materialsCost: roundMoney(materials),
    wasteCost: roundMoney(waste),
    laborCost: roundMoney(labor),
    directCost: roundMoney(direct),
    overheadPctCost: roundMoney(overheadPctCost),
    indirectExpenses: roundMoney(indirect),
    overheadCost: roundMoney(overhead),
    transportCost: roundMoney(transport),
    otherCost: roundMoney(other),
    totalCost,
    variablePct: roundPct(variablePct),
    suggestedPrice,
    finalPrice,
    isManualPrice,
    taxes,
    fees,
    commission,
    profit,
    effectiveMarginPct,
    unitPrice: input.quantity > 0 ? roundMoney(D(finalPrice).div(input.quantity)) : 0,
  };
}

export interface PaymentPlan {
  downPayment: number;
  remaining: number;
  installments: number;
  installmentValue: number;
  lastInstallmentValue: number;
}

/** Divide o valor em entrada + parcelas; a última parcela absorve a diferença de centavos. */
export function paymentPlan(total: number, downPaymentPct: number, installments: number): PaymentPlan {
  const n = Math.max(0, Math.floor(installments));
  const pct = Math.min(Math.max(downPaymentPct, 0), 100);
  const downPayment = roundMoney(D(total).times(pct).div(100));
  const remaining = roundMoney(D(total).minus(downPayment));
  if (n === 0) return { downPayment, remaining, installments: 0, installmentValue: 0, lastInstallmentValue: 0 };
  const installmentValue = D(remaining).div(n).toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber();
  const lastInstallmentValue = roundMoney(D(remaining).minus(D(installmentValue).times(n - 1)));
  return { downPayment, remaining, installments: n, installmentValue, lastInstallmentValue };
}
