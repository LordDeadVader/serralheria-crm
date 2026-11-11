/**
 * Dados de demonstração inseridos na criação de cada empresa.
 * Todos são marcados com is_demo = 1, exibidos com o selo "Exemplo" e podem ser editados/excluídos.
 * Os preços são apenas ilustrativos para permitir testar o sistema — NÃO são referência de mercado.
 */
import { materials, services } from './schema';
import { uid, type DB } from '../lib/context';

const NOTE = 'Dado de exemplo. Preço ilustrativo — não é referência de mercado. Atualize ou exclua.';

type M = typeof materials.$inferInsert;
type S = typeof services.$inferInsert;

export function demoMaterials(companyId: string): M[] {
  const base = { companyId, isDemo: true, description: NOTE, status: 'ativo' as const };
  return [
    { ...base, id: uid(), code: 'EX-001', name: 'Metalon 20x20 chapa 18', category: 'Perfis e tubos', purchaseUnit: 'barra', packQty: 6, packUnit: 'm', usageUnit: 'm', purchasePrice: 60, lengthMm: 6000, widthMm: 20, thicknessMm: 1.25 },
    { ...base, id: uid(), code: 'EX-002', name: 'Metalon 30x30 chapa 18', category: 'Perfis e tubos', purchaseUnit: 'barra', packQty: 6, packUnit: 'm', usageUnit: 'm', purchasePrice: 75, lengthMm: 6000, widthMm: 30, thicknessMm: 1.25 },
    { ...base, id: uid(), code: 'EX-003', name: 'Metalon 40x40 chapa 18', category: 'Perfis e tubos', purchaseUnit: 'barra', packQty: 6, packUnit: 'm', usageUnit: 'm', purchasePrice: 90, lengthMm: 6000, widthMm: 40, thicknessMm: 1.25 },
    { ...base, id: uid(), code: 'EX-004', name: 'Chapa de aço 1,00 x 2,00 m chapa 18', category: 'Chapas', purchaseUnit: 'chapa', packQty: 2, packUnit: 'm2', usageUnit: 'm2', purchasePrice: 280, lengthMm: 2000, widthMm: 1000, thicknessMm: 1.25, weightKg: 20 },
    { ...base, id: uid(), code: 'EX-005', name: 'Roldana para portão de correr', category: 'Ferragens', purchaseUnit: 'unidade', packQty: 1, packUnit: 'un', usageUnit: 'un', purchasePrice: 25 },
    { ...base, id: uid(), code: 'EX-006', name: 'Fechadura para portão', category: 'Ferragens', purchaseUnit: 'unidade', packQty: 1, packUnit: 'un', usageUnit: 'un', purchasePrice: 80 },
    { ...base, id: uid(), code: 'EX-007', name: 'Tinta esmalte sintético (galão 3,6 L)', category: 'Tintas e acabamento', purchaseUnit: 'galão', packQty: 3.6, packUnit: 'l', usageUnit: 'l', purchasePrice: 120 },
    { ...base, id: uid(), code: 'EX-008', name: 'Disco de corte 7"', category: 'Abrasivos', purchaseUnit: 'unidade', packQty: 1, packUnit: 'un', usageUnit: 'un', purchasePrice: 8 },
  ];
}

export function demoServices(companyId: string): S[] {
  const base = { companyId, isDemo: true, description: NOTE, status: 'ativo' as const, mode: 'hour' as const, unit: 'h' };
  return [
    { ...base, id: uid(), name: 'Fabricação', category: 'Fabricação', hourlyCost: 35, estimatedHours: 8 },
    { ...base, id: uid(), name: 'Soldagem', category: 'Soldagem', hourlyCost: 35, estimatedHours: 4 },
    { ...base, id: uid(), name: 'Pintura', category: 'Pintura', hourlyCost: 30, estimatedHours: 3 },
    { ...base, id: uid(), name: 'Instalação', category: 'Instalação', hourlyCost: 40, estimatedHours: 4 },
  ];
}

export function seedStatements(db: DB, companyId: string) {
  // Uma instrução por linha: o D1 limita a 100 parâmetros por consulta.
  return [
    ...demoMaterials(companyId).map((m) => db.insert(materials).values(m)),
    ...demoServices(companyId).map((s) => db.insert(services).values(s)),
  ];
}
