import { z } from 'zod';
import { UNITS } from '../calculations/units';
import { money, pct, qty, str } from './common';
import { QUOTE_STATUSES } from '../types/domain';

const key = z.string().min(1).max(40);
const nullableQty = z.preprocess((v) => (v === '' || v == null ? null : v), qty.nullable());

export const materialLineSchema = z.object({
  key,
  materialId: z.string().max(40).nullable(),
  code: str(40),
  name: z.string().trim().min(1, 'Informe o material').max(160),
  unit: z.enum(UNITS),
  qty,
  unitCost: money,
  wastePct: pct,
});

export const laborLineSchema = z.object({
  key,
  serviceId: z.string().max(40).nullable(),
  name: z.string().trim().min(1, 'Informe o serviço').max(160),
  mode: z.enum(['hour', 'fixed']),
  qty,
  rate: money,
});

export const extraLineSchema = z.object({
  key,
  description: z.string().trim().min(1, 'Descreva a despesa').max(160),
  kind: z.enum(['indireto', 'transporte', 'outro']),
  amount: money,
});

export const quoteDocumentSchema = z.object({
  clientId: z.string().min(1, 'Selecione um cliente').max(40),
  project: z.object({
    name: z.string().trim().min(2, 'Informe o nome do projeto').max(160),
    serviceType: str(80),
    description: str(3000),
    width: nullableQty,
    height: nullableQty,
    depth: nullableQty,
    dimensionUnit: z.enum(['m', 'cm', 'mm']).default('m'),
    quantity: z.coerce.number().gt(0, 'Quantidade deve ser maior que zero').max(100_000),
    installLocation: str(300),
    finish: str(300),
    specifications: str(3000),
    notes: str(3000),
  }),
  materials: z.array(materialLineSchema).max(300),
  labor: z.array(laborLineSchema).max(100),
  extras: z.array(extraLineSchema).max(100),
  pricing: z.object({
    overheadPct: pct,
    taxPct: pct,
    feePct: pct,
    commissionPct: pct,
    marginPct: pct,
    manualPrice: z.preprocess(
      (v) => (v === '' || v == null ? null : v),
      z.coerce.number().min(0).max(100_000_000).nullable(),
    ),
  }),
  commercial: z.object({
    validityDays: z.coerce.number().int().min(1).max(365),
    paymentTerms: str(1000),
    downPaymentPct: z.coerce.number().min(0).max(100),
    installments: z.coerce.number().int().min(0).max(48),
    fabricationDays: z.coerce.number().int().min(0).max(365),
    installationDays: z.coerce.number().int().min(0).max(365),
    warranty: str(1000),
    notes: str(3000),
    responsible: str(120),
    showItemized: z.boolean().default(false),
  }),
});
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;
export type MaterialLine = z.infer<typeof materialLineSchema>;
export type LaborLine = z.infer<typeof laborLineSchema>;
export type ExtraLine = z.infer<typeof extraLineSchema>;

export const quoteSaveSchema = z.object({
  status: z.enum(['rascunho', 'em_elaboracao']).optional(),
  document: quoteDocumentSchema,
});

export const quoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES),
  lossReason: str(500).optional(),
  note: str(1000).optional(),
});

export const quoteCrmSchema = z.object({
  responsible: str(120),
  lastContactAt: z.string().max(30).nullable(),
  nextFollowupAt: z.string().max(30).nullable(),
  crmNotes: str(3000),
  lossReason: str(500),
});
