/** Painel do site: conteúdo público, projetos, serviços, depoimentos e solicitações recebidas. */
import type { LeadStatus, SiteImage, SiteProjectInput, SiteServiceInput, SiteSettings, SiteTestimonialInput } from '../schemas/site';
import { del, fetchBlob, get, post, put, upload } from '../services/api';

export type SiteService = SiteServiceInput & { id: string; updatedAt: string };
export type SiteProject = SiteProjectInput & { id: string; isDemo: boolean; createdAt: string; updatedAt: string };
export type SiteTestimonial = SiteTestimonialInput & { id: string };
export interface LeadFile {
  key: string;
  name: string;
  type: string;
  size: number;
}
export interface SiteLead {
  id: string;
  name: string;
  phone: string;
  city: string;
  service: string;
  material: string;
  description: string;
  measures: string;
  reference: string;
  files: LeadFile[];
  status: LeadStatus;
  forwardStatus: string;
  clientId: string | null;
  createdAt: string;
}
export interface SiteOverview {
  pending: string[];
  counts: { services: number; projects: number; demoProjects: number; testimonials: number; newLeads: number; leads: number };
}

export const siteRepo = {
  overview: () => get<SiteOverview>('/site/overview'),
  settings: () => get<SiteSettings>('/site/settings'),
  saveSettings: (d: SiteSettings) => put<SiteSettings>('/site/settings', d),

  services: () => get<SiteService[]>('/site/services'),
  saveService: (d: SiteServiceInput, id?: string) => (id ? put<SiteService>(`/site/services/${id}`, d) : post<SiteService>('/site/services', d)),
  removeService: (id: string) => del(`/site/services/${id}`),

  projects: () => get<SiteProject[]>('/site/projects'),
  saveProject: (d: SiteProjectInput, id?: string) => (id ? put<SiteProject>(`/site/projects/${id}`, d) : post<SiteProject>('/site/projects', d)),
  removeProject: (id: string) => del(`/site/projects/${id}`),

  testimonials: () => get<SiteTestimonial[]>('/site/testimonials'),
  saveTestimonial: (d: SiteTestimonialInput, id?: string) =>
    id ? put<SiteTestimonial>(`/site/testimonials/${id}`, d) : post<SiteTestimonial>('/site/testimonials', d),
  removeTestimonial: (id: string) => del(`/site/testimonials/${id}`),

  leads: () => get<SiteLead[]>('/site/leads'),
  setLeadStatus: (id: string, status: LeadStatus) => put(`/site/leads/${id}`, { status }),
  removeLead: (id: string) => del(`/site/leads/${id}`),
  leadToClient: (id: string) => post<{ clientId: string; created: boolean }>(`/site/leads/${id}/client`),
  leadFile: (id: string, n: number) => fetchBlob(`/site/leads/${id}/files/${n}`),

  uploadImage: (blob: Blob, variant: 'lg' | 'sm', id?: string) =>
    upload<{ id: string; src: string }>(`/site/media?variant=${variant}${id ? `&id=${id}` : ''}`, blob),
  deleteImages: (images: SiteImage[]) => post('/site/media/delete', { images }),
};
