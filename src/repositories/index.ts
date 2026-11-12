/** Repositórios do frontend: encapsulam os endpoints da API por entidade. */
import type { ClientInput, CompanyInput, MaterialInput, ServiceInput, StockItemInput, StockMovementInput, SupplierInput } from '../schemas/entities';
import type { QuoteDocument } from '../schemas/quote';
import type { Client, Company, Material, PriceHistory, QuoteDetail, QuoteStatus, QuoteSummary, Service, StockItem, StockMovement, Supplier, Template, User } from '../types/domain';
import type { TemplateInput } from '../schemas/templates';
import { del, get, post, put, qs } from '../services/api';

export const authRepo = {
  login: (email: string, password: string) => post<{ token: string }>('/auth/login', { email, password }),
  signup: (data: { inviteCode: string; companyName: string; name: string; email: string; password: string }) =>
    post<{ token: string }>('/auth/signup', data),
  me: () => get<{ user: User; company: Company }>('/auth/me'),
  logout: () => post('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) => post('/auth/password', { currentPassword, newPassword }),
};

export const companyRepo = {
  get: () => get<Company>('/company'),
  save: (data: CompanyInput) => put<Company>('/company', data),
};

export const clientsRepo = {
  list: (q = '', archived = false) => get<Client[]>(`/clients${qs({ q, archived: archived ? 1 : undefined })}`),
  get: (id: string) => get<Client & { quotes: QuoteSummary[] }>(`/clients/${id}`),
  create: (d: ClientInput) => post<Client>('/clients', d),
  update: (id: string, d: ClientInput) => put<Client>(`/clients/${id}`, d),
  archive: (id: string) => post<Client>(`/clients/${id}/archive`),
  unarchive: (id: string) => post<Client>(`/clients/${id}/unarchive`),
  remove: (id: string) => del(`/clients/${id}`),
};

export const suppliersRepo = {
  list: (q = '') => get<Array<Supplier & { materialCount: number }>>(`/suppliers${qs({ q })}`),
  create: (d: SupplierInput) => post<Supplier>('/suppliers', d),
  update: (id: string, d: SupplierInput) => put<Supplier>(`/suppliers/${id}`, d),
  remove: (id: string) => del<{ archived: boolean }>(`/suppliers/${id}`),
};

export const materialsRepo = {
  list: (q = '') => get<Material[]>(`/materials${qs({ q })}`),
  history: (id: string) => get<PriceHistory[]>(`/materials/${id}/history`),
  create: (d: MaterialInput) => post<Material>('/materials', d),
  update: (id: string, d: MaterialInput) => put<Material>(`/materials/${id}`, d),
  remove: (id: string) => del(`/materials/${id}`),
};

export const servicesRepo = {
  list: () => get<Service[]>('/services'),
  create: (d: ServiceInput) => post<Service>('/services', d),
  update: (id: string, d: ServiceInput) => put<Service>(`/services/${id}`, d),
  remove: (id: string) => del(`/services/${id}`),
};

export const quotesRepo = {
  list: (f: { status?: string; clientId?: string; q?: string } = {}) => get<QuoteSummary[]>(`/quotes${qs(f)}`),
  get: (id: string, version?: number) => get<QuoteDetail>(`/quotes/${id}${qs({ version })}`),
  create: (document: QuoteDocument, status?: 'rascunho' | 'em_elaboracao') => post<QuoteDetail>('/quotes', { document, status }),
  save: (id: string, document: QuoteDocument, status?: 'rascunho' | 'em_elaboracao') => put<QuoteDetail>(`/quotes/${id}`, { document, status }),
  newVersion: (id: string, document?: QuoteDocument) => post<QuoteDetail>(`/quotes/${id}/versions`, { document }),
  duplicate: (id: string) => post<QuoteDetail>(`/quotes/${id}/duplicate`),
  setStatus: (id: string, status: QuoteStatus, lossReason?: string) => post<QuoteDetail>(`/quotes/${id}/status`, { status, lossReason }),
  saveCrm: (
    id: string,
    d: { responsible: string; lastContactAt: string | null; nextFollowupAt: string | null; crmNotes: string; lossReason: string },
  ) => put<QuoteDetail>(`/quotes/${id}/crm`, d),
  remove: (id: string) => del(`/quotes/${id}`),
};

export const stockRepo = {
  list: (f: { q?: string; kind?: string } = {}) => get<StockItem[]>(`/stock${qs(f)}`),
  create: (d: StockItemInput) => post<StockItem>('/stock', d),
  update: (id: string, d: StockItemInput) => put<StockItem>(`/stock/${id}`, d),
  remove: (id: string) => del<{ archived: boolean }>(`/stock/${id}`),
  movements: (id: string) => get<StockMovement[]>(`/stock/${id}/movements`),
  move: (id: string, d: StockMovementInput) => post<{ item: StockItem; movement: StockMovement }>(`/stock/${id}/movements`, d),
};

export const templatesRepo = {
  list: () => get<Template[]>('/templates'),
  create: (d: TemplateInput) => post<Template>('/templates', d),
  update: (id: string, d: TemplateInput) => put<Template>(`/templates/${id}`, d),
  remove: (id: string) => del(`/templates/${id}`),
};

export const presetsRepo = {
  importAll: () => post<{ materials: number; services: number; templates: number }>('/presets/import'),
};

export interface DashboardData {
  byStatus: Array<{ status: QuoteStatus; n: number; total: number }>;
  counts: { clients: number; materials: number; services: number; lowStock: number; outOfStock: number } | null;
  recent: QuoteSummary[];
  followups: QuoteSummary[];
  monthly: Array<{ month: string; created: number; approved: number; approvedTotal: number; approvedCost: number; quotedTotal: number }>;
}
export const dashboardRepo = { get: () => get<DashboardData>('/dashboard') };
