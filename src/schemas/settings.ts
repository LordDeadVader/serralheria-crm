import { z } from 'zod';
import { pct, str } from './common';

export const financialDefaultsSchema = z.object({
  marginPct: pct.default(25),
  taxPct: pct.default(6),
  commissionPct: pct.default(0),
  feePct: pct.default(0),
  overheadPct: pct.default(10),
  hourlyCost: z.coerce.number().min(0).max(100_000).default(35),
  wastePct: pct.default(5),
});

export const quoteDefaultsSchema = z.object({
  numberPrefix: str(10).default('ORC'),
  validityDays: z.coerce.number().int().min(1).max(365).default(15),
  fabricationDays: z.coerce.number().int().min(0).max(365).default(15),
  installationDays: z.coerce.number().int().min(0).max(365).default(2),
  warranty: str(1000).default('Garantia de 12 meses contra defeitos de fabricação e soldagem.'),
  paymentTerms: str(1000).default('Entrada na aprovação e saldo na entrega/instalação.'),
  downPaymentPct: z.coerce.number().min(0).max(100).default(50),
  installments: z.coerce.number().int().min(0).max(48).default(1),
  notes: str(3000).default(''),
  responsible: str(120).default(''),
});

export const companySettingsSchema = z.object({
  financial: financialDefaultsSchema.default(() => financialDefaultsSchema.parse({})),
  quote: quoteDefaultsSchema.default(() => quoteDefaultsSchema.parse({})),
});
export type CompanySettings = z.infer<typeof companySettingsSchema>;
export const defaultCompanySettings = (): CompanySettings => companySettingsSchema.parse({});
