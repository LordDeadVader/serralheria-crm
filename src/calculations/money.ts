import Decimal from 'decimal.js-light';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type Num = Decimal | number | string;

export const D = (v: Num | null | undefined): Decimal => new Decimal(v ?? 0);

/** Arredondamento monetário (centavos, meio para cima). */
export function roundMoney(v: Num): number {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Arredondamento para custos unitários (4 casas). */
export function roundUnit(v: Num): number {
  return D(v).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

export function roundPct(v: Num): number {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatBRL(v: number | null | undefined): string {
  return brl.format(v ?? 0);
}

export function formatPct(v: number | null | undefined, digits = 2): string {
  return `${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatNumber(v: number | null | undefined, digits = 2): string {
  return (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
