import { D, roundUnit } from './money';

export const UNITS = ['un', 'm', 'cm', 'mm', 'kg', 'g', 'l', 'ml', 'm2', 'cm2'] as const;
export type Unit = (typeof UNITS)[number];

export type Dimension = 'contagem' | 'comprimento' | 'massa' | 'volume' | 'area';

export const UNIT_INFO: Record<Unit, { label: string; dimension: Dimension; toBase: number }> = {
  un: { label: 'Unidade (un)', dimension: 'contagem', toBase: 1 },
  m: { label: 'Metro (m)', dimension: 'comprimento', toBase: 1 },
  cm: { label: 'Centímetro (cm)', dimension: 'comprimento', toBase: 0.01 },
  mm: { label: 'Milímetro (mm)', dimension: 'comprimento', toBase: 0.001 },
  kg: { label: 'Quilograma (kg)', dimension: 'massa', toBase: 1 },
  g: { label: 'Grama (g)', dimension: 'massa', toBase: 0.001 },
  l: { label: 'Litro (l)', dimension: 'volume', toBase: 1 },
  ml: { label: 'Mililitro (ml)', dimension: 'volume', toBase: 0.001 },
  m2: { label: 'Metro quadrado (m²)', dimension: 'area', toBase: 1 },
  cm2: { label: 'Centímetro quadrado (cm²)', dimension: 'area', toBase: 0.0001 },
};

export const unitShort = (u: string) => (u === 'm2' ? 'm²' : u === 'cm2' ? 'cm²' : u);

export class ConversionError extends Error {}

export function isCompatible(from: Unit, to: Unit): boolean {
  return UNIT_INFO[from].dimension === UNIT_INFO[to].dimension;
}

/** Converte um valor entre unidades da mesma dimensão. Lança ConversionError se incompatíveis. */
export function convert(value: number, from: Unit, to: Unit): number {
  if (!isCompatible(from, to)) {
    throw new ConversionError(
      `Conversão incompatível: ${unitShort(from)} (${UNIT_INFO[from].dimension}) → ${unitShort(to)} (${UNIT_INFO[to].dimension}).`,
    );
  }
  return D(value).times(UNIT_INFO[from].toBase).div(UNIT_INFO[to].toBase).toNumber();
}

export interface MaterialPricing {
  /** Preço pago por uma unidade de compra (ex.: uma barra). */
  purchasePrice: number;
  /** Quantidade contida em uma unidade de compra, expressa em packUnit (ex.: 6 m por barra). */
  packQty: number;
  packUnit: Unit;
  /** Unidade usada no orçamento. */
  usageUnit: Unit;
  /** Peso de uma unidade de compra em kg (opcional; habilita uso em unidades de massa). */
  packWeightKg?: number | null;
}

/**
 * Quantas unidades de utilização existem em uma unidade de compra.
 * Regras:
 *  - mesma dimensão → conversão direta;
 *  - utilização em massa e peso da unidade de compra informado → usa o peso;
 *  - qualquer outro caso → incompatível (exige densidade/dimensão/regra específica).
 */
export function usageUnitsPerPack(p: MaterialPricing): number {
  if (!(p.packQty > 0)) throw new ConversionError('A quantidade por unidade de compra deve ser maior que zero.');
  if (isCompatible(p.packUnit, p.usageUnit)) return convert(p.packQty, p.packUnit, p.usageUnit);
  if (UNIT_INFO[p.usageUnit].dimension === 'massa') {
    if (p.packWeightKg && p.packWeightKg > 0) return convert(p.packWeightKg, 'kg', p.usageUnit);
    throw new ConversionError('Para usar este material em unidade de massa, informe o peso da unidade de compra.');
  }
  return convert(p.packQty, p.packUnit, p.usageUnit); // lança erro descritivo
}

/** Custo por unidade de utilização (4 casas decimais). Ex.: barra 6 m a R$ 90 → R$ 15/m. */
export function costPerUsageUnit(p: MaterialPricing): number {
  if (p.purchasePrice < 0) throw new ConversionError('O preço de compra não pode ser negativo.');
  const per = usageUnitsPerPack(p);
  return roundUnit(D(p.purchasePrice).div(per));
}

/** Tenta calcular; retorna null e mensagem em caso de incompatibilidade. */
export function safeCostPerUsageUnit(p: MaterialPricing): { value: number | null; error: string | null } {
  try {
    return { value: costPerUsageUnit(p), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : 'Erro de conversão' };
  }
}
