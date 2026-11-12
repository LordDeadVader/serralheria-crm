import { emptyTravel, type QuoteDocument } from '../../schemas/quote';
import type { Company } from '../../types/domain';

export function emptyDocument(company: Company | null, clientId = ''): QuoteDocument {
  const fin = company?.settings.financial;
  const q = company?.settings.quote;
  const tr = company?.settings.travel;
  return {
    clientId,
    project: {
      name: '',
      serviceType: '',
      description: '',
      width: null,
      height: null,
      depth: null,
      dimensionUnit: 'm',
      quantity: 1,
      installLocation: '',
      finish: '',
      specifications: '',
      notes: '',
    },
    materials: [],
    labor: [],
    extras: [],
    travel: {
      ...emptyTravel(),
      origin: company?.address ?? '',
      kmPerLiter: tr?.kmPerLiter ?? 10,
      fuelPrice: tr?.fuelPrice ?? 0,
      mealPerPersonDay: tr?.mealPerPersonDay ?? 0,
      lodgingPerPersonNight: tr?.lodgingPerPersonNight ?? 0,
    },
    pricing: {
      overheadPct: fin?.overheadPct ?? 10,
      taxPct: fin?.taxPct ?? 6,
      feePct: fin?.feePct ?? 0,
      commissionPct: fin?.commissionPct ?? 0,
      marginPct: fin?.marginPct ?? 25,
      manualPrice: null,
    },
    commercial: {
      validityDays: q?.validityDays ?? 15,
      paymentTerms: q?.paymentTerms ?? '',
      downPaymentPct: q?.downPaymentPct ?? 50,
      installments: q?.installments ?? 1,
      fabricationDays: q?.fabricationDays ?? 15,
      installationDays: q?.installationDays ?? 2,
      warranty: q?.warranty ?? '',
      notes: q?.notes ?? '',
      responsible: q?.responsible ?? '',
      showItemized: false,
    },
  };
}

export const SERVICE_TYPES = [
  'Portão',
  'Portão de correr',
  'Portão basculante',
  'Grade',
  'Corrimão',
  'Guarda-corpo',
  'Escada',
  'Estrutura metálica',
  'Cobertura',
  'Mezanino',
  'Janela',
  'Porta',
  'Manutenção',
  'Outro',
];

export const STEPS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'projeto', label: 'Projeto' },
  { key: 'materiais', label: 'Materiais' },
  { key: 'mao', label: 'Mão de obra' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'precificacao', label: 'Impostos e margem' },
  { key: 'condicoes', label: 'Condições' },
  { key: 'revisao', label: 'Revisão' },
] as const;

/** Etapa onde cada campo é editado (para levar o usuário ao erro). */
export function stepForPath(path: string): number {
  if (path.startsWith('clientId')) return 0;
  if (path.startsWith('project')) return 1;
  if (path.startsWith('materials')) return 2;
  if (path.startsWith('labor')) return 3;
  if (path.startsWith('extras') || path.startsWith('pricing.overheadPct')) return 4;
  if (path.startsWith('pricing')) return 5;
  return 6;
}
