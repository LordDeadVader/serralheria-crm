import { describe, expect, it } from 'vitest';
import { calculateDocument } from '../src/calculations/quote';
import { travelCosts } from '../src/calculations/travel';
import { applyTemplate, normalizeDocument } from '../src/lib/applyTemplate';
import { MATERIAL_PRESETS, SERVICE_PRESETS, TEMPLATE_PRESETS } from '../src/data/presets';
import { emptyDocument } from '../src/pages/quote/defaults';
import { emptyTravel } from '../src/schemas/quote';
import { templateSchema } from '../src/schemas/templates';
import type { Material, Service } from '../src/types/domain';

const mat = (over: Partial<Material>): Material =>
  ({ id: 'x', code: '', name: '', category: '', description: '', purchaseUnit: 'barra', packQty: 6, packUnit: 'm', usageUnit: 'm', purchasePrice: 0, supplierId: null, supplierName: null, lengthMm: null, widthMm: null, thicknessMm: null, weightKg: null, status: 'ativo', isDemo: false, priceUpdatedAt: '', ...over }) as Material;

describe('mão de obra com equipe', () => {
  it('2 h × 2 funcionários × R$ 50/h = R$ 200', () => {
    const doc = emptyDocument(null);
    doc.labor = [{ key: 'a', serviceId: null, name: 'Montagem', mode: 'hour', qty: 2, workers: 2, rate: 50 }];
    expect(calculateDocument(doc).laborLines[0]).toBe(200);
  });
  it('preço fixo usa só o valor', () => {
    const doc = emptyDocument(null);
    doc.labor = [{ key: 'a', serviceId: null, name: 'Visita técnica', mode: 'fixed', qty: 1, workers: 1, rate: 150 }];
    expect(calculateDocument(doc).laborLines[0]).toBe(150);
  });
  it('orçamento antigo com preço fixo × quantidade mantém o valor ao normalizar', () => {
    const doc = emptyDocument(null);
    doc.labor = [{ key: 'a', serviceId: null, name: 'X', mode: 'fixed', qty: 3, rate: 100 } as never];
    const before = calculateDocument(doc).laborCost;
    const n = normalizeDocument(doc);
    expect(n.labor[0]).toMatchObject({ qty: 1, rate: 300, workers: 1 });
    expect(calculateDocument(n).laborCost).toBe(before);
  });
});

describe('deslocamento', () => {
  it('combustível, pedágio, alimentação e hospedagem', () => {
    const t = { ...emptyTravel(), enabled: true, distanceKm: 100, trips: 2, kmPerLiter: 10, fuelPrice: 6, tollPerTrip: 30, workers: 2, days: 2, mealPerPersonDay: 40, nights: 1, lodgingPerPersonNight: 120 };
    const c = travelCosts(t);
    // 100 km × 2 × 2 viagens = 400 km ÷ 10 = 40 l × R$ 6 = R$ 240
    expect(c).toMatchObject({ totalKm: 400, liters: 40, fuel: 240, tolls: 60, meals: 160, lodging: 240, total: 700 });
    const doc = { ...emptyDocument(null), travel: t };
    expect(calculateDocument(doc).transportCost).toBe(700);
  });
  it('desligado não soma nada', () => {
    expect(travelCosts({ ...emptyTravel(), distanceKm: 500, fuelPrice: 6 }).total).toBe(0);
  });
});

describe('modelos e kits', () => {
  it('predefinições são válidas e referenciam itens da lista', () => {
    for (const t of TEMPLATE_PRESETS) expect(templateSchema.safeParse(t).success).toBe(true);
    expect(MATERIAL_PRESETS.length).toBeGreaterThan(400);
    expect(SERVICE_PRESETS.length).toBeGreaterThan(90);
  });

  it('kit adiciona itens no topo, multiplica pela quantidade e puxa preço do cadastro', () => {
    const doc = emptyDocument(null);
    doc.materials = [{ key: 'old', materialId: null, code: '', name: 'Existente', unit: 'un', qty: 1, unitCost: 1, wastePct: 0 }];
    const holofote = TEMPLATE_PRESETS.find((t) => t.name.startsWith('Holofote'))!;
    const materials = [mat({ id: 't15', name: 'Tubo metalon galvanizado 15 x 15 mm', purchasePrice: 30 })]; // barra de 6 m → R$ 5/m
    const services = [{ id: 's1', name: 'Serralheiro', mode: 'hour', hourlyCost: 40, fixedPrice: 0, status: 'ativo' } as unknown as Service];
    const r = applyTemplate(doc, holofote, { materials, services, defaultWastePct: 5, defaultHourlyCost: 35 }, { multiplier: 4 });
    expect(doc.materials.at(-1)!.name).toBe('Existente');
    const tubo = doc.materials.find((m) => m.materialId === 't15')!;
    expect(tubo).toMatchObject({ qty: 4, unitCost: 5, unit: 'm' });
    const serr = doc.labor.find((l) => l.name === 'Serralheiro')!;
    expect(serr).toMatchObject({ qty: 2, rate: 40, serviceId: 's1' });
    expect(doc.labor.find((l) => l.name === 'Eletricista instalador')!.rate).toBe(35); // sem cadastro → custo/hora padrão
    expect(r.missingPrices).toContain('Refletor LED');
  });

  it('serviço predefinido preenche a descrição sem sobrescrever o que já foi digitado', () => {
    const doc = emptyDocument(null);
    doc.project.specifications = 'Minha especificação';
    const t = TEMPLATE_PRESETS.find((x) => x.name === 'Testeira em ACM adesivada')!;
    applyTemplate(doc, t, { materials: [], services: [], defaultWastePct: 5, defaultHourlyCost: 35 }, { asProject: true });
    expect(doc.project.name).toBe('Testeira em ACM adesivada');
    expect(doc.project.description).toBe('Testeira em ACM adesivada para fachada');
    expect(doc.project.specifications).toBe('Minha especificação');
    expect(doc.materials.length).toBe(t.materials.length);
  });
});
