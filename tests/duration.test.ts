import { describe, expect, it } from 'vitest';
import { formatDuration, splitHours } from '../src/lib/format';
import { calculateQuote } from '../src/calculations/engine';

describe('tempo em horas e minutos', () => {
  it('divide horas decimais em horas e minutos', () => {
    expect(splitHours(1.5)).toEqual({ h: 1, m: 30 });
    expect(splitHours(0.75)).toEqual({ h: 0, m: 45 });
    expect(splitHours(2 + 20 / 60)).toEqual({ h: 2, m: 20 });
    expect(splitHours(59.999 / 60)).toEqual({ h: 1, m: 0 });
  });

  it('formata de forma legível', () => {
    expect(formatDuration(2)).toBe('2 h');
    expect(formatDuration(0.75)).toBe('45 min');
    expect(formatDuration(1.5)).toBe('1 h 30 min');
    expect(formatDuration(0)).toBe('0 h');
  });

  it('cobra minutos proporcionalmente: 1 h 30 min × R$ 35/h = R$ 52,50', () => {
    const r = calculateQuote({
      quantity: 1,
      materials: [],
      labor: [{ mode: 'hour', qty: 1 + 30 / 60, rate: 35 }],
      extras: [],
      pricing: { overheadPct: 0, taxPct: 0, feePct: 0, commissionPct: 0, marginPct: 0 },
    });
    expect(r.laborLines[0]).toBe(52.5);
  });
});
