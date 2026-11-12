import type { Travel } from '../schemas/quote';
import { D, roundMoney } from './money';

export interface TravelCosts {
  totalKm: number;
  liters: number;
  fuel: number;
  tolls: number;
  meals: number;
  lodging: number;
  total: number;
}

/**
 * Custos de deslocamento:
 *  combustível = distância de ida × 2 × viagens ÷ km/l × preço do litro
 *  pedágios    = pedágio da viagem (ida+volta) × viagens
 *  alimentação = valor por pessoa/dia × funcionários × dias
 *  estadia     = valor por pessoa/noite × funcionários × noites
 */
export function travelCosts(t: Travel | undefined | null): TravelCosts {
  const zero = { totalKm: 0, liters: 0, fuel: 0, tolls: 0, meals: 0, lodging: 0, total: 0 };
  if (!t || !t.enabled) return zero;
  const totalKm = D(t.distanceKm).times(2).times(t.trips);
  const liters = t.kmPerLiter > 0 ? totalKm.div(t.kmPerLiter) : D(0);
  const fuel = roundMoney(liters.times(t.fuelPrice));
  const tolls = roundMoney(D(t.tollPerTrip).times(t.trips));
  const meals = roundMoney(D(t.mealPerPersonDay).times(t.workers).times(t.days));
  const lodging = roundMoney(D(t.lodgingPerPersonNight).times(t.workers).times(t.nights));
  return {
    totalKm: totalKm.toNumber(),
    liters: Math.round(liters.toNumber() * 100) / 100,
    fuel,
    tolls,
    meals,
    lodging,
    total: roundMoney(D(fuel).plus(tolls).plus(meals).plus(lodging)),
  };
}

/** Linhas de despesa geradas pelo deslocamento (entram como "transporte"). */
export function travelExtraLines(t: Travel | undefined | null): Array<{ description: string; amount: number }> {
  const c = travelCosts(t);
  return [
    { description: 'Deslocamento — combustível', amount: c.fuel },
    { description: 'Deslocamento — pedágios', amount: c.tolls },
    { description: 'Alimentação da equipe', amount: c.meals },
    { description: 'Hospedagem da equipe', amount: c.lodging },
  ].filter((l) => l.amount > 0);
}
