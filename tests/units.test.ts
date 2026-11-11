import { describe, expect, it } from 'vitest';
import { ConversionError, convert, costPerUsageUnit, usageUnitsPerPack } from '../src/calculations/units';
import { isValidCNPJ, isValidCPF } from '../src/schemas/common';
import { clientSchema, materialSchema } from '../src/schemas/entities';
import { quoteDocumentSchema } from '../src/schemas/quote';

describe('conversão de unidades', () => {
  it('comprimento', () => {
    expect(convert(6, 'm', 'cm')).toBe(600);
    expect(convert(6000, 'mm', 'm')).toBe(6);
    expect(convert(25, 'cm', 'mm')).toBe(250);
  });
  it('massa, volume e área', () => {
    expect(convert(2.5, 'kg', 'g')).toBe(2500);
    expect(convert(3600, 'ml', 'l')).toBe(3.6);
    expect(convert(1, 'm2', 'cm2')).toBe(10000);
  });
  it('bloqueia conversões incompatíveis', () => {
    expect(() => convert(1, 'm', 'kg')).toThrow(ConversionError);
    expect(() => convert(1, 'l', 'm2')).toThrow(ConversionError);
  });
});

describe('custo por unidade de utilização', () => {
  it('exemplo da especificação: barra 6 m por R$ 90 → R$ 15/m; 8 m = R$ 120', () => {
    const c = costPerUsageUnit({ purchasePrice: 90, packQty: 6, packUnit: 'm', usageUnit: 'm' });
    expect(c).toBe(15);
    expect(c * 8).toBe(120);
  });
  it('barra comprada em metros e usada em centímetros', () => {
    expect(costPerUsageUnit({ purchasePrice: 90, packQty: 6, packUnit: 'm', usageUnit: 'cm' })).toBe(0.15);
  });
  it('chapa em m² usada em kg exige peso', () => {
    expect(() => usageUnitsPerPack({ purchasePrice: 300, packQty: 2, packUnit: 'm2', usageUnit: 'kg' })).toThrow(ConversionError);
    expect(costPerUsageUnit({ purchasePrice: 300, packQty: 2, packUnit: 'm2', usageUnit: 'kg', packWeightKg: 30 })).toBe(10);
  });
  it('não converte metro para litro', () => {
    expect(() => costPerUsageUnit({ purchasePrice: 10, packQty: 1, packUnit: 'm', usageUnit: 'l' })).toThrow();
  });
  it('quantidade por unidade de compra deve ser positiva', () => {
    expect(() => costPerUsageUnit({ purchasePrice: 10, packQty: 0, packUnit: 'm', usageUnit: 'm' })).toThrow();
  });
});

describe('validações', () => {
  it('CPF e CNPJ', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
  });
  it('cliente exige nome e documento válido', () => {
    expect(clientSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(clientSchema.safeParse({ name: 'João', personType: 'PF', document: '123' }).success).toBe(false);
    expect(clientSchema.safeParse({ name: 'João', personType: 'PF', document: '529.982.247-25' }).success).toBe(true);
  });
  it('material exige quantidade por unidade de compra > 0', () => {
    const r = materialSchema.safeParse({ name: 'Metalon', purchaseUnit: 'barra', packQty: 0, packUnit: 'm', usageUnit: 'm', purchasePrice: 90, supplierId: '' });
    expect(r.success).toBe(false);
  });
  it('orçamento rejeita margem ≥ 100%', () => {
    const r = quoteDocumentSchema.safeParse({
      clientId: 'c1',
      project: { name: 'Portão', quantity: 1 },
      materials: [],
      labor: [],
      extras: [],
      pricing: { overheadPct: 0, taxPct: 0, feePct: 0, commissionPct: 0, marginPct: 100, manualPrice: null },
      commercial: { validityDays: 15, paymentTerms: '', downPaymentPct: 50, installments: 1, fabricationDays: 10, installationDays: 1, warranty: '', notes: '', responsible: '', showItemized: false },
    });
    expect(r.success).toBe(false);
  });
});
