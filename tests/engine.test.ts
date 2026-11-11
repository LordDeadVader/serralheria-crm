import { describe, expect, it } from 'vitest';
import { calculateQuote, paymentPlan, salePriceFromCost, validatePricing, type CalcInput } from '../src/calculations/engine';
import { roundMoney } from '../src/calculations/money';

const pricing = { overheadPct: 0, taxPct: 6, feePct: 2, commissionPct: 0, marginPct: 25, manualPrice: null };

describe('formação de preço', () => {
  it('exemplo da especificação: custo 2.000, 6% + 2% + 0% + 25% → R$ 2.985,07', () => {
    expect(salePriceFromCost(2000, 33)).toBe(2985.07);
  });

  it('rejeita percentuais variáveis somando 100% ou mais', () => {
    expect(() => salePriceFromCost(1000, 100)).toThrow();
    const errs = validatePricing({ ...pricing, marginPct: 92 });
    expect(errs.some((e) => e.includes('menor que 100%'))).toBe(true);
  });

  it('rejeita percentuais negativos e individuais ≥ 100%', () => {
    expect(validatePricing({ ...pricing, taxPct: -1 }).length).toBeGreaterThan(0);
    expect(validatePricing({ ...pricing, overheadPct: 100 }).length).toBeGreaterThan(0);
  });
});

describe('calculateQuote', () => {
  const base: CalcInput = {
    quantity: 1,
    materials: [{ qty: 8, unitCost: 15, wastePct: 10 }], // 8 m × R$15 = 120 + 12 desperdício
    labor: [{ mode: 'hour', qty: 4, rate: 35 }], // 4 h × 35 = 140
    extras: [
      { kind: 'transporte', amount: 50 },
      { kind: 'indireto', amount: 20 },
    ],
    pricing: { ...pricing, overheadPct: 10 },
  };

  it('soma custos por categoria', () => {
    const r = calculateQuote(base);
    expect(r.materialsCost).toBe(120);
    expect(r.wasteCost).toBe(12);
    expect(r.laborCost).toBe(140);
    expect(r.directCost).toBe(272);
    expect(r.overheadPctCost).toBe(27.2);
    expect(r.overheadCost).toBe(47.2); // 27,20 + 20 de despesas indiretas
    expect(r.transportCost).toBe(50);
    expect(r.totalCost).toBe(369.2);
    expect(r.valid).toBe(true);
  });

  it('preço sugerido = custo / (1 - 33%) e lucro coerente', () => {
    const r = calculateQuote(base);
    expect(r.suggestedPrice).toBe(roundMoney(369.2 / 0.67)); // 551,04
    expect(r.finalPrice).toBe(551.04);
    expect(r.taxes).toBe(33.06);
    expect(r.fees).toBe(11.02);
    expect(r.profit).toBe(roundMoney(551.04 - 369.2 - 33.06 - 11.02));
    expect(r.effectiveMarginPct).toBeCloseTo(25, 0);
  });

  it('custos indiretos não entram no divisor (sem dupla contagem)', () => {
    const r = calculateQuote({ ...base, pricing: { ...base.pricing, overheadPct: 50 } });
    expect(r.variablePct).toBe(33);
  });

  it('multiplica materiais e mão de obra pela quantidade, mas não as despesas da obra', () => {
    const r = calculateQuote({ ...base, quantity: 3 });
    expect(r.materialsCost).toBe(360);
    expect(r.laborCost).toBe(420);
    expect(r.transportCost).toBe(50);
    expect(r.unitPrice).toBe(roundMoney(r.finalPrice / 3));
  });

  it('preço manual recalcula a margem efetiva', () => {
    const r = calculateQuote({ ...base, pricing: { ...base.pricing, manualPrice: 500 } });
    expect(r.isManualPrice).toBe(true);
    expect(r.finalPrice).toBe(500);
    expect(r.profit).toBe(roundMoney(500 - 369.2 - 30 - 10));
    expect(r.effectiveMarginPct).toBe(roundMoney(((500 - 369.2 - 40) / 500) * 100));
  });

  it('preço manual abaixo do custo resulta em margem negativa', () => {
    const r = calculateQuote({ ...base, pricing: { ...base.pricing, manualPrice: 300 } });
    expect(r.profit).toBeLessThan(0);
    expect(r.effectiveMarginPct).toBeLessThan(0);
  });

  it('marca inválido e zera preço com percentuais impossíveis', () => {
    const r = calculateQuote({ ...base, pricing: { ...base.pricing, marginPct: 95 } });
    expect(r.valid).toBe(false);
    expect(r.suggestedPrice).toBe(0);
  });

  it('precisão decimal: evita erros de ponto flutuante', () => {
    const r = calculateQuote({
      quantity: 3,
      materials: [{ qty: 0.1, unitCost: 0.2, wastePct: 0 }],
      labor: [],
      extras: [],
      pricing: { ...pricing, taxPct: 0, feePct: 0, marginPct: 0 },
    });
    expect(r.materialsCost).toBe(0.06);
    expect(r.finalPrice).toBe(0.06);
  });

  it('exemplo de mão de obra: 4 h de soldagem × R$ 35 = R$ 140', () => {
    const r = calculateQuote({ quantity: 1, materials: [], labor: [{ mode: 'hour', qty: 4, rate: 35 }], extras: [], pricing });
    expect(r.laborCost).toBe(140);
  });
});

describe('paymentPlan', () => {
  it('entrada + parcelas com ajuste de centavos na última', () => {
    const p = paymentPlan(1000, 30, 3);
    expect(p.downPayment).toBe(300);
    expect(p.remaining).toBe(700);
    expect(p.installmentValue).toBe(233.33);
    expect(p.lastInstallmentValue).toBe(233.34);
  });

  it('sem parcelas', () => {
    const p = paymentPlan(2985.07, 100, 0);
    expect(p.downPayment).toBe(2985.07);
    expect(p.remaining).toBe(0);
  });
});
