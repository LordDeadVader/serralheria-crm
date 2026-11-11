import { z } from 'zod';
import { UNITS } from '../calculations/units';
import { cnpjOpt, emailOpt, isValidCNPJ, isValidCPF, money, onlyDigits, str } from './common';
import { companySettingsSchema } from './settings';

export const clientSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome').max(160),
    personType: z.enum(['PF', 'PJ']).default('PF'),
    document: str(20),
    phone: str(30),
    whatsapp: str(30),
    email: emailOpt,
    cep: str(10),
    street: str(200),
    number: str(20),
    district: str(100),
    city: str(100),
    state: str(2),
    complement: str(120),
    notes: str(2000),
  })
  .superRefine((v, ctx) => {
    if (v.document) {
      const ok = v.personType === 'PF' ? isValidCPF(v.document) : isValidCNPJ(v.document);
      if (!ok)
        ctx.addIssue({ code: 'custom', path: ['document'], message: v.personType === 'PF' ? 'CPF inválido' : 'CNPJ inválido' });
    }
    if (v.cep && onlyDigits(v.cep).length !== 8) ctx.addIssue({ code: 'custom', path: ['cep'], message: 'CEP deve ter 8 dígitos' });
  });
export type ClientInput = z.infer<typeof clientSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  document: str(20),
  phone: str(30),
  email: emailOpt,
  contact: str(120),
  notes: str(2000),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

const optDim = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number().min(0).max(1_000_000).nullable(),
);

export const materialSchema = z.object({
  code: str(40),
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  category: str(60),
  description: str(1000),
  purchaseUnit: z.string().trim().min(1, 'Informe a unidade de compra').max(30),
  packQty: z.coerce.number().gt(0, 'Deve ser maior que zero').max(1_000_000),
  packUnit: z.enum(UNITS),
  usageUnit: z.enum(UNITS),
  purchasePrice: money,
  supplierId: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().max(40).nullable()),
  lengthMm: optDim,
  widthMm: optDim,
  thicknessMm: optDim,
  weightKg: optDim,
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});
export type MaterialInput = z.infer<typeof materialSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  description: str(1000),
  category: str(60),
  mode: z.enum(['hour', 'fixed']),
  unit: z.string().trim().min(1).max(20).default('h'),
  hourlyCost: money.default(0),
  fixedPrice: money.default(0),
  estimatedHours: z.coerce.number().min(0).max(10_000).default(0),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome fantasia').max(160),
  legalName: str(200),
  cnpj: cnpjOpt,
  address: str(300),
  phone: str(30),
  whatsapp: str(30),
  email: emailOpt,
  // Logotipo em data URL (PNG/JPEG) limitado a ~300 KB.
  logo: z
    .string()
    .max(420_000, 'Logotipo muito grande (máx. ~300 KB)')
    .regex(/^data:image\/(png|jpeg);base64,/, 'Use PNG ou JPEG')
    .nullable(),
  settings: companySettingsSchema,
});
export type CompanyInput = z.infer<typeof companySchema>;

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter ao menos 10 caracteres')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letras e números');

export const signupSchema = z.object({
  inviteCode: z.string().trim().min(8, 'Código de convite inválido').max(80),
  companyName: z.string().trim().min(2, 'Informe o nome da empresa').max(160),
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(200),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(200),
  password: z.string().min(1, 'Informe a senha').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
