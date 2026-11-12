export const QUOTE_STATUSES = [
  'rascunho',
  'em_elaboracao',
  'enviado',
  'em_negociacao',
  'aprovado',
  'reprovado',
  'cancelado',
  'em_producao',
  'concluido',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  rascunho: 'Rascunho',
  em_elaboracao: 'Em elaboração',
  enviado: 'Enviado',
  em_negociacao: 'Em negociação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
  em_producao: 'Em produção',
  concluido: 'Concluído',
};

/** Status em que a versão atual pode ser editada sem gerar nova versão. */
export const EDITABLE_STATUSES: QuoteStatus[] = ['rascunho', 'em_elaboracao'];

export const MATERIAL_CATEGORIES = [
  'ACM',
  'Tubos galvanizados',
  'Chapas galvanizadas',
  'Chapas e perfis de alumínio',
  'Acrílicos e plásticos',
  'Adesivos e películas',
  'Lonas e tecidos',
  'Tintas e materiais de impressão',
  'Colas, PU e fitas',
  'Parafusos e fixadores',
  'Solda e consumíveis',
  'Pintura e proteção',
  'Iluminação e elétrica',
  'Estruturas e ferragens',
  'Sinalização e acabamentos',
  'Letras caixa e fachadas',
  'Consumíveis gerais',
  'Perfis e tubos',
  'Cantoneiras e barras',
  'Chapas',
  'Solda',
  'Abrasivos',
  'Tintas e acabamento',
  'Ferragens',
  'Fixação',
  'Consumíveis',
  'Outros',
] as const;

export const SERVICE_CATEGORIES = [
  'Montagem',
  'Soldagem',
  'Corte',
  'Desbaste',
  'Pintura',
  'Acabamento',
  'Instalação',
  'Transporte',
  'Serralheria',
  'Comunicação visual',
  'Serviços complementares',
  'Outros',
] as const;

export const PURCHASE_UNITS = ['barra', 'chapa', 'unidade', 'peça', 'kg', 'lata', 'galão', 'caixa', 'pacote', 'rolo', 'metro', 'm²', 'litro'] as const;

export interface Company {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  logo: string | null;
  settings: import('../schemas/settings').CompanySettings;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export interface Client {
  id: string;
  name: string;
  personType: 'PF' | 'PJ';
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  complement: string;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  quoteCount?: number;
  approvedTotal?: number;
}

export interface Supplier {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  contact: string;
  notes: string;
  archivedAt: string | null;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  purchaseUnit: string;
  packQty: number;
  packUnit: import('../calculations/units').Unit;
  usageUnit: import('../calculations/units').Unit;
  purchasePrice: number;
  supplierId: string | null;
  supplierName?: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightKg: number | null;
  status: 'ativo' | 'inativo';
  isDemo: boolean;
  priceUpdatedAt: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  price: number;
  packQty: number;
  packUnit: string;
  changedAt: string;
  userName: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'hour' | 'fixed';
  unit: string;
  hourlyCost: number;
  fixedPrice: number;
  estimatedHours: number;
  status: 'ativo' | 'inativo';
  isDemo: boolean;
}

export interface QuoteSummary {
  id: string;
  number: number;
  code: string;
  title: string;
  status: QuoteStatus;
  clientId: string;
  clientName: string;
  currentVersion: number;
  total: number;
  totalCost: number;
  responsible: string;
  lastContactAt: string | null;
  nextFollowupAt: string | null;
  lossReason: string;
  crmNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteVersion {
  id: string;
  version: number;
  document: import('../schemas/quote').QuoteDocument;
  totals: import('../calculations/engine').CalcResult;
  createdAt: string;
  createdByName: string | null;
  locked: boolean;
}

export interface QuoteEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  userName: string | null;
}

export interface QuoteDetail extends QuoteSummary {
  versions: Array<Omit<QuoteVersion, 'document' | 'totals'> & { total: number }>;
  current: QuoteVersion;
  events: QuoteEvent[];
  client: Client | null;
}

export type { StockKind } from '../schemas/entities';

export const STOCK_KIND_LABEL: Record<import('../schemas/entities').StockKind, string> = {
  material: 'Material',
  insumo: 'Insumo / consumível',
  ferramenta: 'Ferramenta',
  epi: 'EPI',
  outro: 'Outro',
};

export interface StockItem {
  id: string;
  name: string;
  kind: import('../schemas/entities').StockKind;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  location: string;
  materialId: string | null;
  materialName: string | null;
  notes: string;
  lastMovementAt: string | null;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  type: 'entrada' | 'saida' | 'ajuste';
  qty: number;
  balanceAfter: number;
  reference: string;
  note: string;
  userName: string | null;
  createdAt: string;
}

export type Template = import('../schemas/templates').TemplateInput & {
  id: string;
  isDemo: boolean;
  updatedAt: string;
};
